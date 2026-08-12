#!/usr/bin/env python3
"""Remove only chroma-key pixels connected to the canvas edge.

Unlike a global color key, this preserves similarly colored details enclosed by
the dark sprite outline (for example pink coral and mushroom highlights).
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--threshold", type=float, default=105.0)
    parser.add_argument("--transparent", type=float, default=18.0)
    args = parser.parse_args()

    rgba = np.array(Image.open(args.input).convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.float32)
    border = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]))
    key = np.median(border, axis=0)
    distance = np.linalg.norm(rgb - key, axis=2)
    candidate = distance <= args.threshold

    height, width = candidate.shape
    connected = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    def seed(y: int, x: int) -> None:
        if candidate[y, x] and not connected[y, x]:
            connected[y, x] = True
            queue.append((y, x))

    for x in range(width):
        seed(0, x)
        seed(height - 1, x)
    for y in range(height):
        seed(y, 0)
        seed(y, width - 1)

    while queue:
        y, x = queue.popleft()
        if y and candidate[y - 1, x] and not connected[y - 1, x]:
            connected[y - 1, x] = True
            queue.append((y - 1, x))
        if y + 1 < height and candidate[y + 1, x] and not connected[y + 1, x]:
            connected[y + 1, x] = True
            queue.append((y + 1, x))
        if x and candidate[y, x - 1] and not connected[y, x - 1]:
            connected[y, x - 1] = True
            queue.append((y, x - 1))
        if x + 1 < width and candidate[y, x + 1] and not connected[y, x + 1]:
            connected[y, x + 1] = True
            queue.append((y, x + 1))

    matte = np.clip(
        (distance - args.transparent) / (args.threshold - args.transparent), 0.0, 1.0
    )
    rgba[:, :, 3] = np.where(connected, np.rint(matte * 255), 255).astype(np.uint8)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(args.output)
    print(f"Wrote {args.output} with edge-connected key {key.astype(int).tolist()}")


if __name__ == "__main__":
    main()
