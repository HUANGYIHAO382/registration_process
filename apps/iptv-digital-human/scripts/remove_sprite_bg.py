"""
边缘洪水填充抠透明底：只去掉「与四边连通」的背景，不伤角色内部暗毛。
"""
from __future__ import annotations

import math
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "public" / "sprites" / "anan-hd-cat"
OUT_DIR = SRC_DIR

# 与背景色的最大色距（越大抠得越狠）
THRESH = 48


def dist(a, b) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def sample_edge_color(px, w, h):
    pts = [
        (1, 1),
        (w - 2, 1),
        (1, h - 2),
        (w - 2, h - 2),
        (w // 2, 1),
        (1, h // 2),
        (w - 2, h // 2),
    ]
    samples = [px[x, y][:3] for x, y in pts]
    rs = sorted(s[0] for s in samples)
    gs = sorted(s[1] for s in samples)
    bs = sorted(s[2] for s in samples)
    m = len(samples) // 2
    return (rs[m], gs[m], bs[m])


def remove_bg(path: Path, out: Path) -> None:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    bg = sample_edge_color(px, w, h)

    visited = [[False] * w for _ in range(h)]
    q = deque()

    def try_seed(x, y):
        if 0 <= x < w and 0 <= y < h and not visited[y][x]:
            if dist(px[x, y][:3], bg) <= THRESH:
                visited[y][x] = True
                q.append((x, y))

    for x in range(w):
        try_seed(x, 0)
        try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y)
        try_seed(w - 1, y)

    while q:
        x, y = q.popleft()
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                if dist(px[nx, ny][:3], bg) <= THRESH:
                    visited[ny][nx] = True
                    q.append((nx, ny))

    # 轻柔边缘：邻接透明的像素略降 alpha，减轻毛边
    src = im.copy()
    sp = src.load()
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if sp[x, y][3] == 0:
                continue
            near = 0
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if sp[nx, ny][3] == 0:
                    near += 1
            if near >= 2 and dist(sp[x, y][:3], bg) < THRESH + 30:
                r, g, b, a = sp[x, y]
                px[x, y] = (r, g, b, max(0, a // 2))

    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "PNG")
    print(f"OK {path.name} -> {out.name} bg≈{tuple(int(c) for c in bg)}")


def main():
    mapping = {
        "body-idle-1.jpg": "body-idle-1.png",
        "body-idle-2.jpg": "body-idle-2.png",
        "body-listen.jpg": "body-listen.png",
        "body-alert.jpg": "body-alert.png",
        "mouth-sil.jpg": "mouth-sil.png",
        "mouth-a.jpg": "mouth-a.png",
        "mouth-o.jpg": "mouth-o.png",
        "mouth-m.jpg": "mouth-m.png",
    }
    for src_name, out_name in mapping.items():
        src = SRC_DIR / src_name
        if not src.exists():
            print(f"SKIP {src_name}")
            continue
        remove_bg(src, OUT_DIR / out_name)


if __name__ == "__main__":
    main()
