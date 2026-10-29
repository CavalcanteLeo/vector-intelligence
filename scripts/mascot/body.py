"""Neck, collar, torso and shoulders.

The neck belongs to the head rig and pivots inside the collar opening at
the light ring, so tilting the head never opens a horizontal gap.
"""
import numpy as np

from .surfaces import FRONT, TOP, project, catmull_rom_open, surface_normal
from .panels import Panel
from .solids import revolve, tube, closed_surface
from .outlines import TORSO
from .surfaces import SuperEgg, normalize

NECK = [(0.0, -0.2), (0.25, -0.2), (0.292, -0.14), (0.302, -0.08), (0.298, 0.02),
        (0.292, 0.14), (0.3, 0.26), (0.33, 0.4)]
COLLAR = [(0.322, -0.32), (0.322, -0.14), (0.334, -0.108), (0.37, -0.096), (0.43, -0.108),
          (0.48, -0.145), (0.52, -0.21), (0.55, -0.3), (0.56, -0.4)]
RING_HEIGHT = -0.1
RING_RADIUS = 0.352

V_EDGE = [(0.43, -0.18), (0.34, -0.29), (0.25, -0.42), (0.18, -0.58), (0.09, -0.8), (0.0, -0.99)]
COLLAR_RADIUS = 0.43


def axis_z(z=0.0):
    return ((0, 0, z), (0, 0, 1), (1, 0, 0))


def torso_hole():
    left = catmull_rom_open(np.array(V_EDGE) * [-1, 1], 60)
    right = left[::-1][1:] * [-1, 1]
    v_edge = np.vstack([left, right])
    v_dirs = FRONT.direction(project(TORSO, FRONT, v_edge))
    start = TORSO.point(v_dirs[-1])
    end = TORSO.point(v_dirs[0])
    a0 = np.arctan2(start[1] - TORSO.center[1], start[0])
    a1 = np.arctan2(end[1] - TORSO.center[1], end[0])
    if a1 < a0:
        a1 += 2 * np.pi
    arc = np.linspace(a0, a1, 90)[1:-1]
    xy = np.stack([np.cos(arc) * COLLAR_RADIUS, TORSO.center[1] + np.sin(arc) * COLLAR_RADIUS * 0.85], -1)
    arc_dirs = TOP.direction(project(TORSO, TOP, xy, axes=(0, 1)))
    return TOP.uv(np.vstack([v_dirs, arc_dirs]))


def build_torso(materials, body):
    angle = np.linspace(0, 2 * np.pi, 200, endpoint=False)
    outer = np.stack([np.cos(angle), np.sin(angle)], -1) * 2.75
    Panel(TORSO, TOP, outer, [torso_hole()], offset=0.0, lip=0.016, gap=0.0, metric=0.6,
          spacing=0.04).build("TorsoShell", materials["Ceramic"], body)
    Panel(TORSO, TOP, outer, offset=-0.014, lip=0.0, metric=0.6, spacing=0.06).build(
        "TorsoCore", materials["Graphite"], body)


def build_shoulders(materials, body):
    for side, label in ((-1, "Left"), (1, "Right")):
        joint = SuperEgg((side * 0.66, 0.04, -0.46), 0.2, 0.26, 0.26, 0.32)
        closed_surface(f"ShoulderJoint{label}", joint, materials["Graphite"], body, 40, 64)
        pad = SuperEgg((side * 0.86, 0.04, -0.44), 0.2, 0.3, 0.27, 0.5, 2.2, 2.3, 2.2)
        closed_surface(f"ShoulderPad{label}", pad, materials["Ceramic"], body, 64, 96)
        # light strip in the seam between chest plate and shoulder (front view trace)
        trace = catmull_rom_open(np.array([(0.672, -0.2), (0.655, -0.32), (0.66, -0.46), (0.68, -0.62)])
                                 * [side, 1], 60)
        uv = project(TORSO, FRONT, trace)
        path = TORSO.point(FRONT.direction(uv)) + surface_normal(TORSO, FRONT, uv) * 0.006
        tube(f"ShoulderLight{label}", path, 0.012, materials["Light"], body, sides=12)


def build_body(materials, head, body):
    revolve("Neck", NECK, axis_z(), materials["Graphite"], head, samples=48)
    revolve("Collar", COLLAR, axis_z(), materials["Graphite"], body, samples=48)
    angle = np.linspace(0, 2 * np.pi, 160, endpoint=False)
    ring = np.stack([np.cos(angle) * RING_RADIUS, np.sin(angle) * RING_RADIUS,
                     np.full_like(angle, RING_HEIGHT)], -1)
    tube("NeckLight", ring, 0.015, materials["Light"], body, sides=12, closed=True)
    build_torso(materials, body)
    build_shoulders(materials, body)
