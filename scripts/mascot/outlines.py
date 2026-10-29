"""Proportions and outlines traced from the reference image (pixels).

Reference: public/assets/images/vector-intelligence-mascote-cutout.png (1254px).
Left-side traces are mirrored for the right side.
"""
import numpy as np

from .surfaces import SuperEgg, ref

HEAD = SuperEgg(center=(0, 0, 0.95), a=0.83, b=0.77, top=0.86, bottom=0.91,
                p_top=2.0, p_bottom=2.5, q=2.2)

TORSO = SuperEgg(center=(0, 0.04, -0.78), a=0.8, b=0.48, top=0.69, bottom=0.8,
                 p_top=3.6, p_bottom=2.2, q=2.5)

NECK_PIVOT = (0.0, 0.0, -0.06)


def dome_height(theta):
    """Height of the glass/face junction around the head (wave dips at the front)."""
    return 1.045 - 0.135 * np.exp(-(np.asarray(theta) / 0.34) ** 2)


SIDE_SPLIT_HEIGHT = 0.70  # white upper side shell / graphite jaw shell

# Face plate side edge, left half: from the dome corner down to the chin centre.
FACE_SIDE_PX = [(262, 450), (254, 505), (250, 565), (254, 625), (263, 685), (279, 745),
                (303, 802), (340, 852), (392, 890), (460, 913), (545, 924), (627, 927)]

# Eye opening (outer edge of the dark bezel), left eye.
EYE_PX = [(313, 628), (324, 588), (357, 560), (404, 549), (452, 557), (488, 580),
          (506, 617), (511, 662), (504, 701), (482, 717), (440, 716), (392, 704),
          (349, 684), (322, 659)]
EYE_CENTER_PX = (412, 634)
IRIS_OFFSET_PX = (18, 14)  # iris sits lower and towards the nose
IRIS_RADIUS_PX = 46

# Mouth centre lines (x offset px from face centre, y px), neutral and smile.
MOUTH_NEUTRAL_PX = [(-60, 803), (-42, 816), (-20, 824), (0, 826), (20, 824), (42, 816), (60, 803)]
MOUTH_SMILE_PX = [(-80, 792), (-58, 812), (-30, 828), (0, 834), (30, 828), (58, 812), (80, 792)]
# light frown: corners a little below the centre
MOUTH_SAD_PX = [(-54, 822), (-38, 816), (-19, 812), (0, 811), (19, 812), (38, 816), (54, 822)]
# "wow": a small, deep open U
MOUTH_WOW_PX = [(-26, 806), (-24, 822), (-16, 834), (0, 839), (16, 834), (24, 822), (26, 806)]


def mirrored(points_px):
    return [(1254 - x, y) for x, y in points_px]


def to_model(points_px):
    return np.array([ref(x, y) for x, y in points_px])
