"""Draw the 256x256 Thunderstore icon (same mark as the website favicon) with no dependencies.

Usage: python3 mod/tools/make-icon.py mod/thunderstore/icon.png
"""
import math
import struct
import sys
import zlib

SIZE = 256
BG = (20, 17, 15)
ORANGE = (255, 122, 26)


def pixel(x, y):
    # coordinates in the favicon's 64-unit space
    u, v = (x + 0.5) * 64 / SIZE, (y + 0.5) * 64 / SIZE
    # rounded square background (radius 14)
    dx, dy = max(14 - u, 0, u - 50), max(14 - v, 0, v - 50)
    if dx * dx + dy * dy > 14 * 14:
        return (0, 0, 0, 0)
    d = math.hypot(u - 32, v - 32)
    if abs(d - 18) <= 2.5 or d <= 6:  # ring + centre dot
        return ORANGE + (255,)
    # crosshair ticks
    if (abs(u - 32) <= 2 and (6 <= v <= 14 or 50 <= v <= 58)) or (abs(v - 32) <= 2 and (6 <= u <= 14 or 50 <= u <= 58)):
        return ORANGE + (255,)
    return BG + (255,)


def main(out):
    rows = b"".join(b"\x00" + bytes(c for x in range(SIZE) for c in pixel(x, y)) for y in range(SIZE))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")
    with open(out, "wb") as f:
        f.write(png)


if __name__ == "__main__":
    main(sys.argv[1])
