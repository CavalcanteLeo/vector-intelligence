"""Head shells: glass dome, face plate, side shells, inner core and cavity floor.

All shells are regions of the same analytic HEAD surface, separated by one
seam network (dome junction, face edges, side split), so junctions match
exactly and read as precise panel gaps.
"""
import numpy as np

from .surfaces import FRONT, TOP, BACK, BOTTOM, project, catmull_rom_open, catmull_rom_loop, normalize
from .panels import Panel, resample
from .mesh_io import create_object
from .outlines import (HEAD, FACE_SIDE_PX, EYE_PX, SIDE_SPLIT_HEIGHT, dome_height,
                       mirrored, to_model)

GAP = 0.011
FLOOR_HEIGHT = 0.992


def azimuth(d):
    return np.arctan2(d[..., 0], -d[..., 1])


def dome_curve(theta):
    return HEAD.direction_at_height(theta, dome_height(theta))


def front_dirs(points_px, samples=160, closed=False):
    xz = to_model(points_px)
    xz = catmull_rom_loop(xz, samples // len(xz)) if closed else catmull_rom_open(xz, samples)
    return FRONT.direction(project(HEAD, FRONT, xz))


class Seams:
    """Seam network shared by every head shell (directions on the unit sphere)."""

    def __init__(self):
        self.face_left = front_dirs(FACE_SIDE_PX)
        self.face_right = front_dirs(mirrored(FACE_SIDE_PX))
        self.corner = abs(azimuth(self.face_left[0]))
        front = np.linspace(-self.corner, self.corner, 140)
        self.dome_front = dome_curve(front)
        back = np.linspace(self.corner, 2 * np.pi - self.corner, 220)
        self.dome_back = dome_curve(back)
        # snap the face edges to the dome junction so the corner is shared
        self.face_left[0] = self.dome_front[0]
        self.face_right[0] = self.dome_front[-1]
        heights = HEAD.point(self.face_left)[:, 2]
        self.split_index = int(np.argmin(np.abs(heights - SIDE_SPLIT_HEIGHT)))
        split_theta = abs(azimuth(self.face_left[self.split_index]))
        theta = np.linspace(-split_theta, -(2 * np.pi - split_theta), 200)
        self.split = HEAD.direction_at_height(theta, np.full_like(theta, SIDE_SPLIT_HEIGHT))
        self.eyes = [front_dirs(EYE_PX, 168, True), front_dirs(mirrored(EYE_PX), 168, True)]

    def dome_loop(self):
        return np.vstack([self.dome_front, self.dome_back[1:-1]])

    def face_loop(self):
        return np.vstack([self.dome_front, self.face_right[1:], self.face_left[::-1][1:-1]])

    def upper_side_loop(self):
        i = self.split_index
        return np.vstack([self.dome_back, self.face_left[1:i + 1], self.split[1:-1],
                          self.face_right[1:i + 1][::-1]])

    def lower_side_loop(self):
        i = self.split_index
        return np.vstack([self.face_left[i:], self.face_right[i:-1][::-1], self.split[::-1][1:-1]])


def eye_holes(seams, chart, grow=0.0):
    loops = []
    for eye in seams.eyes:
        uv = chart.uv(eye)
        if grow:
            centre = uv.mean(0)
            uv = centre + (uv - centre) * (1 + grow)
        loops.append(uv)
    return loops


def build_cavity_floor(seams, material, parent):
    rim = TOP.uv(seams.dome_loop())
    rim = resample(rim, 0.03)
    rings = 18
    centre = np.zeros(2)
    points, faces = [centre], []
    for r in range(1, rings + 1):
        points.extend(centre + (rim - centre) * (r / rings))
    count = len(rim)
    points = np.array(points)
    for c in range(count):
        faces.append((0, 1 + c, 1 + (c + 1) % count))
    for r in range(rings - 1):
        a, b = 1 + r * count, 1 + (r + 1) * count
        for c in range(count):
            c2 = (c + 1) % count
            faces.append((a + c, b + c, b + c2, a + c2))
    surface = HEAD.point(TOP.direction(points))
    t = np.linalg.norm(points - centre, axis=1) / np.linalg.norm(rim - centre, axis=1).mean()
    xy = surface[:, :2] * 0.955
    z = FLOOR_HEIGHT + 0.025 * (1 - np.clip(t, 0, 1) ** 2)
    verts = np.column_stack([xy, z])
    normals = np.tile([0.0, 0.0, 1.0], (len(verts), 1))
    return create_object("CavityFloor", verts, faces, material, parent, normals=normals)


def build_head(materials, parent):
    seams = Seams()
    dome = TOP.uv(seams.dome_loop())
    Panel(HEAD, TOP, dome, offset=0.004, lip=0.016, gap=GAP, spacing=0.03).build(
        "GlassDome", materials["Glass"], parent)
    Panel(HEAD, FRONT, FRONT.uv(seams.face_loop()), eye_holes(seams, FRONT), offset=0.007,
          lip=0.013, hole_lip=0.006, gap=GAP, spacing=0.028).build(
        "FacePlate", materials["Ceramic"], parent)
    Panel(HEAD, BACK, BACK.uv(seams.upper_side_loop()), offset=0.0, lip=0.012, gap=GAP,
          spacing=0.035).build("SideShell", materials["Ceramic"], parent)
    Panel(HEAD, BOTTOM, BOTTOM.uv(seams.lower_side_loop()), offset=0.0, lip=0.012, gap=GAP,
          spacing=0.035).build("JawShell", materials["Graphite"], parent)
    # Inner graphite core: visible only through panel gaps; rises to the cavity floor.
    theta = np.linspace(-np.pi, np.pi, 280, endpoint=False)
    core_top = np.maximum(dome_height(theta) + 0.03, FLOOR_HEIGHT + 0.012)
    core_rim = BOTTOM.uv(HEAD.direction_at_height(theta, core_top))
    Panel(HEAD, BOTTOM, core_rim, eye_holes(seams, BOTTOM, 0.12), offset=-0.016, lip=0.0,
          spacing=0.05).build("HeadCore", materials["Cavity"], parent)
    build_cavity_floor(seams, materials["Cavity"], parent)
    return seams
