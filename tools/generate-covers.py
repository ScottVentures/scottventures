#!/usr/bin/env python3
"""Generate 1200x630 illustrated WebP covers for every article / tutorial / learning material.
Usage:  python3 tools/build-manifest.py && python3 tools/generate-covers.py [--sheet out.png] [slug ...]
Requires Pillow (with WebP). Output: sources/images/covers/<kind>/<slug>.webp"""
import json, os, sys, colorsys, zlib, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cover_icons as ci

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, SS = 1200, 630, 2
TAGS = {"articles": "ARTICLE", "tutorials": "TUTORIAL", "materials": "LEARNING MATERIAL"}

# slug -> (motif, kwargs, hue 0..1)
SPEC = {
 # articles
 "api-vs-sdk": ("apisdk", {}, .56), "article1": ("bulb", {}, .12), "article2": ("book", {}, .76),
 "bandwidth-vs-latency": ("gauge", {}, .50), "browser-devtools": ("window", {}, .62),
 "clipboard-managers": ("clipboard", {}, .36), "cpu-cache": ("chip", {}, .98), "cron-jobs": ("clock", {"loop": True}, .46),
 "dns-explained": ("globe", {}, .52), "docker-basics": ("containers", {}, .58), "env-variables": ("envfile", {}, .24),
 "file-permissions": ("perms", {}, .07), "git": ("branch", {}, .03), "http-status-codes": ("bubble", {}, .93),
 "json-vs-xml": ("braces", {}, .14), "keyboard-shortcuts": ("keyboard", {}, .70), "markdown-tips": ("markdown", {}, .82),
 "motherboard": ("board", {}, .40), "password-managers": ("vault", {}, .88), "power-button": ("power", {}, .00),
 "ram-vs-storage": ("ramdrive", {}, .44), "regex": ("regex", {}, .84), "router-basics": ("router", {}, .54),
 "sata-vs-nvme": ("drives", {}, .09), "screen-resolution": ("monitor", {}, .64), "semantic-versioning": ("semver", {}, .33),
 "ssh-keys": ("key", {}, .16), "ssl-tls": ("padlock", {"check": True}, .38), "terminal-tricks": ("terminal", {}, .30),
 "two-factor-auth": ("phone2fa", {}, .68), "vpn-explained": ("shield", {"inner": "tunnel"}, .57),
 # tutorials
 "algorithms-sorting": ("sortbars", {}, .08), "angular": ("badge", {"letter": "A", "shape": "shield", "size": 150}, .99),
 "authentication-jwt": ("jwt", {}, .80), "ci-cd-pipelines": ("pipeline", {}, .40), "css-flexbox-grid": ("flexgrid", {}, .60),
 "data-structures": ("tree", {}, .48), "django-rest-api": ("endpoints", {}, .38), "docker-compose": ("containers", {"compose": True}, .56),
 "git-branching-workflow": ("branch", {"dense": True}, .05), "mongodb-basics": ("leaf", {}, .33),
 "nextjs-basics": ("badge", {"letter": "N", "shape": "circle", "size": 170, "sub": "Next.js"}, .60),
 "nodejs-express-api": ("badge", {"letter": "JS", "shape": "hex", "size": 120, "sub": "Node"}, .27),
 "python-automation": ("gears", {}, .14), "python-flask": ("flask", {}, .10), "react-basics": ("atom", {}, .53),
 "regex-tutorial": ("regex", {"t1": "\\d+", "t2": "^(a|b)$"}, .74), "responsive-design": ("responsive", {}, .46),
 "rest-vs-graphql": ("graphql", {}, .90), "sql-joins": ("venn", {}, .65), "state-management-redux": ("cycle", {}, .78),
 "testing-with-jest": ("checklist", {}, .96), "typescript-basics": ("badge", {"letter": "TS", "shape": "square", "size": 120}, .59),
 "vue-basics": ("badge", {"letter": "", "shape": "chevron"}, .42), "websockets": ("websocket", {}, .50),
 # materials
 "agile-project-management": ("kanban", {}, .02), "api-design-principles": ("contract", {}, .72),
 "blockchain-fundamentals": ("blocks", {}, .12), "cloud-fundamentals": ("cloud", {}, .55),
 "containerization-kubernetes": ("kube", {}, .61), "cybersecurity-essentials": ("shield", {"inner": "keyhole"}, .35),
 "data-privacy-compliance": ("eye", {}, .85), "data-structures-algorithms-guide": ("tree", {"array": True}, .18),
 "databases-101": ("cylinder", {}, .52), "deep-learning": ("neural", {"layers": (4, 6, 6, 6, 3)}, .74),
 "devops-fundamentals": ("infinity", {}, .45), "frontend-performance": ("bolt", {}, .13),
 "linux-command-line-guide": ("terminal", {"lines": ("$ cd /var/log", "$ tail -f log", "$ _")}, .22),
 "machine-learning-basics": ("scatter", {}, .86), "mobile-development-guide": ("phone", {}, .94),
 "networking-fundamentals": ("topology", {}, .50), "operating-systems-101": ("layers", {}, .66),
 "secure-coding": ("shield", {"inner": "code"}, .02), "serverless-computing": ("cloud", {"lam": True}, .70),
 "software-architecture-patterns": ("layers", {"labels": ("PRESENTATION", "DOMAIN", "DATA")}, .31),
 "system-design-basics": ("sysdesign", {}, .58), "technical-interview-prep": ("briefcase", {}, .08),
 "testing-strategies": ("pyramid", {}, .92), "ui-ux-principles": ("wire", {}, .76),
 "version-control": ("branch", {"dense": True, "flip": True}, .62), "web-developers-handbook": ("browser", {}, .36),
}
TITLE_FIX = {"angular": "Mastering Web App Development with Angular and Bootstrap"}
SPEC["article1"] = ("bulb", {}, .12)

