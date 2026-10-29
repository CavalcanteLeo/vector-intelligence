"""Logo badges: thin films carrying the full Vector Intelligence logo on the
dark chest (between the chest plates) and the logo mark alone, large, on the
back of the head. The runtime maps the brand SVGs onto their UVs
(u left->right as seen by the viewer, v bottom->top)."""
import numpy as np

from .mesh_io import create_object, grid_faces
from .outlines import HEAD, TORSO
from .surfaces import BACK, FRONT, project, surface_normal

CENTER_HEIGHT = -0.33
WIDTH = 0.46
ASPECT = 1725 / 270  # width / height of the full logo (SVG viewBox)
CORE_OFFSET = -0.014  # the dark chest is the torso core, set under the shell
LIFT = 0.003  # distance above it
MARK_ASPECT = 860 / 470  # the mark's crop of the icon SVG (see logo-material.ts)
MARK_HEIGHT = 0.86
MARK_WIDTH = 0.5
HEAD_OFFSET = 0.0  # the white side shell sits on the head surface


def badge(name, chart, centre_z, width, offset, material, body, rows=12, cols=64,
          surface=TORSO, aspect=ASPECT):
    height = width / aspect
    # left to right as seen from the badge's side (+x is on the viewer's left at the back)
    x = np.linspace(-width / 2, width / 2, cols) * (1 if chart is FRONT else -1)
    z = np.linspace(centre_z - height / 2, centre_z + height / 2, rows)
    X, Z = np.meshgrid(x, z)
    uv = project(surface, chart, np.stack([X, Z], -1).reshape(-1, 2))
    normal = surface_normal(surface, chart, uv)
    if (normal[:, 1].mean() < 0) != (chart is FRONT):
        normal = -normal
    points = surface.point(chart.direction(uv)) + normal * (offset + LIFT)
    tex = np.stack(np.meshgrid(np.linspace(0, 1, cols), np.linspace(0, 1, rows)), -1).reshape(-1, 2)
    return create_object(name, points, grid_faces(rows, cols), material, body, normals=normal, uv=tex)


def build_badge(materials, head, body):
    badge("ChestBadge", FRONT, CENTER_HEIGHT, WIDTH, CORE_OFFSET, materials["Logo"], body)
    badge("HeadBadge", BACK, MARK_HEIGHT, MARK_WIDTH, HEAD_OFFSET, materials["LogoMark"], head,
          rows=32, cols=56, surface=HEAD, aspect=MARK_ASPECT)
