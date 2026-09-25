"""Render (with enhanced 3D shading for phone viewing) a seamless-looping, alpha-transparent rotating moon from a single full-moon photo.

The photo only shows the near side, so instead of inventing a far side (which would
duplicate craters), the moon turns slowly about its vertical axis in a smooth
libration-style sway (sine) that returns exactly to frame 0 for a perfect loop.
"""
import subprocess, sys
import numpy as np
from PIL import Image
import imageio_ffmpeg

SRC = sys.argv[1]
OUT_W, OUT_H, FPS, SECONDS = 2160, 3840, 24, 15
DIAM = 1720                       # moon diameter on the 4K canvas
MAX_DEG = 14                      # peak rotation angle
CX, CY, R = 424.5, 617.5, 286.0   # moon disk in the source photo

src = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32)
H, W, _ = src.shape
from PIL import ImageFilter
_im = Image.fromarray(src.astype(np.uint8))
src = np.asarray(_im.filter(ImageFilter.UnsharpMask(radius=2, percent=90, threshold=0))).astype(np.float32)
lum = np.asarray(Image.fromarray(src.mean(2).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
gy, gx = np.gradient(lum)
bump = np.stack([gx, gy, np.zeros_like(gx)], -1) * 4.0  # surface relief (px-space slope)

# Output sphere coordinates (crop to the moon's bounding box, pad later).
pad = 4
n = DIAM + 2 * pad
g = (np.arange(n) + 0.5 - n / 2) / (DIAM / 2)
x, y = np.meshgrid(g, g)
rr = np.sqrt(x * x + y * y)
alpha = np.clip((1.0 - rr) * (DIAM / 2) / 1.2 + 0.5, 0, 1)  # ~1px antialiased edge
inside = rr < 1.0 + 2 / DIAM
z = np.sqrt(np.clip(1 - x * x - y * y, 0, 1))

def _sample(img, px, py):
    x0 = np.floor(px).astype(int); y0 = np.floor(py).astype(int)
    fx = (px - x0)[..., None]; fy = (py - y0)[..., None]
    x0 = np.clip(x0, 0, W - 2); y0 = np.clip(y0, 0, H - 2)
    a = img[y0, x0]; b = img[y0, x0 + 1]; c = img[y0 + 1, x0]; d = img[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

def sample(px, py): return _sample(src, px, py)
sample.__wrapped__ = _sample
frames = FPS * SECONDS
out_x0 = (OUT_W - n) // 2
out_y0 = (OUT_H - n) // 2
ff = imageio_ffmpeg.get_ffmpeg_exe()
proc = subprocess.Popen([ff, "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{OUT_W}x{OUT_H}",
    "-r", str(FPS), "-i", "-", "-c:v", "png", "-f", "mov", sys.argv[2]], stdin=subprocess.PIPE)

canvas = np.zeros((OUT_H, OUT_W, 4), np.uint8)
for i in range(frames):
    th = np.radians(MAX_DEG) * np.sin(2 * np.pi * i / frames)
    # Inverse-rotate view point about the vertical axis to find the source surface point.
    sx = x * np.cos(th) - z * np.sin(th)
    sz = x * np.sin(th) + z * np.cos(th)
    # Points rotated onto the unseen hemisphere: reflect back onto the limb (tiny sliver).
    s = np.sqrt(np.clip(1 - y * y, 1e-6, 1))
    sx = np.where(sz < 0, np.sign(sx) * s, sx)
    rs = R - 1.0  # stay inside the disk so no black sky is sampled
    rgb = sample(CX + sx * rs, CY + y * rs)
    # 3D shading: key light upper-left-front, soft fill, limb darkening, bump relief.
    b = sample.__wrapped__(bump, CX + sx * rs, CY + y * rs)
    nx, ny, nz = x - b[..., 0], y - b[..., 1], z + 0.0
    nn = np.sqrt(nx * nx + ny * ny + nz * nz) + 1e-6
    L = np.array([-0.45, -0.35, 0.82]); L /= np.linalg.norm(L)
    lam = np.clip((nx * L[0] + ny * L[1] + nz * L[2]) / nn, 0, 1)
    shade = 0.22 + 0.95 * lam ** 1.15          # key + ambient
    shade *= 0.55 + 0.45 * z ** 0.35            # limb darkening -> spherical volume
    rim = np.clip(1 - z, 0, 1) ** 6 * np.clip(-(x * L[0] + y * L[1]) * 1.4, 0, 1) * 0.10
    rgb = rgb * shade[..., None] * 1.12 + rim[..., None] * 255
    tile = np.zeros((n, n, 4), np.float32)
    tile[..., :3] = rgb
    tile[..., 3] = alpha * 255 * inside
    canvas[out_y0:out_y0 + n, out_x0:out_x0 + n] = np.clip(tile, 0, 255).astype(np.uint8)
    proc.stdin.write(canvas.tobytes())
    if i % 48 == 0: print(f"frame {i}/{frames}", flush=True)
proc.stdin.close(); proc.wait()