def hsv(h, s, v, a=255):
    r, g, b = colorsys.hsv_to_rgb(h % 1.0, s, v); return (int(r * 255), int(g * 255), int(b * 255), a)

def palette(h, light):
    if not light:
        bg1, bg2 = hsv(h, .62, .17), hsv(h + .04, .58, .36)
        A, B = hsv(h, .10, 1), hsv(h + .07, .60, 1)
        C = hsv(h, .35, .95, 62); T = (255, 255, 255, 255); D = hsv(h, .65, .20)
        sub = hsv(h, .25, .95, 200)
    else:
        bg1, bg2 = hsv(h, .06, .99), hsv(h + .03, .22, .90)
        A, B = hsv(h, .78, .42), hsv(h - .05, .85, .92)
        C = hsv(h, .55, .85, 60); T = hsv(h, .75, .20); D = hsv(h, .06, .99)
        sub = hsv(h, .6, .35, 220)
    return bg1, bg2, ci.P(A, B, C, D, T), sub

def background(h, light, layout, seed):
    bg1, bg2, pal, _ = palette(h, light)
    img = Image.new("RGB", (W * SS, H * SS), bg1[:3])
    grad = Image.linear_gradient("L").rotate(90 if layout % 2 else 0).resize((W * SS, H * SS))
    if layout % 2 == 0: grad = Image.linear_gradient("L").rotate(35, expand=False, resample=Image.BICUBIC).resize((W * SS, H * SS))
    img = Image.composite(Image.new("RGB", img.size, bg2[:3]), img, grad)
    d = ImageDraw.Draw(img, "RGBA")
    S = SS
    line = pal.A[:3] + (22,)
    deco = seed % 4
    if deco == 0:   # dot grid
        for x in range(30, W, 44):
            for y in range(30, H, 44): d.ellipse([(x - 2) * S, (y - 2) * S, (x + 2) * S, (y + 2) * S], fill=line)
    elif deco == 1:  # diagonal lines
        for x in range(-H, W, 54): d.line([(x * S, H * S), ((x + H) * S, 0)], fill=line, width=2 * S)
    elif deco == 2:  # concentric rings
        for r in range(120, 1000, 90): d.ellipse([(W - 150 - r) * S, (-60 - r) * S, (W - 150 + r) * S, (-60 + r) * S], outline=line, width=3 * S)
    else:            # blobs
        for (x, y, r) in ((90, 560, 160), (1100, 80, 200), (620, 640, 120)):
            d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=pal.B[:3] + (26,))
    return img, pal

