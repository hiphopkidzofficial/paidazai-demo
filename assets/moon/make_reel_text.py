"""Draw the Mid-Autumn reel text overlay (1080x1920 RGBA PNG), all text in the lower third."""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = sys.argv[1]
W, H = 1080, 1920
ZH = "fonts/龍門石碑.TTC"
EN = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
EMOJI = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
GOLD, WHITE = (236, 205, 140), (250, 246, 236)

im = Image.new("RGBA", (W, H))
d = ImageDraw.Draw(im)
efont = ImageFont.truetype(EMOJI, 109)

def emoji(ch, size):
    g = Image.new("RGBA", (136, 128))
    ImageDraw.Draw(g).text((0, 0), ch, font=efont, embedded_color=True)
    g = g.crop(g.getbbox())
    return g.resize((size, round(g.height * size / g.width)), Image.LANCZOS)

def line(parts, y, track=0):
    """parts: list of (text, font_path|None for emoji, size, color)."""
    items = []
    for text, fp, size, color in parts:
        if fp is None:
            e = emoji(text, size); items.append(("img", e, e.width, size, color)); continue
        f = ImageFont.truetype(fp, size)
        for c in text: items.append(("ch", (c, f), d.textlength(c, font=f), size, color))
    tw = sum(i[2] for i in items) + track * (len(items) - 1)
    x = (W - tw) / 2
    for kind, obj, w, size, color in items:
        if kind == "img": im.alpha_composite(obj, (round(x), round(y + size * 0.1)))
        else: d.text((x, y + (size * 0.14 if obj[1].path == ZH else 0)), obj[0], font=obj[1], fill=color)
        x += w + track

line([("🌕", None, 50, None), (" 2026 中秋連假｜特別加開公告", ZH, 52, WHITE)], 1265, 3)
line([("9/27 Sun. ", EN, 78, GOLD), ("週日", ZH, 72, GOLD), (" / 00:30", EN, 78, GOLD)], 1350, 2)
d.line([(W / 2 - 150, 1468), (W / 2 + 150, 1468)], fill=GOLD + (150,), width=2)
line([("🥮", None, 34, None), (" 2026 Mid-Autumn Festival", EN, 36, WHITE)], 1495, 2)
line([("Long Weekend Special Addition:", EN, 34, WHITE)], 1545, 2)
line([("9/27 Sun. 00:30", EN, 46, GOLD)], 1597, 3)

glow = im.filter(ImageFilter.GaussianBlur(10)).getchannel("A").point(lambda a: a * 0.85)
shadow = Image.new("RGBA", (W, H)); shadow.putalpha(glow)
Image.alpha_composite(shadow, im).save(f"{OUT}/text.png")
