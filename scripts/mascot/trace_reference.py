"""Trace silhouette profiles from the reference art into model units.

    blender -b --factory-startup -P scripts/mascot/trace_reference.py

Reads the alpha of public/assets/images/vector-intelligence-mascote-cutout.png
(via Blender's image loader, so no extra Python packages are needed) and
writes scripts/mascot/reference_profiles.json with the head half-width per
height. Behind the ears the head edge is read from the shaded art; rows where
nothing shows it are interpolated from their neighbours. The reference is read as an orthographic front view
(500 px per unit, see surfaces.ref).
"""
import json
import os

import bpy
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
IMAGE = os.path.join(ROOT, "public/assets/images/vector-intelligence-mascote-cutout.png")
SHADED = os.path.join(ROOT, "public/assets/images/vector-intelligence-mascote.png")
OUTPUT = os.path.join(ROOT, "scripts/mascot/reference_profiles.json")
OPAQUE = 0.9  # alpha threshold: excludes the soft glow around the dome
HEAD_ROWS = [(62, 450), (792, 932)]  # rows where the head outline is visible
# behind the ears the head edge is where the light side panel meets the dark
# ear cup (right side of the art, which has no eye in the way)
EAR_ROWS = (480, 615)
APEX_ROW = 57
CHIN_CLOSE = 0.11  # the hidden underside closes this far below the last visible row


def load(path):
    image = bpy.data.images.load(path)
    w, h = image.size
    return np.array(image.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]  # top row first


def ear_side_widths(luminance):
    rows, widths = [], []
    for y in range(*EAR_ROWS):
        dark = luminance[y, 980:1150] < 0.27
        run = np.convolve(dark, np.ones(6), "valid") >= 6
        if run.any():
            rows.append(y)
            widths.append((980 + int(np.argmax(run)) - 627) / 500)
    return np.array(rows), np.array(widths)


def to_z(y):
    return (960 - np.asarray(y, dtype=float)) / 500


def half_widths(alpha, y0, y1):
    rows, widths = [], []
    for y in range(y0, y1 + 1):
        xs = np.where(alpha[y] >= OPAQUE)[0]
        if len(xs):
            rows.append(y)
            widths.append((xs[-1] - xs[0]) / 2 / 500)
    return np.array(rows), np.array(widths)


def smooth(values, sigma):
    k = np.exp(-0.5 * (np.arange(-3 * sigma, 3 * sigma + 1) / sigma) ** 2)
    padded = np.pad(values, 3 * sigma, mode="edge")
    return np.convolve(padded, k / k.sum(), "valid")


def head_profile(alpha, luminance):
    parts = [half_widths(alpha, *span) for span in HEAD_ROWS] + [ear_side_widths(luminance)]
    rows = np.concatenate([r for r, _ in parts])
    widths = np.concatenate([w for _, w in parts])
    order = np.argsort(rows)
    rows, widths = rows[order], widths[order]
    every = np.arange(HEAD_ROWS[0][0], HEAD_ROWS[1][1] + 1)
    # hidden rows (below the ear) bridge the measured ones; then smooth
    # strong smoothing: the hidden rows behind the ears meet the measured chin
    # rows at a kink that reads as a dent across the cheeks otherwise
    profile = smooth(np.interp(every, rows, widths), 28)
    z = to_z(every)
    # close the top (apex) and the hidden underside with quarter ellipses
    top = np.linspace(0, 1, 12)[1:]
    apex = to_z(APEX_ROW)
    top_z = z[0] + (apex - z[0]) * top
    top_w = profile[0] * np.sqrt(1 - top ** 2)
    bottom_z = z[-1] - CHIN_CLOSE * top
    bottom_w = profile[-1] * np.sqrt(1 - top ** 2)
    z = np.concatenate([top_z[::-1], z, bottom_z])
    w = np.concatenate([top_w[::-1], profile, bottom_w])
    return [[round(float(a), 5), round(float(b), 5)] for a, b in zip(z[::-1], w[::-1])]


def main():
    alpha = load(IMAGE)[..., 3]
    shaded = load(SHADED)
    luminance = shaded[..., :3] @ np.array([0.2126, 0.7152, 0.0722])
    data = {"source": os.path.relpath(IMAGE, ROOT), "head": head_profile(alpha, luminance)}
    with open(OUTPUT, "w") as f:
        json.dump(data, f, indent=1)
    print("REFERENCE_PROFILES", OUTPUT, len(data["head"]))


if __name__ == "__main__":
    main()
