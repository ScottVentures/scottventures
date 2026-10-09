"""Vector-style icon motifs for ScottVentures covers (drawn with Pillow, no external deps).
Each motif draws into local space roughly +-200 units around (0,0)."""
import math
from PIL import ImageDraw, ImageFont

FONT_DIRS = ["/usr/share/fonts/truetype/google-fonts/", "/usr/share/fonts/truetype/dejavu/",
             "/usr/share/fonts/truetype/liberation/", "C:/Windows/Fonts/"]

def find_font(names):
    import os
    for d in FONT_DIRS:
        for n in names:
            p = d + n
            if os.path.exists(p):
                return p
    raise SystemExit("no font found among %s" % names)

MONO = find_font(["DejaVuSansMono-Bold.ttf", "consolab.ttf", "LiberationMono-Bold.ttf"])
SANS = find_font(["Poppins-Bold.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"])

class P:  # palette
    def __init__(s, A, B, C, D, T):
        s.A, s.B, s.C, s.D, s.T = A, B, C, D, T  # stroke, accent, soft fill (rgba), knockout/bg, text

class G:
    def __init__(s, img, cx, cy, k, ss):
        s.img, s.cx, s.cy, s.k, s.ss = img, cx, cy, k, ss
        s.d = ImageDraw.Draw(img, "RGBA")
        s._f = {}
    def p(s, x, y): return ((s.cx + x * s.k) * s.ss, (s.cy + y * s.k) * s.ss)
    def n(s, v): return max(1, int(round(v * s.k * s.ss)))
    def line(s, pts, w, col):
        q = [s.p(*a) for a in pts]
        s.d.line(q, fill=col, width=s.n(w), joint="curve")
        r = s.n(w) / 2
        for x, y in (q[0], q[-1]):
            s.d.ellipse([x - r, y - r, x + r, y + r], fill=col)
    def rr(s, x0, y0, x1, y1, r=12, fill=None, out=None, w=8):
        a, b = s.p(x0, y0), s.p(x1, y1)
        s.d.rounded_rectangle([a, b], radius=s.n(r), fill=fill, outline=out, width=s.n(w) if out else 0)
    def el(s, x, y, rx, ry=None, fill=None, out=None, w=8):
        ry = rx if ry is None else ry
        a, b = s.p(x - rx, y - ry), s.p(x + rx, y + ry)
        s.d.ellipse([a, b], fill=fill, outline=out, width=s.n(w) if out else 0)
    def pg(s, pts, fill=None, out=None, w=8):
        q = [s.p(*a) for a in pts]
        if fill is not None: s.d.polygon(q, fill=fill)
        if out is not None:
            s.d.line(q + [q[0]], fill=out, width=s.n(w), joint="curve")
            r = s.n(w) / 2
            for x, y in q: s.d.ellipse([x - r, y - r, x + r, y + r], fill=out)
    def arc(s, x, y, r, a0, a1, col, w=10):
        a, b = s.p(x - r, y - r), s.p(x + r, y + r)
        s.d.arc([a, b], a0, a1, fill=col, width=s.n(w))
    def font(s, size, mono=True):
        key = (size, mono)
        if key not in s._f: s._f[key] = ImageFont.truetype(MONO if mono else SANS, s.n(size))
        return s._f[key]
    def tx(s, x, y, t, size, col, mono=True, anchor="mm"):
        s.d.text(s.p(x, y), t, font=s.font(size, mono), fill=col, anchor=anchor)
    def arrow(s, a, b, w, col, head=30):
        s.line([a, b], w, col)
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        h1 = (b[0] - head * math.cos(ang - .5), b[1] - head * math.sin(ang - .5))
        h2 = (b[0] - head * math.cos(ang + .5), b[1] - head * math.sin(ang + .5))
        s.pg([b, h1, h2], fill=col, out=col, w=2)

def rot(pts, deg, c=(0, 0)):
    a = math.radians(deg); ca, sa = math.cos(a), math.sin(a)
    return [(c[0] + (x - c[0]) * ca - (y - c[1]) * sa, c[1] + (x - c[0]) * sa + (y - c[1]) * ca) for x, y in pts]

def ellpts(cx, cy, rx, ry, rd=0, n=90):
    return rot([(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)], rd, (cx, cy))

def gear(g, x, y, r1, r0, n, fill, out, hole):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n; da = math.pi / n
        for aa, rr_ in ((a - da * .55, r0), (a - da * .3, r1), (a + da * .3, r1), (a + da * .55, r0)):
            pts.append((x + rr_ * math.cos(aa), y + rr_ * math.sin(aa)))
    g.pg(pts, fill=fill, out=out, w=6)
    g.el(x, y, hole, fill=None, out=out, w=8)

# ---------------------------------------------------------------- motifs
def globe(g, c):
    g.el(0, 0, 150, fill=c.C, out=c.A, w=10)
    g.el(0, 0, 60, 150, out=c.A, w=6); g.el(0, 0, 150, 55, out=c.A, w=6)
    g.line([(-150, 0), (150, 0)], 6, c.A); g.line([(0, -150), (0, 150)], 6, c.A)
    nodes = [(-175, -80), (170, -90), (150, 125), (-120, 150), (0, -190)]
    for a, b in [(0, 4), (4, 1), (1, 2), (2, 3), (3, 0)]:
        g.line([nodes[a], nodes[b]], 4, c.B)
    for x, y in nodes: g.el(x, y, 17, fill=c.B)

def gauge(g, c):
    g.arc(0, 50, 160, 180, 360, c.A, 14)
    g.arc(0, 50, 160, 300, 360, c.B, 14)
    for i in range(7):
        a = math.radians(180 + i * 30)
        g.line([(130 * math.cos(a), 50 + 130 * math.sin(a)), (112 * math.cos(a), 50 + 112 * math.sin(a))], 6, c.A)
    g.line([(0, 50), (85, -45)], 12, c.B); g.el(0, 50, 24, fill=c.B); g.el(0, 50, 9, fill=c.D)
    g.line([(-170, 110), (170, 110)], 8, c.A)
    g.arrow((-120, 150), (120, 150), 8, c.B, 26)

def window(g, c, text="</>", sub="Elements  Console  Network"):
    g.rr(-175, -130, 175, 130, 20, fill=c.C, out=c.A, w=9)
    g.line([(-175, -80), (175, -80)], 7, c.A)
    for i, x in enumerate((-140, -112, -84)): g.el(x, -105, 9, fill=c.B if i == 0 else c.A)
    g.rr(-150, -55, -10, 100, 8, out=c.A, w=5)
    for y in (-30, 0, 30, 60): g.line([(-132, y), (-132 + 60 + (y % 40), y)], 6, c.A)
    g.rr(15, -55, 150, 100, 8, fill=c.B)
    g.tx(82, 22, text, 46, c.D)

