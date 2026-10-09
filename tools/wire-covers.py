#!/usr/bin/env python3
"""Idempotently wire generated covers into listing pages + content pages (meta tags, hero image, CSS)."""
import json, os, re, html
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
man = json.load(open(os.path.join(ROOT, "tools", "covers-manifest.json"), encoding="utf-8"))
FIX = {"angular": "Mastering Web App Development with Angular and Bootstrap"}
for m in man: m["title"] = FIX.get(m["slug"], m["title"])
folder = {"articles": "Articles", "tutorials": "Tutorials", "materials": "Materials"}
by = {(folder[m["kind"]], m["slug"]): m for m in man}
q = lambda s: html.escape(s, quote=True)
report = []

def rw(path, fn):
    p = os.path.join(ROOT, path); s = open(p, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in s else "\n"
    t = fn(s)
    if t != s: open(p, "w", encoding="utf-8", newline="").write(t)
    return t != s

# ---- listing pages
def listing(path, cls):
    cnt = {"n": 0}
    def fn(s):
        parts = re.split(r'(?=<div class="%s">)' % cls, s)
        out = [parts[0]]
        for blk in parts[1:]:
            m = re.search(r'href="((?:Articles|Tutorials|Materials)/([^"/]+)\.html)"', blk)
            img = re.search(r'<img\b[^>]*>', blk)
            if not m or not img: out.append(blk); continue
            key = (m.group(1).split("/")[0], m.group(2))
            if key not in by: report.append("card without page: %s in %s" % (m.group(1), path)); out.append(blk); continue
            it = by[key]
            new = '<img src="sources/images/covers/%s/%s.webp" alt="Cover: %s" loading="lazy" width="1200" height="630" style="height:auto">' % (it["kind"], it["slug"], q(it["title"]))
            blk = blk[:img.start()] + new + blk[img.end():]; cnt["n"] += 1
            out.append(blk)
        return "".join(out)
    changed = rw(path, fn); return cnt["n"], changed
for path, cls in (("products.html", "product-item"), ("tutorials.html", "team-member"), ("learning-materials.html", "product-item")):
    print(path, listing(path, cls))

# ---- content pages
def content(fo, m):
    path = "%s/%s.html" % (fo, m["slug"]); title = m["title"]
    cov = "../sources/images/covers/%s/%s.webp" % (m["kind"], m["slug"])
    def fn(s):
        if "</head>" not in s: report.append("no </head>: " + path); return s
        tm = re.search(r"<title>(.*?)</title>", s, re.S); ptitle = tm.group(1).strip() if tm else title
        add = []
        if 'property="og:image"' not in s: add.append('<meta property="og:image" content="%s">' % cov)
        if 'property="og:title"' not in s: add.append('<meta property="og:title" content="%s">' % ptitle)
        if 'property="og:type"' not in s: add.append('<meta property="og:type" content="article">')
        if 'name="twitter:card"' not in s: add.append('<meta name="twitter:card" content="summary_large_image">')
        if 'name="twitter:image"' not in s: add.append('<meta name="twitter:image" content="%s">' % cov)
        if add:
            i = s.index("</head>"); ind = "    "
            s = s[:i] + "".join(ind + a + "\n" for a in add) + "  " + s[i:] if s[i-1] == " " else s[:i] + "".join(ind + a + "\n" for a in add) + s[i:]
        if 'class="sv-cover"' not in s:
            img = '<img class="sv-cover" src="%s" alt="Cover: %s" width="1200" height="630">' % (cov, q(title))
            if fo == "Articles":
                mm = re.search(r'<div class="article-content">', s)
                if mm: s = s[:mm.start()] + img + "\n            " + s[mm.start():]
                else: report.append("no hero anchor: " + path)
            elif m["slug"] == "angular":  # legacy template: no material-meta / articles.css
                mm = re.search(r'<img src="\.\./sources/images/angular\.png"', s)
                if mm:
                    s = s[:mm.start()] + img + "\n      " + s[mm.start():]
                    s = s.replace("</head>", "    <style>.sv-cover{display:block;max-width:100%;height:auto;border-radius:12px;margin:1rem auto 1.5rem;box-shadow:0 8px 24px rgba(0,0,0,.18)}</style>\n  </head>", 1)
                else: report.append("no hero anchor: " + path)
            else:
                mm = re.search(r'<p class="material-meta">.*?</p>', s, re.S)
                if mm: s = s[:mm.end()] + "\n      " + img + s[mm.end():]
                else: report.append("no hero anchor: " + path)
        return s
    return rw(path, fn)
n = sum(content(fo, by[(fo, k)]) for (fo, k) in list(by))
print("content pages changed:", n)

# ---- css (Tutorials/Materials link ../Articles/articles.css)
css = """
/* Generated cover image shown under the page heading (tools/generate-covers.py) */
.sv-cover { display: block; max-width: 100%; height: auto; border-radius: 12px; margin: 1rem 0 1.5rem; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); }
"""
p = os.path.join(ROOT, "Articles", "articles.css"); s = open(p, encoding="utf-8").read()
if ".sv-cover" not in s: open(p, "a", encoding="utf-8").write(css); print("css added")
print("REPORT:", report)
