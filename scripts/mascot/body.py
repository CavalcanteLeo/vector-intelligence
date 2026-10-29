"""Neck, collar, torso and shoulders.

The neck belongs to the head rig and pivots inside the collar opening at
the light ring, so tilting the head never opens a horizontal gap.
"""
import numpy as np

from .surfaces import FRONT, TOP, project, catmull_rom_open, catmull_rom_loop, surface_normal
from .mesh_io import create_object, grid_faces, grid_normals
from .panels import Panel
from .solids import revolve, tube, closed_surface
from .outlines import TORSO
from .surfaces import SuperEgg, normalize

NECK = [(0.0, -0.2), (0.25, -0.2), (0.292, -0.14), (0.302, -0.08), (0.298, 0.02),
        (0.292, 0.14), (0.3, 0.26), (0.33, 0.4)]
# the dark skirt rises from the light ring to meet the chest plates' inner edge
# low, wide collar: a flat top ring around the neck with the light near its
# outer edge, then a short wall down into the chest
COLLAR = [(0.33, -0.3), (0.33, -0.1), (0.345, -0.087), (0.38, -0.082), (0.43, -0.083),
          (0.458, -0.093), (0.47, -0.115), (0.472, -0.2), (0.466, -0.4)]
COLLAR_DEPTH = 0.92  # collar and its torso opening are oval (narrower front-to-back)
RING_HEIGHT = -0.078
RING_RADIUS = 0.405

# chest opening, traced from the reference (front view, model units)
V_EDGE = [(0.45, -0.07), (0.37, -0.2), (0.29, -0.36), (0.2, -0.55), (0.1, -0.77), (0.0, -0.99)]
COLLAR_RADIUS = 0.47
# shoulder pads fitted to the reference silhouette (rows 1048-1252 px)
# outer edge fitted to the reference silhouette; the inner edge stays at
# x ~ 0.89 so the dark joint shows between chest plate and pad, as in the art
PAD = dict(x=1.0072, z=-0.6081, a=0.1781, depth=0.4, top=0.3803, bottom=0.5, p_top=1.6913)


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
    xy = np.stack([np.cos(arc) * COLLAR_RADIUS, TORSO.center[1] + np.sin(arc) * COLLAR_RADIUS * COLLAR_DEPTH], -1)
    arc_dirs = TOP.direction(project(TORSO, TOP, xy, axes=(0, 1)))
    return TOP.uv(np.vstack([v_dirs, arc_dirs]))


def collar_opening():
    """Oval opening in the torso core, smaller than the collar so the core
    runs on under the collar's top and no gap shows between them."""
    angle = np.linspace(0, 2 * np.pi, 120, endpoint=False)
    r = COLLAR_RADIUS - 0.06
    xy = np.stack([np.cos(angle) * r, TORSO.center[1] + np.sin(angle) * r * COLLAR_DEPTH], -1)
    return TOP.uv(TOP.direction(project(TORSO, TOP, xy, axes=(0, 1))))


def build_torso(materials, body):
    angle = np.linspace(0, 2 * np.pi, 200, endpoint=False)
    outer = np.stack([np.cos(angle), np.sin(angle)], -1) * 2.75
    hole = torso_hole()
    Panel(TORSO, TOP, outer, [hole], offset=0.0, lip=0.016, gap=0.0, metric=0.6,
          spacing=0.04).build("TorsoShell", materials["Ceramic"], body)
    # dark chest seen through the V; the collar opening stays open for the collar
    Panel(TORSO, TOP, outer, [collar_opening()], offset=-0.014, lip=0.0, metric=0.6, spacing=0.06).build(
        "TorsoCore", materials["Graphite"], body)


