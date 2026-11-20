# Draws the three PNG icons (no dependencies): python3 scripts/icons.py. They are committed, so you only need this to change the look.
import zlib, struct, math
def png(path, size, maskable=False):
    W = H = size
    teal, teal2, white = (0, 116, 124), (0, 160, 168), (255, 255, 255)
    r = 0 if maskable else size * 0.22  # maskable icons are full-bleed: the OS applies its own mask
    def inside(x, y):
        if maskable: return True
        cx = min(max(x, r), W - 1 - r); cy = min(max(y, r), H - 1 - r)
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    s = 0.6 if maskable else 0.66  # the glyph stays inside the maskable safe zone
    x0, x1 = W * (0.5 - s / 2), W * (0.5 + s / 2); y0, y1 = H * (0.5 - s * 0.42), H * (0.5 + s * 0.42)
    sw = size * 0.07
    def dist(x, y, ax, ay, bx, by):
        dx, dy = bx - ax, by - ay
        t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
        return math.hypot(x - (ax + t * dx), y - (ay + t * dy))
    segs = [(x0 + (x1 - x0) * (i + 0.5) / 4 * 0.92 + (x1 - x0) * 0.02,) for i in range(4)]
    segs = [(x, y0, x, y1) for (x,) in segs] + [(x0 - sw * 0.2, y1 - (y1 - y0) * 0.12, x1 + sw * 0.2, y0 + (y1 - y0) * 0.12)]
    rows = []
    for y in range(H):
        row = bytearray([0])
        for x in range(W):
            if not inside(x + 0.5, y + 0.5): row += bytes((0, 0, 0, 0)); continue
            t = (x + y) / (W + H)
            c = tuple(int(teal[k] + (teal2[k] - teal[k]) * t) for k in range(3))
            d = min(dist(x + 0.5, y + 0.5, *sg) for sg in segs)
            a = max(0, min(1, (sw / 2 + 0.7 - d) / 1.4))
            row += bytes(tuple(int(c[k] * (1 - a) + white[k] * a) for k in range(3)) + (255,))
        rows.append(bytes(row))
    def chunk(t, d): c = struct.pack('>I', len(d)) + t + d; return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b''))
png('site/icons/icon-192.png', 192); png('site/icons/icon-512.png', 512); png('site/icons/icon-maskable-512.png', 512, True)
