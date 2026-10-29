"""Ear housings (headphone cups, as in the reference art).

A tall oval gunmetal cup with a well-rounded side wall and a convex, domed
outer face. The light is a crescent strip on the face, along the front
half of its edge, thick in the middle and tapering at both ends, so from
the front it reads as a glowing arc on the outer side of the cup.
"""
import numpy as np

from .solids import revolve, tube
from .surfaces import normalize

EAR_CENTRE = (0.7288, 0.03, 0.695)
SCALE = (1.087, 0.82)  # (vertical, depth): pose fitted to the reference outline; oval like the art
FORWARD_TILT = np.radians(23.8)  # cup axis turned towards the front (-Y)
ROLL = np.radians(16.9)  # cup face tilted down: the top of the cup sits further out

# (radius, height along the cup axis), from inside the head outwards
SHELL = [(0.0, -0.07), (0.22, -0.07), (0.28, -0.04), (0.305, 0.0), (0.316, 0.05), (0.313, 0.1),
         (0.3, 0.14), (0.276, 0.17), (0.244, 0.188)]
FACE = [(0.244, 0.188), (0.21, 0.204), (0.16, 0.222), (0.09, 0.234), (0.0, 0.238)]
LIGHT_RADIUS = 0.236
LIGHT_HEIGHT = 0.19
LIGHT_ARC = np.radians(78)  # half-span of the crescent around the front of the face
LIGHT_THICKNESS = 0.019


def ear_frame(side):
    origin = np.array(EAR_CENTRE) * [side, 1, 1]
    axis = normalize(np.array([side * np.cos(FORWARD_TILT) * np.cos(ROLL), -np.sin(FORWARD_TILT),
                               -np.sin(ROLL)]))
    up = np.array([0.0, 0.0, 1.0])
    return origin, axis, normalize(up - axis * (up @ axis))


def light_arc(frame, samples=64):
    """Crescent path around the front half of the face, with tapering thickness."""
    origin, axis, ref = frame
    front = np.cross(axis, ref)
    front = front if front[1] < 0 else -front  # towards the viewer (-Y) on both sides
    t = np.linspace(-1, 1, samples)
    angle = t[:, None] * LIGHT_ARC
    radial = np.sin(angle) * ref * SCALE[0] + np.cos(angle) * front * SCALE[1]
    path = origin + axis * LIGHT_HEIGHT + radial * LIGHT_RADIUS
    # thick in the middle, rounding off to a point at both ends (no cut-off ends)
    thickness = LIGHT_THICKNESS * np.maximum(np.cos(t * np.pi / 2) ** 0.45, 0.08)
    return path, thickness


def build_ears(materials, head, body):
    for side, label in ((-1, "Left"), (1, "Right")):
        frame = ear_frame(side)
        revolve(f"EarShell{label}", SHELL, frame, materials["Graphite"], head, scale=SCALE, samples=48)
        revolve(f"EarCap{label}", FACE, frame, materials["Graphite"], head, scale=SCALE, samples=24)
        path, thickness = light_arc(frame)
        tube(f"EarLight{label}", path, thickness, materials["Light"], head, sides=12)
