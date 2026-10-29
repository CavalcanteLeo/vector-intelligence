"""Revolved and swept solids (ears, neck, collar, light rings)."""
import numpy as np

from .surfaces import catmull_rom_open, normalize
from .mesh_io import create_object, grid_faces, grid_normals


def revolve(name, profile, axis_frame, material, parent, segments=96, scale=(1.0, 1.0),
            samples=None):
    """Revolve (radius, height) profile points around the frame's axis.

    axis_frame: (origin, axis, ref) – ref is the zero-angle direction.
    scale stretches radius along ref and along axis x ref (ellipses).
    """
    origin, axis, refdir = (np.asarray(v, dtype=float) for v in axis_frame)
    axis = normalize(axis)
    refdir = normalize(refdir - axis * (refdir @ axis))
    other = np.cross(axis, refdir)
    prof = np.asarray(profile, dtype=float)
    if samples:
        prof = catmull_rom_open(prof, samples)
    angle = np.linspace(0, 2 * np.pi, segments, endpoint=False)
    radial = (np.cos(angle)[:, None] * refdir * scale[0] + np.sin(angle)[:, None] * other * scale[1])
    pts = (origin + prof[:, 1:2, None] * axis[None, None, :] * 1.0
           + prof[:, 0:1, None] * radial[None, :, :])
    pts = pts.reshape(len(prof), segments, 3)
    normals = grid_normals(np.concatenate([pts, pts[:, :1]], 1))[:, :-1]
    faces = grid_faces(len(prof), segments, wrap=True)
    probe = pts[len(prof) // 2, 0] - (origin + axis * prof[len(prof) // 2, 1])
    if normals[len(prof) // 2, 0] @ probe < 0:
        normals = -normals
        faces = [f[::-1] for f in faces]
    # profile ends on the axis (poles): normal points along the axis
    for row, toward in ((0, 1), (len(prof) - 1, -2)):
        if prof[row, 0] < 1e-6:
            outward = np.sign(prof[row, 1] - prof[toward, 1]) or 1.0
            normals[row] = axis * outward
    return create_object(name, pts.reshape(-1, 3), faces, material, parent,
                         normals=normals.reshape(-1, 3))


def tube(name, path, radius, material, parent, sides=16, closed=False):
    """Round tube along a polyline (open tubes get rounded end caps)."""
    path = np.asarray(path, dtype=float)
    if closed:
        tangent = normalize(np.roll(path, -1, 0) - np.roll(path, 1, 0))
    else:
        tangent = normalize(np.gradient(path, axis=0))
    # rotation-minimising frame (parallel transport) so it never degenerates
    ref = np.array([0, 0, 1.0]) if abs(tangent[0] @ [0, 0, 1]) < 0.9 else np.array([1.0, 0, 0])
    normal = np.empty_like(tangent)
    normal[0] = normalize(np.cross(tangent[0], ref))
    for i in range(1, len(path)):
        n = normal[i - 1] - tangent[i] * (normal[i - 1] @ tangent[i])
        normal[i] = n / np.linalg.norm(n)
    binormal = np.cross(tangent, normal)
    radius = np.broadcast_to(np.asarray(radius, dtype=float), (len(path),))
    angle = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    ring = np.cos(angle)[None, :, None] * normal[:, None] + np.sin(angle)[None, :, None] * binormal[:, None]
    verts = path[:, None] + ring * radius[:, None, None]
    faces = grid_faces(len(path), sides, wrap=True)
    if closed:
        n = len(path)
        faces += [((n - 1) * sides + c, (n - 1) * sides + (c + 1) % sides, (c + 1) % sides, c)
                  for c in range(sides)]
    return create_object(name, verts.reshape(-1, 3), faces, material, parent,
                         normals=ring.reshape(-1, 3))


def closed_surface(name, surface, material, parent, rows=64, cols=96):
    """Whole SuperEgg surface as a UV grid with analytic-direction sampling."""
    phi = np.linspace(1e-3, np.pi - 1e-3, rows)
    theta = np.linspace(0, 2 * np.pi, cols, endpoint=False)
    P, T = np.meshgrid(phi, theta, indexing="ij")
    d = np.stack([np.sin(P) * np.sin(T), -np.sin(P) * np.cos(T), np.cos(P)], -1)
    pts = surface.point(d)
    normals = grid_normals(np.concatenate([pts, pts[:, :1]], 1))[:, :-1]
    faces = grid_faces(rows, cols, wrap=True)
    if (normals[rows // 2] * (pts[rows // 2] - surface.center)).sum(-1).mean() < 0:
        normals = -normals
        faces = [f[::-1] for f in faces]
    return create_object(name, pts.reshape(-1, 3), faces, material, parent,
                         normals=normals.reshape(-1, 3))
