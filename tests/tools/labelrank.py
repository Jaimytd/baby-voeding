"""Tekent per thema het rankje dat om het naam-en-leeftijdlabel heen groeit en zet het als
CSS-variabele --t-rank in styles.css (blok tussen de markeringen). Draaien vanuit de repo-map:
python3 tests/tools/labelrank.py
"""
import math, re, urllib.parse

SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 60'>{}</svg>"
enc = lambda s: 'url("data:image/svg+xml,' + urllib.parse.quote(s, safe="/:=' ,.") + '")'

def blad(x, y, r, k, s=1.0):
    return (f"<g transform='translate({x} {y}) rotate({r}) scale({s})'>"
            f"<path d='M0 -9C-5 -5 -6 1 -4 5c1 2 3 3 4 5 1-2 3-3 4-5 2-4 1-10-4-14z' fill='{k}'/>"
            f"<path d='M0 -7v11' stroke='#fff' stroke-width='.7' opacity='.5'/></g>")
def eikel(x, y, s=1.0):
    return (f"<g transform='translate({x} {y}) scale({s})'><path d='M0 -6v-2' stroke='#78350f' stroke-width='1.5'/>"
            f"<path d='M-5 -4q5-3 10 0v2h-10z' fill='#78350f'/><path d='M-4 -2h8c0 5-2 8-4 9-2-1-4-4-4-9z' fill='#b45309'/></g>")
def bal(x, y, k, s=1.0):
    return (f"<g transform='translate({x} {y}) scale({s})'><path d='M0 -14v-14' stroke='#a8a29e' stroke-width='.8'/>"
            f"<rect x='-2' y='-16' width='4' height='3' rx='.8' fill='#a8a29e'/><circle r='6' fill='{k}'/>"
            f"<circle cx='-2' cy='-2' r='1.6' fill='#fff' opacity='.5'/></g>")
def hulst(x, y, r, s=1.0):
    return (f"<g transform='translate({x} {y}) rotate({r}) scale({s})'>"
            f"<path d='M0 0C-4 0 -9 -1 -12 -6c3 1 4 -1 6 -1-1 -2 1 -3 1 -5 3 3 6 7 5 12z' fill='#15803d'/>"
            f"<path d='M0 0c4 0 9 -1 12 -6-3 1-4 -1-6 -1 1-2-1-3-1-5-3 3-6 7-5 12z' fill='#166534'/>"
            f"<circle cx='-2' cy='1' r='2' fill='#dc2626'/><circle cx='2' cy='1' r='2' fill='#dc2626'/><circle cx='0' cy='-2' r='2' fill='#b91c1c'/></g>")
def web_hoek(x, y, flip=False):
    sc = "scale(-1 1)" if flip else ""
    lijnen = "".join(f"<path d='M0 0L{34*math.cos(math.radians(a)):.1f} {34*math.sin(math.radians(a)):.1f}'/>" for a in (0, 22, 45, 68, 90))
    bogen = "".join(f"<path d='M{R} 0" + "".join(f"Q{R*0.86*math.cos(math.radians(a-11)):.1f} {R*0.86*math.sin(math.radians(a-11)):.1f} {R*math.cos(math.radians(a)):.1f} {R*math.sin(math.radians(a)):.1f}" for a in (22, 45, 68, 90)) + "'/>" for R in (12, 22, 32))
    return f"<g transform='translate({x} {y}) {sc}' fill='none' stroke='#8a8079' stroke-width='.8'>{lijnen}{bogen}</g>"
def spin(x, y, s=1.0, k="#2a1f1a"):
    return (f"<g transform='translate({x} {y}) scale({s})'><path d='M0 -14V-4' stroke='#8a8079' stroke-width='.6'/>"
            f"<ellipse cy='2' rx='3' ry='3.6' fill='{k}'/><circle cy='-2.5' r='2.2' fill='{k}'/>"
            f"<g stroke='{k}' stroke-width='.9' fill='none'><path d='M-3 0l-4-3M-3 2h-5M-3 4l-4 3M3 0l4-3M3 2h5M3 4l4 3'/></g></g>")
def bloesem(x, y, s=1.0, k="#f9a8d4"):
    return (f"<g transform='translate({x} {y}) scale({s})'>" + "".join(f"<circle cx='{4.2*math.cos(math.radians(a)):.1f}' cy='{4.2*math.sin(math.radians(a)):.1f}' r='3.2' fill='{k}'/>" for a in (0, 72, 144, 216, 288)) + "<circle r='2' fill='#fde047'/></g>")
def bij(x, y, s=1.0):
    return (f"<g transform='translate({x} {y}) scale({s})'><ellipse cx='-3' cy='-4' rx='4' ry='2.5' fill='#bfdbfe' opacity='.9'/><ellipse cx='3' cy='-4' rx='4' ry='2.5' fill='#bfdbfe' opacity='.9'/>"
            f"<ellipse rx='4.5' ry='3' fill='#facc15'/><path d='M-2 -2.5v5M0 -3v6M2 -2.5v5' stroke='#1c1917' stroke-width='1.2'/></g>")
def vlok(x, y, s=1.0, k="#93c5fd"):
    return (f"<g transform='translate({x} {y}) scale({s})' stroke='{k}' stroke-width='1.4' stroke-linecap='round'>"
            f"<path d='M0 -7v14M-6 -3.5l12 7M-6 3.5l12-7'/></g>")
def pepernoot(x, y, s=1.0):
    return f"<g transform='translate({x} {y}) scale({s})'><ellipse rx='5' ry='3.6' fill='#92400e'/><ellipse cy='-.8' rx='4.4' ry='2.7' fill='#b45309'/></g>"
