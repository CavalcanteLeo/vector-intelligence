"""Proportions and outlines traced from the reference image (pixels).

Reference: public/assets/images/vector-intelligence-mascote-cutout.png (1254px).
Left-side traces are mirrored for the right side.
"""
import json
import os

import numpy as np

from .surfaces import ProfileSurface, SuperEgg, ref

# Head: the front outline is traced from the reference
# (scripts/mascot/trace_reference.py); the side profile is a smooth egg fitted
# to that outline, so the head stays round in depth.
_HEAD_EGG = SuperEgg(center=(0, 0, 1.0707), a=0.8484, b=0.79, top=0.7303, bottom=1.0253,
                     p_top=1.9561, p_bottom=3.086)


def _head_depth(z):
    # side profile: plain ellipse-like curves (exponent 2), round from every angle
    t = np.asarray(z) - _HEAD_EGG.center[2]
    h = np.where(t >= 0, _HEAD_EGG.top, _HEAD_EGG.bottom)
    e = 2.0
    return _HEAD_EGG.b * (1 - np.clip(np.abs(t) / h, 0, 1) ** e) ** (1 / e)


with open(os.path.join(os.path.dirname(__file__), "reference_profiles.json")) as _f:
    HEAD = ProfileSurface(center=(0, 0, 0.95), profile=json.load(_f)["head"], depth=_head_depth, q=2.2)

# Torso: shoulder slope fitted to the reference silhouette (rows 952-1030 px).
# The chest plates end at x ~ 0.79 (the dark joint and shoulder pad sit beyond).
TORSO = SuperEgg(center=(0, 0.04, -0.2138), a=0.79, b=0.5, top=0.2739, bottom=1.3,
                 p_top=2.0, p_bottom=2.5, q=2.5)

NECK_PIVOT = (0.0, 0.0, -0.06)


# Glass/face junction height by |azimuth| (degrees), traced from the reference:
# a deep central dip over the face, rising past the temples to the sides.
_DOME_TRACE = [(0, 0.81), (3.9, 0.818), (7.4, 0.854), (11.2, 0.91), (15.2, 0.964), (19.3, 1.0),
               (23.7, 1.024), (28.3, 1.04), (58.3, 1.078), (69.1, 1.112), (78.4, 1.153),
               (100, 1.19), (180, 1.2)]
_DOME_GRID = np.linspace(0, 180, 721)
_DOME_TABLE = np.interp(_DOME_GRID, *zip(*_DOME_TRACE))
_KERNEL = np.exp(-np.linspace(-2, 2, 25) ** 2)
_DOME_TABLE = np.convolve(np.pad(_DOME_TABLE, 12, mode="edge"), _KERNEL / _KERNEL.sum(), "valid")


def dome_height(theta):
    """Height of the glass/face junction around the head (dips over the face)."""
    angle = np.degrees(np.abs((np.asarray(theta) + np.pi) % (2 * np.pi) - np.pi))
    return np.interp(angle, _DOME_GRID, _DOME_TABLE)


SIDE_SPLIT_HEIGHT = 0.52  # white upper side shell / graphite jaw shell

# Face plate side edge, left half: from the dome corner down to the chin centre.
FACE_SIDE_PX = [(262, 450), (252, 505), (247, 560), (249, 620), (261, 690), (280, 740),
                (305, 780), (340, 820), (388, 860), (455, 897), (540, 922), (627, 929)]

# Eye opening (outer edge of the dark bezel), left eye.
EYE_PX = [(313, 628), (324, 588), (357, 560), (404, 549), (452, 557), (488, 580),
          (506, 617), (511, 662), (504, 701), (482, 717), (440, 716), (392, 704),
          (349, 684), (322, 659)]
EYE_CENTER_PX = (412, 634)
IRIS_OFFSET_PX = (18, 14)  # iris sits lower and towards the nose
IRIS_RADIUS_PX = 46

# Mouth centre lines (x offset px from face centre, y px), neutral and smile.
MOUTH_NEUTRAL_PX = [(-80, 796), (-56, 813), (-28, 823), (0, 826), (28, 823), (56, 813), (80, 796)]
MOUTH_SMILE_PX = [(-80, 792), (-58, 812), (-30, 828), (0, 834), (30, 828), (58, 812), (80, 792)]
# light frown: corners a little below the centre
MOUTH_SAD_PX = [(-54, 822), (-38, 816), (-19, 812), (0, 811), (19, 812), (38, 816), (54, 822)]
# "wow": a small, deep open U
MOUTH_WOW_PX = [(-26, 806), (-24, 822), (-16, 834), (0, 839), (16, 834), (24, 822), (26, 806)]


def mirrored(points_px):
    return [(1254 - x, y) for x, y in points_px]


def to_model(points_px):
    return np.array([ref(x, y) for x, y in points_px])