def build_shoulders(materials, body):
    for side, label in ((-1, "Left"), (1, "Right")):
        joint = SuperEgg((side * 0.86, 0.04, -0.46), 0.11, 0.32, 0.33, 0.4)
        closed_surface(f"ShoulderJoint{label}", joint, materials["Graphite"], body, 40, 64)
        pad = SuperEgg((side * PAD["x"], 0.04, PAD["z"]), PAD["a"], PAD["depth"], PAD["top"],
                       PAD["bottom"], PAD["p_top"], 2.3, 2.2)
        closed_surface(f"ShoulderPad{label}", pad, materials["Ceramic"], body, 64, 96)
        # light ring all the way around the dark joint (front, over the top,
        # down the back), on its chest-facing side
        # the joint is an ellipsoid (a wheel in the y-z plane): its rim at the
        # centre plane is an ellipse, top height above the centre, bottom below
        phi = np.linspace(0, 2 * np.pi, 160, endpoint=False)
        h = np.where(np.cos(phi) > 0, joint.top, joint.bottom)
        y, z = joint.b * np.sin(phi), h * np.cos(phi)
        rim = joint.center + np.stack([np.zeros_like(phi), y, z], -1)
        n = normalize(np.stack([np.zeros_like(phi), y / joint.b ** 2, z / h ** 2], -1))
        tube(f"ShoulderLight{label}", rim + n * 0.006, 0.011, materials["Light"], body, sides=12, closed=True)


def torso_height(angle, radius):
    """Height of the torso surface at a collar-space radius (oval) for each azimuth."""
    z = np.linspace(TORSO.center[2] + TORSO.top, TORSO.center[2] - 0.5, 400)
    out = []
    for a in np.atleast_1d(angle):
        d = TORSO.direction_at_height(np.full_like(z, np.pi / 2 - a), z)
        p = TORSO.point(d)
        r = np.hypot(p[:, 0], (p[:, 1] - TORSO.center[1]) / COLLAR_DEPTH)
        out.append(np.interp(radius, r, z))
    return np.array(out)


def build_collar(materials, body, segments=96, samples=40):
    """Collar: an inner wall around the neck, then a top surface that rises to
    meet the chest plates exactly at the torso opening on every side (no gap),
    then tucks under them. The light ring sits on that surface."""
    angle = np.linspace(0, 2 * np.pi, segments, endpoint=False)
    rim = torso_height(angle, COLLAR_RADIUS) - 0.004
    rim_low = torso_height(angle, COLLAR_RADIUS + 0.03) - 0.03
    profile = []
    for a, top, low in zip(angle, rim, rim_low):
        # inner lip around the neck, a channel holding the light ring, then a
        # raised outer rim that meets the chest plates (as in the reference)
        # the inner lip closes in to just clear the neck (r ~0.30), so no gap shows
        pts = [(0.312, -0.3), (0.312, -0.05), (0.318, -0.036), (0.345, -0.032), (0.365, -0.045), (0.38, -0.068),
               (RING_RADIUS, -0.075), (0.43, -0.068), (0.448, -0.06), (0.462, min(top, -0.04)),
               (COLLAR_RADIUS + 0.004, top), (COLLAR_RADIUS + 0.03, low)]
        profile.append(catmull_rom_open(np.array(pts), samples))
    profile = np.array(profile)  # (segments, rows, 2)
    rows = profile.shape[1]
    c, s = np.cos(angle)[:, None], np.sin(angle)[:, None]
    pts = np.stack([profile[..., 0] * c, TORSO.center[1] + profile[..., 0] * s * COLLAR_DEPTH, profile[..., 1]], -1)
    grid = np.transpose(pts, (1, 0, 2))  # rows x segments
    normals = grid_normals(np.concatenate([grid, grid[:, :1]], 1))[:, :-1]
    faces = grid_faces(rows, segments, wrap=True)
    probe = grid[rows // 2, 0] - np.array([0, TORSO.center[1], grid[rows // 2, 0, 2]])
    if normals[rows // 2, 0] @ probe < 0:
        normals, faces = -normals, [f[::-1] for f in faces]
    create_object("Collar", grid.reshape(-1, 3), faces, materials["Graphite"], body, normals=normals.reshape(-1, 3))
    # light ring on the collar's top surface
    ring = np.stack([np.cos(angle) * RING_RADIUS, TORSO.center[1] + np.sin(angle) * RING_RADIUS * COLLAR_DEPTH,
                     np.full_like(angle, -0.058)], -1)
    tube("NeckLight", catmull_rom_loop(ring, 2), 0.017, materials["Light"], body, sides=12, closed=True)


def build_body(materials, head, body):
    revolve("Neck", NECK, ((0, TORSO.center[1], 0), (0, 0, 1), (1, 0, 0)), materials["Graphite"], head,
            samples=48, scale=(1.0, COLLAR_DEPTH))
    build_collar(materials, body)
    build_torso(materials, body)
    build_shoulders(materials, body)