def clipboard(g, c, n=3):
    for dx, dy, fill in ((40, 20, None), (-20, -10, c.C)):
        g.rr(-110 + dx, -140 + dy, 80 + dx, 140 + dy, 18, fill=fill or c.D, out=c.A, w=9)
    g.rr(-60, -170, 40, -120, 14, fill=c.B)
    for i, y in enumerate((-60, -10, 40)):
        g.line([(-90, y), (-20 + 30 * (i % 2), y)], 8, c.A)
    g.line([(-80, 95), (-40, 125)], 12, c.B); g.line([(-40, 125), (30, 70)], 12, c.B)

def chip(g, c, levels=3, labels=True):
    for i in range(4):
        o = -60 + i * 40
        for s in (-1, 1):
            g.line([(o, s * 110), (o, s * 160)], 8, c.A); g.line([(s * 110, o), (s * 160, o)], 8, c.A)
    sizes = [110, 80, 50, 24][:levels + 1]
    fills = [c.C, c.C, c.B, c.B]
    g.rr(-110, -110, 110, 110, 18, fill=c.C, out=c.A, w=9)
    if levels >= 3:
        g.rr(-80, -80, 80, 80, 12, out=c.A, w=6)
        g.rr(-52, -52, 52, 52, 10, fill=None, out=c.B, w=6)
        g.rr(-24, -24, 24, 24, 6, fill=c.B)
        if labels:
            g.tx(0, -96, "L3", 22, c.A); g.tx(0, -67, "L2", 20, c.A); g.tx(0, -40, "L1", 18, c.B)
    else:
        g.rr(-60, -60, 60, 60, 10, fill=c.B); g.tx(0, 0, "CPU", 34, c.D)

def board(g, c):
    g.rr(-170, -140, 170, 140, 16, fill=c.C, out=c.A, w=9)
    g.rr(-60, -60, 60, 60, 8, fill=c.B); g.tx(0, 0, "CPU", 26, c.D)
    for i in range(4): g.rr(95 + i * 15, -120, 103 + i * 15, -20, 3, fill=c.A)
    g.rr(-150, 70, 0, 100, 5, out=c.A, w=5)
    for x in (-130, -100, -70, -40, -10): g.line([(x, 78), (x, 92)], 5, c.A)
    g.line([(-60, 0), (-120, 0), (-120, -60), (-150, -60)], 5, c.A)
    g.line([(60, 20), (120, 20), (120, 70), (150, 70)], 5, c.A)
    g.line([(0, 60), (0, 110), (80, 110)], 5, c.A)
    for x, y in ((-150, -60), (150, 70), (80, 110)): g.el(x, y, 9, fill=c.B)
    g.rr(30, 80, 70, 120, 5, fill=c.A); g.el(-110, -105, 12, out=c.A, w=5)

def clock(g, c, loop=False):
    g.el(0, 0, 140, fill=c.C, out=c.A, w=12)
    for i in range(12):
        a = math.radians(i * 30)
        g.line([(116 * math.sin(a), -116 * math.cos(a)), (130 * math.sin(a), -130 * math.cos(a))], 6, c.A)
    g.line([(0, 0), (0, -85)], 12, c.A); g.line([(0, 0), (60, 30)], 12, c.B); g.el(0, 0, 12, fill=c.B)
    if loop:
        g.arc(0, 0, 175, 200, 340, c.B, 10)
        g.pg([(175 * math.cos(math.radians(340)) + 0, 175 * math.sin(math.radians(340)) + 0), (140, -125), (186, -100)], fill=c.B, out=c.B, w=2)
        g.tx(-150, 140, "*/5", 34, c.B)

def containers(g, c, compose=False):
    if compose:
        for i, (x, y) in enumerate(((-110, -60), (110, -60), (0, 80))):
            g.rr(x - 70, y - 55, x + 70, y + 55, 12, fill=c.C, out=c.A, w=8)
            g.rr(x - 45, y - 25, x - 5, y + 25, 4, fill=c.B if i != 1 else None, out=c.A, w=5)
            g.rr(x + 8, y - 25, x + 48, y + 25, 4, out=c.A, w=5)
        g.line([(-40, -60), (40, -60)], 6, c.B); g.line([(-70, -10), (-40, 30)], 6, c.B); g.line([(70, -10), (40, 30)], 6, c.B)
        for p in ((-40, -60), (40, -60), (-40, 30), (40, 30)): g.el(*p, 9, fill=c.B)
        g.line([(-170, 160), (170, 160)], 6, c.A)
        return
    rows = [(-150, -90, 4), (-150 + 0, -30, 4), (-110, 30, 3)]
    for i, (x, y, n) in enumerate(((-90, -90, 3), (-120, -30, 4), (-120, 30, 4))):
        for j in range(n):
            hl = (i, j) == (1, 2)
            g.rr(x + j * 62, y, x + j * 62 + 54, y + 50, 6, fill=c.B if hl else c.C, out=c.A, w=6)
    g.pg([(-170, 95), (170, 95), (140, 150), (-130, 150)], fill=c.A, out=c.A, w=2)
    for x in (-110, -30, 50, 130): g.arc(x, 150, 24, 180, 360, c.B, 7)

def envfile(g, c):
    g.pg([(-110, -150), (50, -150), (110, -90), (110, 150), (-110, 150)], fill=c.C, out=c.A, w=9)
    g.pg([(50, -150), (50, -90), (110, -90)], fill=c.A, out=c.A, w=2)
    g.tx(-5, -35, ".env", 46, c.A)
    for i, y in enumerate((20, 60, 100)):
        g.line([(-80, y), (-80 + 20, y)], 8, c.B); g.line([(-45, y), (-45 + 55 + i * 10, y)], 8, c.A)
        g.tx(-80, y, "", 10, c.A)
    g.el(120, 105, 44, fill=c.D, out=c.B, w=10); g.el(120, 105, 12, fill=c.B)
    g.line([(155, 130), (190, 165)], 12, c.B)

def perms(g, c):
    rows = "rwx"; ws = 62
    for r in range(3):
        for col in range(3):
            on = (r + col) % 2 == 0 or (r == 0 and col == 0)
            x0 = -120 + col * 90; y0 = -125 + r * 85
            g.rr(x0, y0, x0 + 76, y0 + 70, 12, fill=c.B if on else c.C, out=c.A, w=6)
            g.tx(x0 + 38, y0 + 35, rows[col] if on else "-", 44, c.D if on else c.A)
    for i, t in enumerate(("u", "g", "o")): g.tx(-160, -90 + i * 85, t, 30, c.B)
    g.tx(-5, 160, "chmod 754", 32, c.A)