def mijter(x, y, s=1.0):
    return (f"<g transform='translate({x} {y}) scale({s})'><path d='M0 -12C-4 -8 -5 -3 -5 4h10C5 -3 4 -8 0 -12z' fill='#dc2626'/>"
            f"<path d='M0 -8v9M-3 -3h6' stroke='#facc15' stroke-width='1.4'/><rect x='-5.5' y='3' width='11' height='2.2' rx='.8' fill='#facc15'/></g>")
def ei(x, y, r, k1, k2, s=1.0):
    return (f"<g transform='translate({x} {y}) rotate({r}) scale({s})'><path d='M0 -7C-3.5 -7 -5.5 -1 -5.5 3a5.5 5.5 0 0 0 11 0C5.5 -1 3.5 -7 0 -7z' fill='{k1}'/>"
            f"<path d='M-4.5 0q4.5 2 9 0M-4 4q4-2 8 0' stroke='{k2}' stroke-width='1.3' fill='none'/></g>")
def zon(x, y, s=1.0):
    stralen = "".join(f"<path d='M{10*math.cos(math.radians(a)):.1f} {10*math.sin(math.radians(a)):.1f}L{14*math.cos(math.radians(a)):.1f} {14*math.sin(math.radians(a)):.1f}'/>" for a in range(0, 360, 45))
    return f"<g transform='translate({x} {y}) scale({s})'><g stroke='#f59e0b' stroke-width='2' stroke-linecap='round'>{stralen}</g><circle r='7' fill='#fbbf24'/></g>"
def schelp(x, y, s=1.0):
    return (f"<g transform='translate({x} {y}) scale({s})'><path d='M0 6C-6 6 -8 1 -7 -3l7-4 7 4c1 4-1 9-7 9z' fill='#fbcfe8'/>"
            f"<path d='M0 -7v13M0 6l-5-8M0 6l5-8' stroke='#f472b6' stroke-width='.8' opacity='.7'/></g>")
def ballon(x, y, k, s=1.0):
    return (f"<g transform='translate({x} {y}) scale({s})'><path d='M0 -12C-4.5 -12 -6 -7.5 -6 -4.5c0 3.8 3 7.5 6 9 3-1.5 6-5.2 6-9 0-3-1.5-7.5-6-7.5z' fill='{k}'/>"
            f"<path d='M-1.5 4.5l1.5 1.5 1.5-1.5z' fill='{k}'/><path d='M0 6q-1.5 3 0 6' stroke='#78716c' stroke-width='.7' fill='none'/></g>")
def snipper(x, y, r, k):
    return f"<rect x='{x}' y='{y}' width='4' height='6' rx='1' fill='{k}' transform='rotate({r} {x+2} {y+3})'/>"

# Het label beslaat ongeveer x 8..192, y 16..44. Elementen hangen over de randen heen.
RANKEN = {
    "herfst": ("<path d='M-4 44C14 30 20 14 44 8' stroke='#78350f' stroke-width='2' fill='none'/>"
               + blad(14, 28, -30, "#ea580c") + blad(30, 14, 20, "#ca8a04", .9) + blad(44, 8, 60, "#dc2626", .8)
               + eikel(186, 48, .9) + blad(197, 40, 40, "#ea580c", .8)),
    "kerst": (hulst(14, 16, -20, 1.1) + bal(192, 46, "#dc2626", .9) + bal(178, 10, "#ca8a04", .7)),
    "halloween": (web_hoek(0, 10) + spin(188, 46, .9) + "<path d='M196 0V34' stroke='#8a8079' stroke-width='.6'/>"),
    "lente": ("<path d='M-4 40C12 30 18 16 40 10' stroke='#7c4a22' stroke-width='1.8' fill='none'/>"
              + bloesem(14, 30) + bloesem(28, 18, .85) + bloesem(40, 10, .7) + bij(186, 48, .9)),
    "winter": (vlok(10, 14, 1.3) + vlok(26, 8, .8) + vlok(190, 46, 1.1) + vlok(198, 30, .7, "#bfdbfe")),
    "zomer": (zon(10, 12, 1) + schelp(190, 46, .9)),
    "sinterklaas": (pepernoot(10, 14) + pepernoot(22, 8, .8) + pepernoot(16, 24, .7) + mijter(190, 46, .85)),
    "pasen": (ei(12, 16, -20, "#f9a8d4", "#fff") + ei(26, 10, 15, "#93c5fd", "#fde047", .8) + bloesem(190, 46, .9, "#fde047")),
    "verjaardag": (ballon(12, 14, "#f472b6") + ballon(26, 8, "#60a5fa", .8) + snipper(184, 42, 20, "#facc15") + snipper(192, 48, -30, "#4ade80") + snipper(176, 50, 50, "#f472b6")),
}
blok = "/* --- rankjes om het naam-en-leeftijdlabel (gemaakt met tests/tools/labelrank.py) --- */\n"
for naam, inhoud in RANKEN.items():
    blok += f'body[data-thema="{naam}"] {{ --t-rank: {enc(SVG.format(inhoud))}; }}\n'
blok += "/* --- einde rankjes --- */\n"

pad = "styles.css"
s = open(pad).read()
s = re.sub(r"/\* --- rankjes om het naam-en-leeftijdlabel.*?/\* --- einde rankjes --- \*/\n", "", s, flags=re.S)
s += "\n" + blok
open(pad, "w").write(s)
print("rankjes geschreven voor:", ", ".join(RANKEN))
