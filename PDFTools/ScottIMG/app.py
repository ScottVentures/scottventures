"""Local image-processing API for the ScottIMG tools site."""
from __future__ import annotations

import io
import re
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps, UnidentifiedImageError
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool

app = FastAPI(title="ScottIMG", docs_url="/api/docs", redoc_url=None)
MAX_UPLOAD = 40 * 1024 * 1024
MAX_PIXELS = 50_000_000
FORMATS = {"jpg": "JPEG", "jpeg": "JPEG", "png": "PNG", "webp": "WEBP", "gif": "GIF", "bmp": "BMP", "tiff": "TIFF"}

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "ScottIMG"}

def process_image(data: bytes, filename: str, tool: str, width: int, height: int, quality: int,
                  degrees: int, text: str, x: int, y: int, crop_x: int, crop_y: int,
                  crop_w: int, crop_h: int, bg_color: str):
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
        original_format = image.format
        image = ImageOps.exif_transpose(image)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(415, "This image format is not supported or the file is damaged.") from exc
    if image.width * image.height > MAX_PIXELS:
        raise HTTPException(413, "The image is too large to process (limit: 50 megapixels).")

    out_type = original_format or "PNG"
    ext = Path(filename).suffix.lower().lstrip(".") or "png"
    if tool == "compress":
        if out_type not in {"JPEG", "WEBP", "PNG"}:
            out_type = "JPEG"
        quality = max(10, min(95, quality))
    elif tool == "resize":
        if width < 1 and height < 1:
            raise HTTPException(400, "Enter a width or height in pixels.")
        ratio = min(width / image.width if width else float("inf"), height / image.height if height else float("inf"))
        image = image.resize((max(1, round(image.width * ratio)), max(1, round(image.height * ratio))), Image.Resampling.LANCZOS)
    elif tool == "upscale":
        factor = max(2, min(4, width or 2))
        if image.width * image.height * factor * factor > MAX_PIXELS:
            raise HTTPException(413, "The enlarged image would exceed the 50 megapixel output limit.")
        image = image.resize((image.width * factor, image.height * factor), Image.Resampling.LANCZOS)
    elif tool == "crop":
        left, top = max(0, crop_x), max(0, crop_y)
        right, bottom = min(image.width, left + crop_w), min(image.height, top + crop_h)
        if crop_w < 1 or crop_h < 1 or right <= left or bottom <= top:
            raise HTTPException(400, "Crop width and height must be positive and inside the image.")
        image = image.crop((left, top, right, bottom))
    elif tool == "rotate":
        image = image.rotate(-degrees, expand=True)
    elif tool in {"watermark", "meme"}:
        image = image.convert("RGBA")
        overlay = Image.new("RGBA", image.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(overlay)
        try:
            font = ImageFont.truetype("arial.ttf", max(16, image.width // (14 if tool == "meme" else 24)))
        except OSError:
            font = ImageFont.load_default()
        caption = (text or ("SCOTTIMG" if tool == "watermark" else "YOUR MEME"))[:180]
        if tool == "meme":
            for label, yy in ((caption.upper(), 10), ((bg_color or "YOUR CAPTION").upper(), image.height - max(50, image.height // 10))):
                draw.text((image.width // 2, yy), label, font=font, fill="white", stroke_width=2, stroke_fill="black", anchor="mt")
        else:
            draw.text((max(0, min(image.width - 1, x)), max(0, min(image.height - 1, y))), caption, font=font, fill=(255, 255, 255, 150), stroke_width=1, stroke_fill=(0, 0, 0, 110))
        image = Image.alpha_composite(image, overlay)
    elif tool == "edit":
        image = ImageEnhance.Contrast(image).enhance(1.08)
        image = ImageEnhance.Color(image).enhance(1.12)
        image = ImageEnhance.Sharpness(image).enhance(1.1)
    elif tool == "blur":
        left, top = max(0, crop_x), max(0, crop_y)
        right, bottom = min(image.width, left + max(1, crop_w)), min(image.height, top + max(1, crop_h))
        if right <= left or bottom <= top:
            raise HTTPException(400, "The blur region is outside the image.")
        patch = image.crop((left, top, right, bottom)).filter(ImageFilter.GaussianBlur(radius=max(8, min(40, image.width // 30))))
        image.paste(patch, (left, top))
    elif tool == "remove-background":
        try:
            rgb = tuple(int(bg_color.lstrip("#")[i:i+2], 16) for i in (0, 2, 4))
        except (ValueError, AttributeError):
            raise HTTPException(400, "Choose a valid background color to remove.")
        rgba = image.convert("RGBA")
        tolerance = max(12, min(100, quality))
        delta = ImageChops.difference(rgba.convert("RGB"), Image.new("RGB", rgba.size, rgb))
        furthest = ImageChops.lighter(ImageChops.lighter(*delta.split()[:2]), delta.split()[2])
        rgba.putalpha(furthest.point(lambda value: 0 if value < tolerance else 255))
        image, out_type = rgba, "PNG"
    elif tool == "convert":
        out_type = FORMATS.get(bg_color.lower(), "JPEG")
    elif tool == "html-to-image":
        raise HTTPException(501, "HTML capture needs a browser rendering engine. Upload an image or use ScottIMG's image tools.")
    else:
        raise HTTPException(404, "This ScottIMG tool is not available.")

    if out_type == "JPEG":
        image = image.convert("RGB")
    elif out_type in {"PNG", "WEBP"} and image.mode not in {"RGB", "RGBA", "L"}:
        image = image.convert("RGBA" if "transparency" in image.info else "RGB")
    buffer = io.BytesIO()
    save_options = {"quality": max(10, min(95, quality)), "optimize": True} if out_type in {"JPEG", "WEBP"} else {"optimize": True} if out_type == "PNG" else {}
    image.save(buffer, format=out_type, **save_options)
    suffix = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp", "GIF": ".gif", "BMP": ".bmp", "TIFF": ".tiff"}.get(out_type, ".png")
    return buffer.getvalue(), suffix, Image.MIME.get(out_type, "application/octet-stream")

@app.post("/api/process/{tool}")
async def process(tool: str, file: UploadFile = File(...), width: int = Form(0), height: int = Form(0),
                  quality: int = Form(82), degrees: int = Form(90), text: str = Form(""), x: int = Form(20), y: int = Form(20),
                  crop_x: int = Form(0), crop_y: int = Form(0), crop_w: int = Form(0), crop_h: int = Form(0),
                  bg_color: str = Form("#ffffff")):
    if tool == "html-to-image":
        raise HTTPException(501, "HTML capture needs a browser rendering engine, which is not configured in this local build.")
    if (tool == "blur" and (crop_w == 0 or crop_h == 0)) or (tool == "crop" and (crop_w == 0 or crop_h == 0)):
        raise HTTPException(400, "Enter crop/blur width and height.")
    data = await file.read(MAX_UPLOAD + 1)
    await file.close()
    if not data:
        raise HTTPException(400, "Choose a non-empty image first.")
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Each image must be smaller than 40 MB.")
    result, suffix, media_type = await run_in_threadpool(process_image, data, file.filename or "image", tool, width, height, quality,
                                                           degrees, text, x, y, crop_x, crop_y, crop_w, crop_h, bg_color)
    temp = Path(tempfile.mkdtemp(prefix="scottimg-"))
    output = temp / (re.sub(r"[^A-Za-z0-9_-]+", "-", Path(file.filename or "image").stem)[:64] + "-scottimg" + suffix)
    output.write_bytes(result)
    return FileResponse(output, filename=output.name, media_type=media_type, background=BackgroundTask(shutil.rmtree, temp, ignore_errors=True))

app.mount("/", StaticFiles(directory=Path(__file__).resolve().parent, html=True), name="site")