def branch(g, c, dense=False, flip=False):
    m = -1 if flip else 1
    F = lambda pts: [(m * x, y) for x, y in pts]
    g.line(F([(-90, -150), (-90, 150)]), 12, c.A)
    g.line(F([(-90, -80), (-90, -40), (70, 10), (70, 80), (-90, 120)]), 12, c.B)
    pts = [(-90, -150), (-90, -80), (-90, 120), (-90, 150), (70, 20), (70, 80)]
    if dense:
        g.line(F([(-90, 20), (-30, 20), (30, -30), (150, -30), (150, -120)]), 12, c.A)
        pts += [(150, -30), (150, -120)]
    for x, y in pts: g.el(m * x, y, 22, fill=c.D, out=c.A, w=10)
    g.el(m * 70, 50, 22, fill=c.B)

def bubble(g, c, text="404", sub="NOT FOUND"):
    g.rr(-170, -110, 170, 80, 36, fill=c.C, out=c.A, w=10)
    g.pg([(-90, 80), (-130, 150), (-30, 80)], fill=c.C, out=c.A, w=8)
    g.rr(-90, 70, -40, 90, 0, fill=c.D)  # hide seam
    g.tx(0, -45, text, 100, c.B); g.tx(0, 28, sub, 32, c.A)

def braces(g, c):
    g.tx(-100, -10, "{ }", 110, c.A); g.tx(105, -10, "</>", 66, c.B)
    g.line([(-20, 100), (-20, 100)], 1, c.A)
    g.line([(-170, 90), (170, 90)], 8, c.A)
    g.rr(-170, 120, -40, 150, 8, fill=c.A); g.rr(40, 120, 170, 150, 8, fill=c.B)

def keyboard(g, c):
    rows = (7, 7, 6)
    for r, n in enumerate(rows):
        kw = 340 / n
        for i in range(n):
            x = -175 + r * 18 + i * kw
            hl = (r, i) in ((1, 2), (0, 4), (2, 3))
            g.rr(x, -120 + r * 70, x + kw - 12, -120 + r * 70 + 58, 10, fill=c.B if hl else c.C, out=c.A, w=6)
    g.rr(-110, 95, 110, 150, 10, fill=c.C, out=c.A, w=6)
    g.rr(-175, 95, -125, 150, 10, fill=c.B); g.rr(125, 95, 175, 150, 10, out=c.A, w=6)

def markdown(g, c):
    g.rr(-175, -100, 175, 100, 22, fill=c.C, out=c.A, w=10)
    g.tx(-85, 0, "M", 130, c.A, mono=False)
    g.pg([(70, -45), (70, 20), (45, 20), (95, 70), (145, 20), (120, 20), (120, -45)], fill=c.B, out=c.B, w=2)
    g.tx(0, 150, "# ** [] `", 36, c.A)

def vault(g, c):
    g.rr(-140, -120, 140, 130, 24, fill=c.C, out=c.A, w=10)
    g.el(0, 5, 70, fill=c.D, out=c.B, w=10)
    for i in range(8):
        a = math.radians(i * 45)
        g.line([(24 * math.cos(a), 5 + 24 * math.sin(a)), (56 * math.cos(a), 5 + 56 * math.sin(a))], 7, c.B)
    g.el(0, 5, 14, fill=c.B)
    g.rr(-110, -95, 110, -65, 8, out=c.A, w=4)
    for x in (-50, -20, 10, 40, 70): g.el(x, -80, 7, fill=c.A)
    g.rr(-110, 130, -70, 160, 6, fill=c.A); g.rr(70, 130, 110, 160, 6, fill=c.A)

def power(g, c):
    g.arc(0, 15, 120, -50, 230, c.A, 24)
    g.line([(0, -140), (0, 5)], 24, c.B)
    g.arc(0, 15, 160, -50, 230, c.C, 8)
    g.el(0, 15, 160, out=None)

def ramdrive(g, c, which="both"):
    # RAM stick
    y = -80
    g.rr(-170, y - 50, 170, y + 50, 10, fill=c.C, out=c.A, w=8)
    for i in range(6): g.rr(-145 + i * 50, y - 28, -115 + i * 50, y + 12, 4, fill=c.B if i % 3 == 0 else c.A)
    for i in range(14): g.line([(-150 + i * 22, y + 50), (-150 + i * 22, y + 66)], 7, c.B)
    # storage
    y = 95
    g.rr(-170, y - 50, 170, y + 50, 16, fill=c.C, out=c.A, w=8)
    g.el(-100, y, 30, out=c.A, w=6); g.el(-100, y, 7, fill=c.A)
    g.line([(-40, y - 15), (110, y - 15)], 8, c.A); g.line([(-40, y + 15), (60, y + 15)], 8, c.A)
    g.el(135, y, 9, fill=c.B)

def regex(g, c, t1=".*", t2="[a-z]+"):
    g.tx(0, -35, t1, 190, c.B)
    g.tx(0, 95, t2, 64, c.A)

def router(g, c):
    g.rr(-160, 30, 160, 110, 20, fill=c.C, out=c.A, w=9)
    for x in (-110, -80, -50): g.el(x, 70, 9, fill=c.B)
    for x in (30, 70, 110): g.rr(x - 12, 58, x + 12, 82, 3, out=c.A, w=5)
    g.line([(-110, 30), (-130, -90)], 10, c.A); g.line([(110, 30), (130, -90)], 10, c.A)
    g.el(-130, -92, 12, fill=c.B); g.el(130, -92, 12, fill=c.B)
    for r in (45, 85, 125): g.arc(0, 20, r, 225, 315, c.B, 8)
    g.line([(-60, 110), (-60, 160), (-120, 160)], 7, c.A); g.line([(60, 110), (60, 160), (120, 160)], 7, c.A)

def drives(g, c):
    g.rr(-170, -140, 130, -10, 18, fill=c.C, out=c.A, w=8)
    g.rr(-145, -115, -40, -35, 6, out=c.A, w=5); g.tx(-92, -75, "SATA", 22, c.A)
    for i in range(5): g.line([(135, -115 + i * 20), (170, -115 + i * 20)], 5, c.A)
    g.line([(-20, -100), (100, -100)], 7, c.A); g.line([(-20, -70), (70, -70)], 7, c.A)
    g.rr(-170, 30, 120, 105, 12, fill=c.C, out=c.B, w=8)
    for i in range(4): g.rr(-140 + i * 55, 45, -100 + i * 55, 90, 4, fill=c.B if i == 1 else c.A)
    g.rr(120, 50, 170, 85, 4, fill=c.B); g.tx(-10, 130, "NVMe  M.2", 28, c.B)
    g.arrow((-20, -4), (-20, 22), 6, c.A, 14)

