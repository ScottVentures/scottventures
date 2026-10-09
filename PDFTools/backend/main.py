"""ScottPDF's same-origin API for its PDF processing tools."""

from __future__ import annotations

import os
import json
import re
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError
from starlette.concurrency import run_in_threadpool
from starlette.background import BackgroundTask

from backend.operations import SUPPORTED_TOOLS, ToolError, process_tool


SITE_ROOT = Path(__file__).resolve().parent.parent
MAX_UPLOAD_BYTES = int(os.getenv("SCOTTPDF_MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))
MAX_FILES = int(os.getenv("SCOTTPDF_MAX_FILES", "20"))
MAX_PAGES = int(os.getenv("SCOTTPDF_MAX_PAGES", "1000"))

app = FastAPI(
    title="ScottPDF API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
)


@app.middleware("http")
async def guard_tool_requests(request, call_next):
    if request.method == "POST" and request.url.path.startswith(("/api/v1/tools/", "/api/v1/process/")):
        origin = request.headers.get("origin")
        if origin:
            host = request.headers.get("host", "")
            expected_origin = f"{request.url.scheme}://{host}"
            trusted_origins = {
                item.strip()
                for item in os.getenv("SCOTTPDF_TRUSTED_ORIGINS", "").split(",")
                if item.strip()
            }
            if origin != expected_origin and origin not in trusted_origins:
                return JSONResponse({"detail": "Requests from this website are not allowed."}, status_code=403)
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > MAX_UPLOAD_BYTES + 2 * 1024 * 1024:
            return JSONResponse({"detail": "The request is larger than the upload limit."}, status_code=413)
    return await call_next(request)


def _safe_basename(value: str, fallback: str) -> str:
    name = Path(value or "").name
    name = re.sub(r"[^A-Za-z0-9._ -]", "", name).strip(" .")
    name = Path(name).stem or fallback
    return name[:80]


async def _save_upload(upload: UploadFile, destination: Path, total: list[int]) -> None:
    size = 0
    with destination.open("wb") as target:
        while chunk := await upload.read(1024 * 1024):
            size += len(chunk)
            total[0] += len(chunk)
            if total[0] > MAX_UPLOAD_BYTES:
                raise HTTPException(413, f"Total upload exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")
            target.write(chunk)
    if size == 0:
        raise HTTPException(400, "The uploaded file is empty.")
    with destination.open("rb") as saved_file:
        header = saved_file.read(1024)
    if size < 5 or b"%PDF-" not in header:
        raise HTTPException(415, "One of the uploaded files is not a PDF.")


async def _save_any_upload(upload: UploadFile, destination: Path, total: list[int]) -> None:
    size = 0
    with destination.open("wb") as target:
        while chunk := await upload.read(1024 * 1024):
            size += len(chunk)
            total[0] += len(chunk)
            if total[0] > MAX_UPLOAD_BYTES:
                raise HTTPException(413, f"Total upload exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")
            target.write(chunk)
    if not size:
        raise HTTPException(400, "An uploaded file is empty.")


def _reader(path: Path) -> PdfReader:
    try:
        reader = PdfReader(path, strict=False)
        if reader.is_encrypted:
            raise HTTPException(422, "Password-protected PDFs are not supported yet.")
        if len(reader.pages) == 0:
            raise HTTPException(422, "The PDF has no pages.")
        if len(reader.pages) > MAX_PAGES:
            raise HTTPException(413, f"A PDF may contain at most {MAX_PAGES} pages.")
        return reader
    except HTTPException:
        raise
    except (PdfReadError, OSError, ValueError) as exc:
        raise HTTPException(422, "The PDF is damaged or could not be read.") from exc


def _write_pdf(writer: PdfWriter, path: Path) -> None:
    try:
        with path.open("wb") as output:
            writer.write(output)
    except (OSError, ValueError, PdfReadError) as exc:
        raise HTTPException(422, "ScottPDF could not create the output PDF.") from exc


def _response(path: Path, filename: str, media_type: str = "application/pdf") -> FileResponse:
    return FileResponse(
        path,
        media_type=media_type,
        filename=filename,
        background=BackgroundTask(shutil.rmtree, path.parent, ignore_errors=True),
    )


def _page_ranges(specification: str, page_count: int) -> list[tuple[int, int]]:
    """Parse a comma-separated 1-based range list into half-open page indexes."""
    if not specification.strip():
        return [(index, index + 1) for index in range(page_count)]

    result: list[tuple[int, int]] = []
    for item in specification.split(","):
        item = item.strip()
        match = re.fullmatch(r"(\d+)(?:\s*-\s*(\d+))?", item)
        if not match:
            raise HTTPException(400, "Enter page ranges like 1-3,5,8-9.")
        first = int(match.group(1))
        last = int(match.group(2) or first)
        if first < 1 or last < first or last > page_count:
            raise HTTPException(400, f"Page ranges must be between 1 and {page_count}.")
        result.append((first - 1, last))
    return result


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ScottPDF"}


@app.post("/api/v1/process/{tool}")
async def process_pdf_tool(
    tool: str,
    files: Annotated[list[UploadFile], File(description="Input files for the selected PDF tool")] = [],
    options: Annotated[str, Form()] = "{}",
) -> FileResponse:
    if tool not in SUPPORTED_TOOLS:
        raise HTTPException(404, "This PDF tool is not available.")
    if (not files and tool != "html_to_pdf") or len(files) > MAX_FILES:
        raise HTTPException(400, f"Choose between 1 and {MAX_FILES} files.")
    if tool == "compare_pdf" and len(files) != 2:
        raise HTTPException(400, "This tool needs exactly two PDFs.")
    if tool == "merge" and len(files) < 2:
        raise HTTPException(400, "Choose at least two PDFs to merge.")
    multi_image = tool in {"jpg_to_pdf", "scan_pdf"}
    url_only_html = tool == "html_to_pdf" and len(files) == 0
    if tool not in {"merge", "compare_pdf"} and not multi_image and not url_only_html and len(files) != 1:
        raise HTTPException(400, "Choose one input file for this tool.")
    try:
        parsed_options = json.loads(options or "{}")
        if not isinstance(parsed_options, dict):
            raise ValueError("Options must be an object")
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(400, "The tool options are invalid.") from exc

    work = Path(tempfile.mkdtemp(prefix="scottpdf-"))
    saved: list[Path] = []
    original_names: list[str] = []
    try:
        total = [0]
        for index, upload in enumerate(files):
            original_name = upload.filename or f"input-{index + 1}"
            suffix = Path(original_name).suffix.lower()
            if suffix not in {".pdf", ".docx", ".pptx", ".xlsx", ".html", ".htm", ".jpg", ".jpeg", ".png", ".webp", ".bmp"}:
                raise HTTPException(415, f"Unsupported file type: {suffix or 'unknown'}.")
            destination = work / f"input-{index + 1}{suffix}"
            await _save_any_upload(upload, destination, total)
            saved.append(destination)
            original_names.append(Path(original_name).name)
        try:
            result = await run_in_threadpool(process_tool, tool, saved, original_names, parsed_options, work)
        except ToolError as exc:
            raise HTTPException(exc.status_code, str(exc)) from exc
        except Exception as exc:
            raise HTTPException(422, "ScottPDF could not process these files. Check the file format and tool options.") from exc
        return _response(result.path, result.filename, result.media_type)
    except Exception:
        shutil.rmtree(work, ignore_errors=True)
        raise
    finally:
        for upload in files:
            await upload.close()


@app.post("/api/v1/tools/merge")
async def merge_pdfs(
    files: Annotated[list[UploadFile], File(description="PDF files in the order to merge")],
    output_name: Annotated[str, Form()] = "scottpdf-merged",
) -> FileResponse:
    if not 2 <= len(files) <= MAX_FILES:
        raise HTTPException(400, f"Choose between 2 and {MAX_FILES} PDF files.")
    work = Path(tempfile.mkdtemp(prefix="scottpdf-"))
    try:
        writer = PdfWriter()
        total = [0]
        for index, upload in enumerate(files):
            input_path = work / f"input-{index}.pdf"
            await _save_upload(upload, input_path, total)
            writer.append(_reader(input_path))
        result = work / "merged.pdf"
        _write_pdf(writer, result)
        return _response(result, f"{_safe_basename(output_name, 'scottpdf-merged')}.pdf")
    except Exception:
        shutil.rmtree(work, ignore_errors=True)
        raise
    finally:
        for upload in files:
            await upload.close()


@app.post("/api/v1/tools/compress")
async def compress_pdf(
    file: Annotated[UploadFile, File(description="PDF file to compress")],
    output_name: Annotated[str, Form()] = "scottpdf-compressed",
) -> FileResponse:
    work = Path(tempfile.mkdtemp(prefix="scottpdf-"))
    try:
        source = work / "input.pdf"
        await _save_upload(file, source, [0])
        reader = _reader(source)
        writer = PdfWriter()
        for page in reader.pages:
            page.compress_content_streams()
            writer.add_page(page)
        writer.compress_identical_objects(remove_identicals=True, remove_orphans=True)
        result = work / "compressed.pdf"
        _write_pdf(writer, result)
        return _response(result, f"{_safe_basename(output_name, 'scottpdf-compressed')}.pdf")
    except Exception:
        shutil.rmtree(work, ignore_errors=True)
        raise
    finally:
        await file.close()


@app.post("/api/v1/tools/split")
async def split_pdf(
    file: Annotated[UploadFile, File(description="PDF file to split")],
    pages: Annotated[str, Form()] = "",
    output_name: Annotated[str, Form()] = "scottpdf-split",
) -> FileResponse:
    work = Path(tempfile.mkdtemp(prefix="scottpdf-"))
    try:
        source = work / "input.pdf"
        await _save_upload(file, source, [0])
        reader = _reader(source)
        ranges = _page_ranges(pages, len(reader.pages))
        stem = _safe_basename(output_name, "scottpdf-split")
        if len(ranges) == 1:
            start, end = ranges[0]
            writer = PdfWriter()
            for page_number in range(start, end):
                writer.add_page(reader.pages[page_number])
            result = work / "split.pdf"
            _write_pdf(writer, result)
            return _response(result, f"{stem}.pdf")

        archive = work / "split-pages.zip"
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
            for index, (start, end) in enumerate(ranges, start=1):
                writer = PdfWriter()
                for page_number in range(start, end):
                    writer.add_page(reader.pages[page_number])
                part = work / f"part-{index}.pdf"
                _write_pdf(writer, part)
                bundle.write(part, arcname=f"{stem}-{index}.pdf")
                part.unlink(missing_ok=True)
        return _response(archive, f"{stem}.zip", "application/zip")
    except Exception:
        shutil.rmtree(work, ignore_errors=True)
        raise
    finally:
        await file.close()


PUBLIC_EXTENSIONS = {
    ".css", ".gif", ".html", ".ico", ".jpeg", ".jpg", ".js", ".json",
    ".png", ".svg", ".webp", ".woff", ".woff2", ".ttf", ".otf",
}


@app.get("/", include_in_schema=False)
def home() -> FileResponse:
    return FileResponse(SITE_ROOT / "index.html")


@app.get("/{requested_path:path}", include_in_schema=False)
def serve_site_file(requested_path: str) -> FileResponse:
    path = (SITE_ROOT / requested_path).resolve()
    if not path.is_relative_to(SITE_ROOT) or not path.is_file():
        raise HTTPException(404, "Page not found.")
    relative = path.relative_to(SITE_ROOT)
    if any(part.startswith(".") or part.lower() == "backend" for part in relative.parts):
        raise HTTPException(404, "Page not found.")
    if path.suffix.lower() not in PUBLIC_EXTENSIONS:
        raise HTTPException(404, "Page not found.")
    return FileResponse(path)
