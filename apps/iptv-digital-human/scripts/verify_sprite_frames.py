"""
精灵帧一致性校验（纯标准库，无需 PIL）

用途：每批新帧落地后跑一次，防止「构图漂移」——
数字人嘴型是整图替换 + 220ms 交叉淡入（见 SpriteAvatarEngine），
任何一帧的重心/底边/缩放与基准不同，切换时都会"跳一下"。

用法：
    python scripts/verify_sprite_frames.py public/sprites/reference-for-ai
    python scripts/verify_sprite_frames.py public/sprites/anan-hd-cat --base body-idle-1.png
"""
from __future__ import annotations

import struct
import sys
import zlib
from pathlib import Path

ALPHA_MIN = 12          # alpha 高于此值才算"角色像素"
SIZE_TOL = 0            # 画布尺寸必须完全一致
CENTER_TOL = 6          # 重心横向偏移容忍（px）
BOTTOM_TOL = 2          # 底部留白差异容忍（px）
SCALE_TOL = 0.015       # 身高相对偏差容忍


def read_png(path: Path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path.name} 不是 PNG")
    pos, idat, w, h, bd, ct = 8, b"", None, None, None, None
    while pos < len(data):
        ln = struct.unpack(">I", data[pos:pos + 4])[0]
        typ = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + ln]
        if typ == b"IHDR":
            w, h, bd, ct = struct.unpack(">IIBB", chunk[:10])
        elif typ == b"IDAT":
            idat += chunk
        elif typ == b"IEND":
            break
        pos += 12 + ln
    if bd != 8:
        raise ValueError(f"{path.name} bitdepth={bd}，仅支持 8bit")
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ct]
    raw = zlib.decompress(idat)
    stride = w * ch
    out = bytearray(h * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        ft = raw[p]; p += 1
        line = bytearray(raw[p:p + stride]); p += stride
        if ft == 1:
            for i in range(ch, stride):
                line[i] = (line[i] + line[i - ch]) & 0xFF
        elif ft == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ft == 3:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xFF
        elif ft == 4:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                b = prev[i]
                c = prev[i - ch] if i >= ch else 0
                pp = a + b - c
                pa, pb, pc = abs(pp - a), abs(pp - b), abs(pp - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, ch, bytes(out)


def alpha_stats(path: Path):
    w, h, ch, px = read_png(path)
    if ch not in (2, 4):
        return dict(file=path.name, w=w, h=h, has_alpha=False)
    ao = ch - 1
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        row = y * w * ch
        for x in range(w):
            if px[row + x * ch + ao] > ALPHA_MIN:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    if maxx < 0:
        return dict(file=path.name, w=w, h=h, has_alpha=False)
    return dict(file=path.name, w=w, h=h, has_alpha=True,
                bw=maxx - minx + 1, bh=maxy - miny + 1,
                cx=(minx + maxx) / 2, cy=(miny + maxy) / 2,
                left=minx, right=w - 1 - maxx, top=miny, bottom=h - 1 - maxy)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    target = Path(args[0] if args else "public/sprites/reference-for-ai")
    base_name = None
    for a in sys.argv[1:]:
        if a.startswith("--base="):
            base_name = a.split("=", 1)[1]

    files = sorted(target.glob("*.png"))
    if not files:
        print(f"未找到 PNG：{target}")
        return 2

    stats = [alpha_stats(f) for f in files]

    print(f"目录：{target}")
    print(f"{'文件':34s} {'画布':>11s} {'角色bbox':>11s} {'重心':>14s} {'边距 L/R/T/B':>18s}")
    print("-" * 96)
    for s in stats:
        if not s["has_alpha"]:
            print(f"{s['file']:34s} {s['w']:5d}x{s['h']:<5d} {'—— 无透明通道（不可用于合成）':>11s}")
            continue
        print(f"{s['file']:34s} {s['w']:5d}x{s['h']:<5d} {s['bw']:5d}x{s['bh']:<5d} "
              f"({s['cx']:6.1f},{s['cy']:6.1f}) "
              f"{s['left']:5d}/{s['right']:3d}/{s['top']:3d}/{s['bottom']:3d}")

    usable = [s for s in stats if s["has_alpha"]]
    if not usable:
        print("\n没有任何带透明通道的帧，无法比对。")
        return 1

    base = next((s for s in usable if s["file"] == base_name), None)
    if base is None:
        from collections import Counter
        mode_size = Counter((s["w"], s["h"]) for s in usable).most_common(1)[0][0]
        base = max((s for s in usable if (s["w"], s["h"]) == mode_size),
                   key=lambda s: s["bh"])

    print(f"\n基准帧：{base['file']}  ({base['w']}x{base['h']})")
    print(f"{'帧':34s} {'Δ重心X':>8s} {'Δ底边':>7s} {'身高比':>8s} 判定")
    print("-" * 96)

    fails = []
    for s in usable:
        if s is base:
            continue
        if (s["w"], s["h"]) != (base["w"], base["h"]):
            note = f"画布 {s['w']}x{s['h']} ≠ {base['w']}x{base['h']}"
            print(f"{s['file']:34s} {'—':>8s} {'—':>7s} {'—':>8s} FAIL {note}")
            fails.append(s["file"])
            continue
        dx = s["cx"] - base["cx"]
        db = s["bottom"] - base["bottom"]
        ratio = s["bh"] / base["bh"]
        problems = []
        if abs(dx) > CENTER_TOL:
            problems.append(f"横向偏 {dx:+.0f}px")
        if abs(db) > BOTTOM_TOL:
            problems.append(f"底边差 {db:+d}px")
        if abs(ratio - 1) > SCALE_TOL:
            problems.append(f"身高差 {(ratio - 1) * 100:+.1f}%")
        verdict = "PASS" if not problems else "FAIL " + "；".join(problems)
        if problems:
            fails.append(s["file"])
        print(f"{s['file']:34s} {dx:+8.1f} {db:+7d} {ratio:8.3f} {verdict}")

    print("-" * 96)
    if fails:
        print(f"结果：{len(fails)} 帧需要修正 -> {', '.join(fails)}")
        return 1
    print("结果：全部帧构图一致，可以合成。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