def monitor(g, c):
    g.rr(-175, -135, 175, 80, 18, fill=c.C, out=c.A, w=10)
    for r in range(6):
        for q in range(12):
            if (r * 3 + q * 5) % 7 == 0: g.rr(-150 + q * 25, -112 + r * 28, -134 + q * 25, -98 + r * 28, 2, fill=c.A)
    g.rr(25, -40, 135, 45, 6, fill=c.B)
    for r in range(3):
        for q in range(4): g.rr(33 + q * 25, -32 + r * 27, 50 + q * 25, -17 + r * 27, 2, fill=c.D)
    g.line([(0, 80), (0, 125)], 12, c.A); g.line([(-70, 130), (70, 130)], 12, c.A)

def semver(g, c):
    labs = ("MAJOR", "MINOR", "PATCH"); nums = ("2", "7", "1")
    for i in range(3):
        x = -125 + i * 125
        g.rr(x - 50, -80, x + 50, 40, 18, fill=c.B if i == 1 else c.C, out=c.A, w=8)
        g.tx(x, -20, nums[i], 90, c.D if i == 1 else c.A)
        g.tx(x, 75, labs[i], 22, c.A)
        if i < 2: g.el(x + 62, 25, 8, fill=c.A)
    g.arrow((-125, 130), (125, 130), 7, c.B, 24)

def key(g, c):
    g.el(-95, -10, 62, fill=c.C, out=c.A, w=14); g.el(-95, -10, 20, fill=c.B)
    g.line([(-35, -10), (160, -10)], 16, c.A)
    for x, l in ((70, 55), (110, 40), (145, 55)): g.line([(x, -10), (x, l)], 14, c.A)
    g.rr(-170, 100, 170, 160, 12, fill=c.C, out=c.B, w=6); g.tx(0, 130, "ssh-ed25519 AAAA…", 28, c.B)

def padlock(g, c, check=False):
    g.arc(0, -20, 75, 180, 360, c.A, 22); g.line([(-75, -20), (-75, 20)], 22, c.A); g.line([(75, -20), (75, 20)], 22, c.A)
    g.rr(-115, 10, 115, 150, 22, fill=c.C, out=c.A, w=10)
    g.el(0, 70, 20, fill=c.B); g.line([(0, 80), (0, 115)], 14, c.B)
    if check:
        g.el(110, -110, 40, fill=c.B); g.line([(92, -110), (106, -95)], 10, c.D); g.line([(106, -95), (130, -128)], 10, c.D)
    g.tx(0, -170, "https://", 30, c.A)

def terminal(g, c, lines=("$ ls -la", "$ grep -r TODO .", "$ _")):
    g.rr(-175, -125, 175, 125, 18, fill=c.D, out=c.A, w=9)
    g.line([(-175, -78), (175, -78)], 6, c.A)
    for x, col in ((-142, c.B), (-114, c.A), (-86, c.A)): g.el(x, -102, 9, fill=col)
    for i, t in enumerate(lines): g.tx(-155, -38 + i * 52, t, 29, c.B if i == len(lines) - 1 else c.A, anchor="lm")

def phone2fa(g, c):
    g.rr(-170, -150, -10, 150, 28, fill=c.C, out=c.A, w=9)
    g.rr(-150, -110, -30, 90, 10, out=c.A, w=5)
    for i in range(3): g.rr(-142 + i * 38, -40, -116 + i * 38, 10, 5, fill=c.B)
    g.tx(-90, -80, "482", 30, c.A); g.el(-90, 122, 10, out=c.A, w=5)
    g.rr(25, -110, 175, -40, 14, fill=c.C, out=c.A, w=7); g.tx(100, -75, "••••••", 34, c.A)
    g.pg([(100, 0), (160, 20), (160, 80), (100, 125), (40, 80), (40, 20)], fill=c.B, out=c.B, w=3)
    g.line([(72, 62), (95, 85)], 9, c.D); g.line([(95, 85), (130, 40)], 9, c.D)

def shield(g, c, inner="check"):
    pts = [(0, -165), (125, -120), (125, 10), (0, 165), (-125, 10), (-125, -120)]
    g.pg(pts, fill=c.C, out=c.A, w=12)
    if inner == "check":
        g.line([(-55, 5), (-15, 50)], 20, c.B); g.line([(-15, 50), (60, -40)], 20, c.B)
    elif inner == "keyhole":
        g.el(0, -25, 32, fill=c.B); g.pg([(-14, -5), (14, -5), (24, 70), (-24, 70)], fill=c.B, out=c.B, w=2)
    elif inner == "tunnel":
        g.arc(0, 60, 75, 180, 360, c.B, 12); g.line([(-75, 60), (-75, 105)], 12, c.B); g.line([(75, 60), (75, 105)], 12, c.B)
        g.arc(0, 60, 40, 180, 360, c.A, 8); g.line([(-40, 60), (-40, 105)], 8, c.A); g.line([(40, 60), (40, 105)], 8, c.A)
        g.arrow((-190, 0), (-130, 0), 8, c.B, 20); g.arrow((130, 0), (190, 0), 8, c.B, 20)
    elif inner == "code":
        g.tx(0, -15, "</>", 74, c.B); g.line([(-60, 60), (60, 60)], 12, c.B)
    elif inner == "eye":
        g.pg(ellpts(0, -10, 70, 36, 0, 50), fill=None, out=c.B, w=10); g.el(0, -10, 20, fill=c.B)
        g.line([(-80, 60), (80, -80)], 12, c.A)

def apisdk(g, c):
    g.rr(-190, -70, -40, 70, 18, fill=c.C, out=c.A, w=9); g.tx(-115, 0, "API", 46, c.A)
    g.rr(40, -70, 190, 70, 18, fill=c.B); g.tx(115, 0, "SDK", 46, c.D)
    g.line([(-40, -25), (40, -25)], 8, c.A); g.line([(-40, 25), (40, 25)], 8, c.A)
    g.tx(0, 130, "{ endpoints }  vs  { toolkit }", 28, c.A)

def endpoints(g, c):
    verbs = ("GET", "POST", "PUT", "DEL")
    for i, v in enumerate(verbs):
        y = -135 + i * 72
        g.rr(-170, y, -60, y + 54, 12, fill=c.B if i == 0 else c.C, out=c.A, w=6)
        g.tx(-115, y + 27, v, 28, c.D if i == 0 else c.A)
        g.line([(-50, y + 27), (20, y + 27)], 6, c.A)
        g.rr(30, y + 5, 170, y + 49, 8, out=c.A, w=5); g.tx(100, y + 27, "/v1/" + ("users", "items", "items/7", "items/7")[i], 20, c.A)