def wrap(text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if font.getlength(t) <= maxw or not cur: cur = t
        else: lines.append(cur); cur = w
    lines.append(cur)
    return lines

def fit_title(text, maxw, maxh, smax=64, smin=32, maxlines=5):
    for size in range(smax, smin - 1, -2):
        f = ImageFont.truetype(ci.SANS, size * SS)
        lines = wrap(text, f, maxw * SS)
        if len(lines) <= maxlines and len(lines) * size * 1.22 <= maxh and max(f.getlength(l) for l in lines) <= maxw * SS:
            return f, lines, size
    f = ImageFont.truetype(ci.SANS, smin * SS); return f, wrap(text, f, maxw * SS), smin

LAYOUTS = {  # icon centre, scale, text box (x0,x1), align
 0: dict(ic=(905, 305), k=1.0, tx=(70, 645), al="l"),
 1: dict(ic=(300, 310), k=1.0, tx=(590, 1135), al="l"),
 2: dict(ic=(935, 235), k=.8, tx=(70, 715), al="l"),
 3: dict(ic=(895, 315), k=.95, tx=(70, 640), al="l"),
 4: dict(ic=(950, 315), k=1.0, tx=(70, 640), al="l"),
 5: dict(ic=(600, 215), k=.76, tx=(100, 1100), al="c"),
}

def render(item, idx):
    slug, kind = item["slug"], item["kind"]
    motif, kw, hue = SPEC[slug]
    layout = idx % 6
    light = (idx % 7 == 3) or (zlib.crc32(slug.encode()) % 9 == 0)
    img, pal = background(hue, light, layout, zlib.crc32(slug.encode()) // 7)
    d = ImageDraw.Draw(img, "RGBA"); S = SS
    L = LAYOUTS[layout]; cx, cy = L["ic"]
    # backdrop shapes behind icon
    if layout in (0, 2, 3):
        r = 215 if layout != 2 else 165
        d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=pal.A[:3] + (24,))
        d.ellipse([(cx - r - 28) * S, (cy - r - 28) * S, (cx + r + 28) * S, (cy + r + 28) * S], outline=pal.A[:3] + (40,), width=3 * S)
    if layout == 1:
        d.rounded_rectangle([(cx - 230) * S, (cy - 235) * S, (cx + 230) * S, (cy + 235) * S], radius=60 * S, fill=pal.A[:3] + (22,))
        d.rounded_rectangle([(cx - 250) * S, (cy - 255) * S, (cx + 210) * S, (cy + 215) * S], radius=60 * S, outline=pal.B[:3] + (80,), width=3 * S)
    if layout == 4:
        d.polygon([(745 * S, 0), (W * S, 0), (W * S, H * S), (665 * S, H * S)], fill=pal.A[:3] + (30,))
    if layout == 5:
        d.ellipse([(cx - 190) * S, (cy - 190) * S, (cx + 190) * S, (cy + 190) * S], fill=pal.A[:3] + (24,))
    if layout == 3:
        d.rounded_rectangle([(cx - 230) * S, (cy - 235) * S, (cx + 230) * S, (cy + 235) * S], radius=40 * S, outline=pal.B[:3] + (70,), width=3 * S)
    g = ci.G(img, cx, cy, L["k"], SS)
    getattr(ci, motif)(g, pal, **kw)
    # text
    x0, x1 = L["tx"]; title = TITLE_FIX.get(slug, item["title"])
    tagf = ImageFont.truetype(ci.SANS, 19 * S)
    tag = " ".join(TAGS[kind]); tag = TAGS[kind]
    tw = sum(tagf.getlength(ch) + 2.5 * S for ch in tag)
    ty = 60 if layout != 5 else 46
    px0 = x0 if L["al"] == "l" else x0
    d.rounded_rectangle([px0 * S, ty * S, px0 * S + tw + 36 * S, (ty + 40) * S], radius=20 * S, fill=pal.B)
    cxp = px0 * S + 18 * S
    tagcol = pal.D[:3] + (255,) if not light else (255, 255, 255, 255)
    for ch in tag:
        d.text((cxp, (ty + 20) * S), ch, font=tagf, fill=tagcol, anchor="lm"); cxp += tagf.getlength(ch) + 2.5 * S
    top = ty + 40 + 26
    bottom = 535 if layout != 5 else 560
    if layout == 5: top = 375
    f, lines, size = fit_title(title, x1 - x0, bottom - top, smax=62 if layout != 5 else 50)
    lh = size * 1.22; block = len(lines) * lh
    y = top + (bottom - top - block) / 2 if layout != 5 else top + (bottom - top - block) / 2
    for ln in lines:
        if L["al"] == "l": d.text((x0 * S, y * S), ln, font=f, fill=pal.T, anchor="la")
        else: d.text(((x0 + x1) / 2 * S, y * S), ln, font=f, fill=pal.T, anchor="ma")
        y += lh
    # accent underline
    # brand
    bf = ImageFont.truetype(ci.SANS, 22 * S)
    brand = "ScottVentures"
    if layout == 5: bx, anc = 1140, "rm"
    else: bx, anc = x0 if layout != 1 else 60, "lm"
    if layout in (2,) : bx, anc = 70, "lm"
    d.ellipse([(bx - (0 if anc == "lm" else 190)) * S, 586 * S, (bx - (0 if anc == "lm" else 190) + 14) * S, 600 * S], fill=pal.B)
    d.text(((bx + (24 if anc == "lm" else 0)) * S, 593 * S), brand, font=bf, fill=pal.A[:3] + (210,), anchor=anc)
    return img.resize((W, H), Image.LANCZOS)

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    sheet = None
    if "--sheet" in sys.argv: sheet = sys.argv[sys.argv.index("--sheet") + 1]; args = [a for a in args if a != sheet]
    man = json.load(open(os.path.join(ROOT, "tools", "covers-manifest.json"), encoding="utf-8"))
    idx = {}
    done = []
    for it in man:
        i = idx.get(it["kind"], 0); idx[it["kind"]] = i + 1
        if args and it["slug"] not in args: continue
        if it["slug"] not in SPEC: print("NO SPEC", it["slug"]); continue
        im = render(it, i + {"articles": 0, "tutorials": 2, "materials": 4}[it["kind"]])
        out = os.path.join(ROOT, "sources", "images", "covers", it["kind"]); os.makedirs(out, exist_ok=True)
        p = os.path.join(out, it["slug"] + ".webp")
        im.save(p, "WEBP", quality=82, method=6)
        done.append((it, im, os.path.getsize(p)))
    print("generated", len(done), "max KB", max(s for *_, s in done) // 1024 if done else 0, "avg KB", sum(s for *_, s in done) // 1024 // max(1, len(done)))
    if sheet:
        cols = 3; tw, th = 600, 315; rows = math.ceil(len(done) / cols)
        sh = Image.new("RGB", (cols * tw, rows * th), "white")
        for n, (it, im, _) in enumerate(done): sh.paste(im.resize((tw, th), Image.LANCZOS), ((n % cols) * tw, (n // cols) * th))
        sh.save(sheet)
main()
