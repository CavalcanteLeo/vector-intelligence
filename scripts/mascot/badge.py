"""Chest badge: a thin film hugging the front of the collar that carries
the full Vector Intelligence logo (the runtime maps the brand SVG onto its UVs,
u left→right, v bottom→top)."""
import numpy as np

from .body import COLLAR
from .mesh_io import create_object, grid_faces
from .surfaces import catmull_rom_open

CENTER_HEIGHT = -0.255
HEIGHT = 0.1
ASPECT = 1725 / 270  # width / height of the full logo (SVG viewBox)
LIFT = 0.0025  # distance above the collar surface


def collar_radius(z):
    """Collar outer radius at height z (outer flank of the revolved profile)."""
    profile = catmull_rom_open(np.array(COLLAR), 400)
    flank = profile[profile[:, 0] >= 0.43]
    order = np.argsort(flank[:, 1])
    return np.interp(z, flank[order, 1], flank[order, 0])


def build_badge(materials, head, body, rows=24, cols=48):
    z = np.linspace(CENTER_HEIGHT - HEIGHT / 2, CENTER_HEIGHT + HEIGHT / 2, rows)
    radius = collar_radius(z)
    span = HEIGHT * ASPECT / 2 / radius.mean()
    angle = -np.pi / 2 + np.linspace(-span, span, cols)  # front faces -Y
    slope = np.gradient(radius, z)
    r, a = radius[:, None], angle[None, :]
    normal = np.stack([np.cos(a) * np.ones_like(r), np.sin(a) * np.ones_like(r),
                       -slope[:, None] * np.ones_like(a)], -1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    points = np.stack([r * np.cos(a), r * np.sin(a), z[:, None] * np.ones_like(a)], -1)
    points = points + normal * LIFT
    u, v = np.meshgrid(np.linspace(0, 1, cols), np.linspace(0, 1, rows))
    return create_object("ChestBadge", points.reshape(-1, 3), grid_faces(rows, cols),
                         materials["Logo"], body, normals=normal.reshape(-1, 3),
                         uv=np.stack([u, v], -1).reshape(-1, 2))