def bulb(g, c):
    g.el(0, -40, 90, fill=c.C, out=c.A, w=11)
    g.rr(-40, 52, 40, 100, 8, fill=c.A); g.rr(-30, 105, 30, 128, 8, fill=c.A)
    g.line([(-28, 20), (-14, -20), (0, 20), (14, -20), (28, 20)], 7, c.B)
    for a in (-90, -50, -130, -10, -170, 20, 160):
        r = math.radians(a)
        g.line([(138 * math.cos(r), -40 + 138 * math.sin(r)), (172 * math.cos(r), -40 + 172 * math.sin(r))], 9, c.B)
    g.el(0, -40, 90, out=None)

def book(g, c):
    g.pg([(0, -60), (-170, -90), (-170, 100), (0, 130)], fill=c.C, out=c.A, w=9)
    g.pg([(0, -60), (170, -90), (170, 100), (0, 130)], fill=c.C, out=c.A, w=9)
    g.line([(0, -60), (0, 130)], 8, c.A)
    for i in range(3):
        g.line([(-140, -50 + i * 38), (-30, -30 + i * 38)], 6, c.A); g.line([(30, -30 + i * 38), (140, -50 + i * 38)], 6, c.A)
    g.el(0, -125, 36, out=c.B, w=9); g.line([(-14, -85), (14, -85)], 8, c.B)
    for a in (-90, -30, -150): 
        r = math.radians(a); g.line([(58 * math.cos(r), -125 + 58 * math.sin(r)), (78 * math.cos(r), -125 + 78 * math.sin(r))], 7, c.B)

def sortbars(g, c):
    hs = [60, 130, 40, 170, 100, 150, 80]
    for i, h in enumerate(hs):
        hl = i in (1, 3)
        g.rr(-175 + i * 52, 120 - h, -175 + i * 52 + 40, 120, 6, fill=c.B if hl else c.C, out=c.A, w=5)
    g.line([(-185, 130), (185, 130)], 7, c.A)
    g.arc(-23, -50, 100, 200, 340, c.B, 9); g.pg([(77, -66), (50, -90), (95, -95)], fill=c.B, out=c.B, w=2)

def badge(g, c, letter="A", shape="shield", size=120, sub=None):
    if shape == "shield":
        g.pg([(0, -165), (135, -115), (115, 70), (0, 160), (-115, 70), (-135, -115)], fill=c.C, out=c.A, w=11)
    elif shape == "hex":
        g.pg([(0, -165), (143, -82), (143, 82), (0, 165), (-143, 82), (-143, -82)], fill=c.C, out=c.A, w=11)
    elif shape == "circle":
        g.el(0, 0, 150, fill=c.C, out=c.A, w=11)
    elif shape == "square":
        g.rr(-145, -145, 145, 145, 28, fill=c.C, out=c.A, w=11)
    elif shape == "chevron":
        g.pg([(-165, -120), (-85, -120), (0, 40), (85, -120), (165, -120), (0, 165)], fill=c.C, out=c.A, w=11)
        g.pg([(-85, -120), (-45, -120), (0, -35), (45, -120), (85, -120), (0, 40)], fill=c.B, out=c.B, w=2)
        return
    g.tx(0, -5 if not sub else -20, letter, size, c.B, mono=False)
    if sub: g.tx(0, 95, sub, 30, c.A)

def jwt(g, c):
    parts = (("HEADER", c.C), ("PAYLOAD", c.B), ("SIGNATURE", c.C))
    for i, (t, f) in enumerate(parts):
        y = -145 + i * 90
        g.rr(-140, y, 140, y + 70, 16, fill=f, out=c.A, w=7)
        g.tx(0, y + 35, t, 30, c.D if f == c.B else c.A)
        if i < 2: g.el(0, y + 80, 6, fill=c.A)
    g.el(165, 100, 32, out=c.B, w=9); g.line([(190, 122), (200, 150)], 9, c.B)

def pipeline(g, c):
    xs = (-150, -50, 50, 150)
    g.line([(xs[0], 0), (xs[-1], 0)], 10, c.A)
    for i, x in enumerate(xs):
        g.el(x, 0, 38, fill=c.B if i == 3 else c.D, out=c.A if i < 3 else c.B, w=9)
    for x in xs[:3]:
        g.line([(x - 14, 2), (x - 3, 14)], 8, c.A); g.line([(x - 3, 14), (x + 16, -12)], 8, c.A)
    g.pg([(138, -16), (166, 0), (138, 16)], fill=c.D, out=c.D, w=2)
    for x, t in zip(xs, ("build", "test", "stage", "ship")): g.tx(x, 78, t, 24, c.A)
    g.arc(0, -40, 150, 200, 340, c.B, 7)
    g.tx(0, -150, "git push", 28, c.B)

def flexgrid(g, c):
    g.rr(-185, -130, -5, 130, 14, out=c.A, w=6)
    for (x0, x1, y0, y1, hl) in ((-170, -125, -115, -45, 0), (-115, -75, -115, -45, 1), (-65, -20, -115, -45, 0)):
        g.rr(x0, y0, x1, y1, 6, fill=c.B if hl else c.C, out=c.A, w=4)
    g.rr(-170, -30, -20, 20, 6, fill=c.C, out=c.A, w=4); g.rr(-170, 35, -85, 115, 6, fill=c.C, out=c.A, w=4); g.rr(-75, 35, -20, 115, 6, fill=c.B)
    g.rr(15, -130, 185, 130, 14, out=c.A, w=6)
    for r in range(2):
        for q in range(2):
            g.rr(28 + q * 80, -115 + r * 120, 98 + q * 80, -15 + r * 120, 8, fill=c.B if (r, q) == (1, 0) else c.C, out=c.A, w=4)

def tree(g, c, array=False):
    nodes = {0: (0, -120), 1: (-90, -20), 2: (90, -20), 3: (-140, 80), 4: (-40, 80), 5: (50, 80), 6: (140, 80)}
    for a, b in ((0, 1), (0, 2), (1, 3), (1, 4), (2, 5), (2, 6)): g.line([nodes[a], nodes[b]], 7, c.A)
    for i, (x, y) in nodes.items(): g.el(x, y, 28, fill=c.B if i in (0, 4) else c.D, out=c.A, w=8)
    if array:
        for i in range(6): g.rr(-165 + i * 56, 135, -115 + i * 56, 175, 4, fill=c.B if i == 2 else c.C, out=c.A, w=4)
    else:
        g.line([(-190, 150), (190, 150)], 1, c.A)

