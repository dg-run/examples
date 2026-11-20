"""Generates the PWA icons (run once: `npm run icons`). Requires Pillow."""
from PIL import Image, ImageDraw
import os

os.makedirs('public/icons', exist_ok=True)
BG, FG = (23, 23, 23), (255, 255, 255)

def icon(size, maskable=False):
    S = 4  # supersample for smooth edges
    n = size * S
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, n, n], fill=BG)            # full bleed; the OS applies its own mask
        scale = 0.46                                   # keep the glyph inside the 80% safe zone
    else:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * 0.22), fill=BG)
        scale = 0.58
    c, r = n / 2, n * scale / 2
    pts = [(c - r * 0.78, c + r * 0.02), (c - r * 0.18, c + r * 0.60), (c + r * 0.82, c - r * 0.52)]
    d.line(pts, fill=FG, width=int(n * 0.085), joint='curve')
    for x, y in (pts[0], pts[2]):
        w = n * 0.085 / 2
        d.ellipse([x - w, y - w, x + w, y + w], fill=FG)
    return img.resize((size, size), Image.LANCZOS)

icon(192).save('public/icons/icon-192.png')
icon(512).save('public/icons/icon-512.png')
icon(512, maskable=True).save('public/icons/icon-maskable-512.png')
icon(180, maskable=True).save('public/icons/apple-touch-icon.png')  # iOS rounds it itself
print('icons written')
