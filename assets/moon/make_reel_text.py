"""Draw the Mid-Autumn reel text overlays (1080x1920 RGBA PNGs)."""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = sys.argv[1]
W, H = 1080, 1920
ZH = "fonts/龍門石碑.TTC"
EN = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
GOLD, WHITE = (236, 205, 140), (250, 246, 236)

def block(lines, name):
    im = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(im)
    for text, font, size, color, y, track in lines:
        f = ImageFont.truetype(font, size)
        ws = [d.textlength(c, font=f) for c in text]
        tw = sum(ws) + track * (len(text) - 1)
        x = (W - tw) / 2
        for c, w in zip(text, ws):
            d.text((x, y), c, font=f, fill=color); x += w + track
    glow = im.copy().filter(ImageFilter.GaussianBlur(10))
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0)); shadow.putalpha(glow.getchannel("A").point(lambda a: a * 0.8))
    Image.alpha_composite(shadow, im).save(f"{OUT}/{name}.png")

block([("2026  MID-AUTUMN FESTIVAL", EN, 34, GOLD, 250, 6),
       ("中秋連假", ZH, 118, WHITE, 300, 14),
       ("特別加開公告", ZH, 72, GOLD, 440, 18)], "top")
block([("9/27 SUN.  00:30", EN, 88, GOLD, 1400, 4),
       ("週日 ／ 00:30", ZH, 56, WHITE, 1510, 10),
       ("Long Weekend Special Addition", EN, 34, WHITE, 1600, 3)], "bottom")