def gears(g, c):
    gear(g, -50, 20, 105, 82, 10, c.C, c.A, 30)
    gear(g, 90, -70, 62, 48, 8, c.C, c.B, 18)
    g.pg([(-8, -30), (-8, 70), (62, 20)], fill=c.B, out=c.B, w=2)
    g.line([(-160, 150), (170, 150)], 7, c.A); g.tx(0, 100 + 90, "", 10, c.A)

def flask(g, c):
    g.pg([(-40, -150), (40, -150), (40, -60), (150, 120), (-150, 120), (-40, -60)], fill=c.C, out=c.A, w=10)
    g.pg([(-100, 20), (100, 20), (150, 120), (-150, 120)], fill=c.B, out=c.B, w=2)
    g.rr(-55, -165, 55, -145, 6, fill=c.A)
    for x, y, r in ((-30, -10, 14), (25, -35, 10), (45, 60, 9)): g.el(x, y, r, out=c.A, w=5)
    g.tx(0, 78, "py", 56, c.D)

def atom(g, c):
    for rd in (0, 60, 120): g.pg(ellpts(0, 0, 170, 65, rd, 100), out=c.A, w=9)
    g.el(0, 0, 32, fill=c.B)
    for rd in (0, 60, 120):
        a = math.radians(rd); g.el(170 * math.cos(a), 170 * math.sin(a), 12, fill=c.B)

def responsive(g, c):
    g.rr(-190, -120, 60, 50, 12, fill=c.C, out=c.A, w=8); g.line([(-65, 50), (-65, 90)], 8, c.A); g.line([(-110, 92), (-20, 92)], 8, c.A)
    g.rr(70, -60, 170, 100, 14, fill=c.C, out=c.A, w=8); g.el(120, 82, 6, fill=c.A)
    g.rr(-45, 20, 15, 130, 12, fill=c.B); g.line([(-30, 112), (0, 112)], 5, c.D)
    for y in (-90, -60, -30): g.line([(-170, y), (-100 + (y % 50), y)], 6, c.A)

def graphql(g, c):
    pts = [(0, -150), (130, -75), (130, 75), (0, 150), (-130, 75), (-130, -75)]
    g.pg(pts, out=c.A, w=8)
    for a, b in ((0, 2), (2, 4), (4, 0), (1, 3), (3, 5), (5, 1)): g.line([pts[a], pts[b]], 3, c.A)
    for x, y in pts: g.el(x, y, 24, fill=c.B)
    g.el(0, 0, 18, fill=c.A)

def venn(g, c):
    g.el(-62, 0, 105, fill=c.C, out=c.A, w=9); g.el(62, 0, 105, fill=c.C, out=c.A, w=9)
    pts = []
    t0 = math.asin(math.sqrt(105 ** 2 - 62 ** 2) / 105)
    for i in range(41):
        t = -t0 + 2 * t0 * i / 40; pts.append((-62 + 105 * math.cos(t), 105 * math.sin(t)))
    for i in range(41):
        t = t0 - 2 * t0 * i / 40; pts.append((62 - 105 * math.cos(t), 105 * math.sin(t)))
    g.pg(pts, fill=c.B, out=c.B, w=2)
    g.tx(-120, 0, "A", 52, c.A, mono=False); g.tx(120, 0, "B", 52, c.A, mono=False)
    g.tx(0, 150, "JOIN ... ON", 30, c.A)

def cycle(g, c):
    nodes = [(0, -120), (108, 62), (-108, 62)]
    g.arc(0, 0, 110, 200, 340, c.A, 10); g.arc(0, 0, 110, 320, 100, c.A, 1)
    for i in range(3):
        a0 = -90 + i * 120 + 25; a1 = a0 + 70
        g.arc(0, 0, 112, a0, a1, c.B, 11)
        r = math.radians(a1); 
        tip = (112 * math.cos(r), 112 * math.sin(r)); d = (-math.sin(r), math.cos(r))
        nrm = (math.cos(r), math.sin(r))
        g.pg([(tip[0] + d[0] * 28, tip[1] + d[1] * 28), (tip[0] + nrm[0] * 20, tip[1] + nrm[1] * 20), (tip[0] - nrm[0] * 20, tip[1] - nrm[1] * 20)], fill=c.B, out=c.B, w=2)
    for (x, y), t in zip(nodes, ("view", "store", "action")):
        g.el(x, y, 54, fill=c.D, out=c.A, w=8); g.tx(x, y, t, 19, c.A)

def checklist(g, c):
    g.rr(-130, -150, 130, 150, 20, fill=c.C, out=c.A, w=9)
    for i, ok in enumerate((1, 1, 0, 1)):
        y = -100 + i * 66
        if ok:
            g.line([(-100, y), (-82, y + 18)], 10, c.B); g.line([(-82, y + 18), (-50, y - 20)], 10, c.B)
        else:
            g.line([(-98, y - 18), (-62, y + 18)], 10, c.A); g.line([(-62, y - 18), (-98, y + 18)], 10, c.A)
        g.line([(-25, y), (-25 + 90 - i * 10, y)], 8, c.A)
    g.rr(60, 105, 175, 160, 14, fill=c.B); g.tx(118, 132, "PASS", 28, c.D)

def websocket(g, c):
    g.rr(-195, -60, -80, 60, 14, fill=c.C, out=c.A, w=8); g.rr(80, -60, 195, 60, 14, fill=c.C, out=c.A, w=8)
    g.tx(-138, 0, "client", 18, c.A); g.tx(138, 0, "server", 18, c.A)
    g.arrow((-70, -22), (70, -22), 9, c.B, 28); g.arrow((70, 22), (-70, 22), 9, c.A, 28)
    g.tx(0, 100, "ws://", 40, c.B)

def leaf(g, c):
    top = [(-80 + 160 * t, -95 * math.sin(math.pi * t)) for t in [i / 30 for i in range(31)]]
    bot = [(x, 95 * math.sin(math.pi * (x + 80) / 160)) for x, _ in reversed(top)]
    sc = 1.55
    pts = rot([(x * sc, y * sc) for x, y in top + bot], -55, (0, 0))
    pts = [(x + 10, y - 20) for x, y in pts]
    g.pg(pts, fill=c.C, out=c.A, w=10)
    g.line([(x + 10, y - 20) for x, y in rot([(-95 * sc, 0), (92 * sc, 0)], -55)], 9, c.B)
    for t in (-0.45, 0.0, 0.45):
        g.line([(x + 10, y - 20) for x, y in rot([(t * 140 * sc, 0), (t * 140 * sc + 40, 70 * sc * 0.6)], -55)], 6, c.B)
    g.line([(-95, 150), (-55, 105)], 10, c.A)

def contract(g, c):
    g.rr(-150, -150, 150, 150, 20, fill=c.C, out=c.A, w=9)
    lines = ("openapi: 3.1", "paths:", "  /orders:", "    get:", "    post:")
    for i, t in enumerate(lines): g.tx(-120, -108 + i * 40, t, 25, c.B if i in (0, 2) else c.A, anchor="lm")
    g.rr(-120, 100, -10, 140, 20, fill=c.B); g.tx(-65, 120, "v1", 28, c.D)
    g.rr(10, 100, 120, 140, 20, out=c.A, w=6); g.tx(65, 120, "v2", 28, c.A)
    g.arrow((-6, 120), (6, 120), 4, c.A, 8)

def kanban(g, c):
    for i, t in enumerate(("TO DO", "DOING", "DONE")):
        x = -170 + i * 118
        g.rr(x, -140, x + 104, 140, 12, fill=c.C, out=c.A, w=6); g.tx(x + 52, -112, t, 18, c.A)
        for j in range((3, 2, 2)[i]):
            hl = (i, j) == (1, 0)
            g.rr(x + 10, -85 + j * 66, x + 94, -30 + j * 66, 7, fill=c.B if hl else c.D, out=c.A, w=4)
    g.arrow((-70, 170), (80, 170), 6, c.B, 20)
    g.arc(0, 130, 45, 0, 0, c.A, 1)

def blocks(g, c):
    xs = (-150, -50, 50, 150)
    for i, x in enumerate(xs):
        y = -30 if i % 2 == 0 else 40
        g.rr(x - 44, y - 55, x + 44, y + 55, 10, fill=c.B if i == 3 else c.C, out=c.A, w=7)
        g.line([(x - 26, y - 25), (x + 26, y - 25)], 6, c.A); g.line([(x - 26, y), (x + 14, y)], 6, c.A); g.tx(x, y + 32, "#a3f", 17, c.A if i != 3 else c.D)
        if i < 3: g.line([(x + 44, y), (xs[i + 1] - 44, (-30 if (i + 1) % 2 == 0 else 40))], 8, c.A)

def cloud(g, c, lam=False, arrows=True):
    for (x, y, r) in ((-75, 10, 70), (5, -45, 90), (85, 0, 65)): g.el(x, y, r, fill=c.C)
    g.rr(-135, 0, 150, 75, 36, fill=c.C)
    g.arc(-75, 10, 70, 100, 270, c.A, 11); g.arc(5, -45, 90, 190, 350, c.A, 11); g.arc(85, 0, 65, 270, 80, c.A, 11)
    g.line([(-75, 80), (85, 65)], 11, c.A)
    if lam:
        g.tx(5, 12, "\u03bb", 120, c.B)
    elif arrows:
        g.arrow((-40, 165), (-40, 108), 9, c.B, 24); g.arrow((40, 108), (40, 165), 9, c.A, 24)

def kube(g, c):
    g.el(0, 0, 120, fill=c.C, out=c.A, w=11); g.el(0, 0, 36, fill=c.B)
    for i in range(7):
        a = math.radians(-90 + i * 360 / 7)
        g.line([(36 * math.cos(a), 36 * math.sin(a)), (120 * math.cos(a), 120 * math.sin(a))], 9, c.A)
        g.el(150 * math.cos(a), 150 * math.sin(a), 22, fill=c.D, out=c.B, w=8)

def eye(g, c):
    g.pg(ellpts(0, 0, 175, 95, 0, 80), fill=c.C, out=c.A, w=11)
    g.el(0, 0, 56, fill=c.D, out=c.B, w=12); g.el(0, 0, 20, fill=c.B)
    g.line([(-140, 130), (140, -130)], 14, c.B)
    g.tx(0, 160, "GDPR", 32, c.A)

def cylinder(g, c, rows=3):
    for i in range(rows):
        y = -70 + i * 85
        g.pg(ellpts(0, y + 50, 130, 34, 0, 60)[:], fill=c.C, out=c.A, w=8)
        g.rr(-130, y, 130, y + 50, 0, fill=c.C)
        g.line([(-130, y), (-130, y + 50)], 8, c.A); g.line([(130, y), (130, y + 50)], 8, c.A)
        g.pg(ellpts(0, y, 130, 34, 0, 60), fill=c.C, out=c.A, w=8)
    g.el(90, -70 + 0, 0)
    for i in range(rows): g.el(80, -42 + i * 85 + 8, 8, fill=c.B)

def neural(g, c, layers=(3, 5, 5, 2)):
    xs = [-170 + i * 340 / (len(layers) - 1) for i in range(len(layers))]
    pos = []
    for x, n in zip(xs, layers):
        pos.append([(x, (-(n - 1) / 2 + j) * (300 / max(layers)) * 0.95 if n > 1 else 0) for j in range(n)])
    for a, b in zip(pos, pos[1:]):
        for p in a:
            for q in b: g.line([p, q], 2, (255, 255, 255, 60) if False else c.C)
    for li, layer in enumerate(pos):
        for j, p in enumerate(layer): g.el(*p, 20, fill=c.B if (li + j) % 3 == 0 else c.D, out=c.A, w=6)

def scatter(g, c):
    g.line([(-170, 140), (-170, -150)], 8, c.A); g.line([(-170, 140), (180, 140)], 8, c.A)
    import random
    r = random.Random(7)
    for i in range(16):
        x = -140 + i * 20; y = 110 - i * 14 + r.randint(-45, 45)
        g.el(x, y, 10, fill=c.B if i % 5 == 0 else c.A)
    g.line([(-150, 120), (170, -120)], 9, c.B)
    g.tx(60, 90, "y = wx + b", 26, c.A)

def infinity(g, c):
    pts = [(190 * math.cos(t) / (1 + math.sin(t) ** 2), 190 * math.sin(t) * math.cos(t) / (1 + math.sin(t) ** 2) * 1.4) for t in [i * math.pi * 2 / 120 for i in range(121)]]
    g.line(pts[:60], 18, c.A); g.line(pts[60:], 18, c.B)
    g.tx(-105, 0, "DEV", 30, c.A); g.tx(105, 0, "OPS", 30, c.B)
    g.arrow((60, -100), (100, -70), 1, c.B, 1)
    g.tx(0, 135, "plan · build · ship · run", 24, c.A)

def bolt(g, c):
    g.pg([(30, -170), (-100, 20), (-10, 20), (-40, 170), (110, -40), (10, -40)], fill=c.B, out=c.A, w=8)
    for i, y in enumerate((-80, -20, 40)): g.line([(-180, y), (-130 + i * 10, y)], 9, c.A)
    g.tx(130, 120, "ms", 44, c.A)

def phone(g, c):
    g.rr(-110, -165, 50, 165, 30, fill=c.C, out=c.A, w=10)
    for r in range(3):
        for q in range(3): g.rr(-90 + q * 46, -120 + r * 52, -60 + q * 46, -92 + r * 52, 8, fill=c.B if (r + q) % 4 == 0 else c.A)
    g.rr(-60, 100, -0, 112, 6, fill=c.A)
    g.rr(75, -100, 175, 100, 20, out=c.B, w=8); g.tx(125, 0, "</>", 36, c.B)
    g.arrow((55, 130), (150, 130), 6, c.B, 18)

def topology(g, c):
    nodes = [(-150, -90), (150, -90), (-170, 40), (170, 40), (-60, 140), (60, 140)]
    for p in nodes: g.line([(0, 0), p], 6, c.A)
    g.rr(-45, -35, 45, 35, 10, fill=c.B); 
    for x in (-25, 0, 25): g.el(x, 0, 6, fill=c.D)
    for i, p in enumerate(nodes): g.rr(p[0] - 32, p[1] - 24, p[0] + 32, p[1] + 24, 6, fill=c.C, out=c.A, w=6)
    for p in (( -75, -45), (80, -45), (-90, 20), (90, 20)): g.rr(p[0] - 7, p[1] - 7, p[0] + 7, p[1] + 7, 2, fill=c.B)
    g.el(0, -145, 24, out=c.A, w=6)

def layers(g, c, labels=("APPS", "KERNEL", "HARDWARE")):
    cols = (c.B, c.C, c.C)
    for i, t in enumerate(labels):
        y = -140 + i * 100
        g.pg([(-170, y + 30), (0, y - 20), (170, y + 30), (0, y + 80)], fill=cols[i % 3], out=c.A, w=7)
        g.tx(0, y + 30, t, 24, c.D if i == 0 else c.A)
    for p in ((-130, -40), (-100, 30)): g.el(*p, 0)

def sysdesign(g, c):
    g.el(-165, 0, 28, out=c.A, w=7); g.tx(-165, 0, "U", 26, c.A)
    g.pg([(-95, 0), (-55, -40), (-15, 0), (-55, 40)], fill=c.B, out=c.B, w=2); g.tx(-55, 0, "LB", 20, c.D)
    g.line([(-137, 0), (-95, 0)], 6, c.A)
    for i, y in enumerate((-100, 0, 100)):
        g.line([(-15, 0), (40, y)], 5, c.A); g.rr(40, y - 30, 100, y + 30, 8, fill=c.C, out=c.A, w=6)
        g.line([(100, y), (130, 0)], 5, c.A)
    g.pg(ellpts(160, -20, 30, 12, 0, 40), fill=c.C, out=c.A, w=5); g.rr(130, -20, 190, 40, 0, fill=c.C); g.line([(130, -20), (130, 40)], 5, c.A); g.line([(190, -20), (190, 40)], 5, c.A)
    g.pg(ellpts(160, 40, 30, 12, 0, 40), out=c.A, w=5)
    g.tx(0, 150, "×1,000,000", 36, c.B)

def briefcase(g, c):
    g.rr(-60, -135, 60, -85, 14, out=c.A, w=10)
    g.rr(-165, -95, 165, 115, 22, fill=c.C, out=c.A, w=10)
    g.line([(-165, -5), (165, -5)], 8, c.A); g.rr(-25, -25, 25, 15, 6, fill=c.B)
    g.rr(-110, 140, 110, 170, 8, out=c.B, w=1)
    g.line([(-100, 150), (-40, 150)], 8, c.B); g.line([(-20, 150), (50, 150)], 8, c.A)

def pyramid(g, c):
    g.pg([(0, -160), (-70, -40), (70, -40)], fill=c.B, out=c.A, w=8)
    g.pg([(-80, -30), (80, -30), (130, 50), (-130, 50)], fill=c.C, out=c.A, w=8)
    g.pg([(-140, 60), (140, 60), (190, 150), (-190, 150)], fill=c.C, out=c.A, w=8)
    g.tx(0, -75, "E2E", 24, c.D); g.tx(0, 10, "INTEGRATION", 24, c.A); g.tx(0, 105, "UNIT", 34, c.A)

def wire(g, c):
    g.rr(-175, -135, 175, 135, 18, out=c.A, w=9)
    g.rr(-150, -110, 30, 10, 8, out=c.A, w=5); g.line([(-150, -110), (30, 10)], 4, c.A); g.line([(-150, 10), (30, -110)], 4, c.A)
    for i in range(3): g.line([(60, -100 + i * 30), (150, -100 + i * 30)], 7, c.A)
    g.rr(-150, 40, -30, 95, 12, fill=c.B); g.rr(-10, 40, 90, 95, 12, out=c.A, w=6)
    g.pg([(105, 30), (105, 100), (125, 82), (145, 112), (158, 104), (138, 76), (165, 74)], fill=c.A, out=c.D, w=3)

def browser(g, c):
    g.rr(-180, -135, 180, 135, 20, fill=c.C, out=c.A, w=9)
    g.line([(-180, -85), (180, -85)], 7, c.A); g.rr(-110, -118, 150, -96, 10, out=c.A, w=4)
    for x in (-155, -135): g.el(x, -108, 7, fill=c.B)
    g.tx(-85, -35, "<html>", 30, c.A, anchor="lm"); g.tx(-55, 5, "{css}", 30, c.B, anchor="lm"); g.tx(-85, 45, "js()", 30, c.A, anchor="lm")
    g.line([(-150, -60), (-150, 70)], 4, c.A); g.rr(60, 60, 160, 110, 10, fill=c.B)

def team_cycle(g, c):  # agile sprint loop
    g.arc(0, 0, 130, 30, 330, c.A, 14); 
    g.pg([(113, -65), (160, -75), (140, -30)], fill=c.A, out=c.A, w=2)
    g.arc(0, 0, 75, 200, 520 % 360 + 360, c.B, 10)
    g.tx(0, 0, "SPRINT", 28, c.A)
    for a in (-80, 40, 160): 
        r = math.radians(a); g.el(130 * math.cos(r), 130 * math.sin(r), 18, fill=c.B)

MOTIFS = {k: v for k, v in globals().items() if callable(v) and k not in ("G", "P", "rot", "ellpts", "gear", "find_font")}
