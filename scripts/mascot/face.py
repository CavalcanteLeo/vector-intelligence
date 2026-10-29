"""Eyes and mouth.

Each eye is an eyeball sphere sitting behind the face-plate opening:
  * EyeLens  – glossy sphere patch; UVs hold (azimuth, elevation) so the
               runtime shader can draw an iris that rotates with the gaze.
  * EyeBezel – rounded graphite rim from the opening down to the eyeball.
  * EyeLid   – ceramic spherical shells just above the lens; they rotate
               about the eyeball centre (local X) to blink or smile, so they
               always stay on the sphere and slide under the bezel.
The mouth is a swept groove with "Smile", "Sad" and "Wow" shape keys.
"""
import numpy as np

from .surfaces import FRONT, project, catmull_rom_open, normalize, surface_normal
from .mesh_io import create_object, add_shape_key, grid_faces, grid_normals
from .outlines import (HEAD, EYE_CENTER_PX, IRIS_OFFSET_PX, IRIS_RADIUS_PX, MOUTH_NEUTRAL_PX,
                       MOUTH_SAD_PX, MOUTH_SMILE_PX, MOUTH_WOW_PX, mirrored, to_model)
from .head import Seams

FACE_OFFSET = 0.007
EYE_RADIUS = 0.5
EYE_RECESS = 0.036
LID_GAP = 0.004
BEZEL_GAP = 0.009
BEZEL_WIDTH = 0.032
# flange tucked under the face plate so no seam shows the lids behind
FLANGE_WIDTH = 0.018
FLANGE_DEPTH = 0.012


def face_point(xz):
    uv = project(HEAD, FRONT, np.atleast_2d(xz))
    n = surface_normal(HEAD, FRONT, uv)
    return HEAD.point(FRONT.direction(uv)) + n * FACE_OFFSET, n


class EyeFrame:
    def __init__(self, centre_px, side):
        p, n = face_point(to_model([centre_px]))
        self.side = side
        self.fwd = n[0]
        right = np.array([1.0, 0, 0])
        self.right = normalize(right - self.fwd * (right @ self.fwd))
        self.up = np.cross(self.fwd, self.right)
        self.centre = p[0] - self.fwd * (EYE_RADIUS + EYE_RECESS)
        # Blender local axes for the lid pivot: X=right, Y=back, Z=up.
        m = np.eye(4)
        m[:3, 0], m[:3, 1], m[:3, 2], m[:3, 3] = self.right, -self.fwd, self.up, self.centre
        self.matrix = m

    def angles(self, points):
        v = points - self.centre
        el = np.arctan2(v @ self.up, v @ self.fwd)
        az = np.arcsin(np.clip((v @ self.right) / np.linalg.norm(v, axis=1), -1, 1))
        return az, el

    def sphere(self, az, el, radius):
        az, el = np.broadcast_arrays(az, el)
        d = (np.sin(az)[..., None] * self.right
             + np.cos(az)[..., None] * (np.cos(el)[..., None] * self.fwd + np.sin(el)[..., None] * self.up))
        return self.centre + d * radius


def build_lens(frame, opening, material, parent, name):
    az, el = frame.angles(opening)
    m = 0.05
    a = np.linspace(az.min() - m, az.max() + m, 56)
    e = np.linspace(el.min() - m, el.max() + m, 48)
    A, E = np.meshgrid(a, e)
    pts = frame.sphere(A, E, EYE_RADIUS)
    normals = normalize(pts - frame.centre)
    # UV: horizontal angle mirrored so +u always points to the nose.
    uv = np.stack([A.ravel() * -frame.side, E.ravel()], -1)
    return create_object(name, pts.reshape(-1, 3), grid_faces(*A.shape), material, parent,
                         normals=normals.reshape(-1, 3), uv=uv)


def build_bezel(frame, opening, material, parent, name):
    rows = 14
    a = opening
    toward_axis = frame.centre + frame.fwd * ((a - frame.centre) @ frame.fwd)[:, None] - a
    toward_axis = normalize(toward_axis - frame.fwd * (toward_axis @ frame.fwd)[:, None])
    start = a - frame.fwd * 0.004
    inner = start + toward_axis * BEZEL_WIDTH
    end = frame.centre + normalize(inner - frame.centre) * (EYE_RADIUS + BEZEL_GAP)
    end_normal = normalize(end - frame.centre)
    drop = np.abs(((start - end) * frame.fwd).sum(1))[:, None]
    p1 = start + toward_axis * BEZEL_WIDTH * 0.75
    p2 = end + end_normal * drop * 0.8
    t = np.linspace(0, 1, rows)[:, None, None]
    curve = ((1 - t) ** 3 * start + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2
             + t ** 3 * end)
    flange = a - toward_axis * FLANGE_WIDTH - frame.fwd * FLANGE_DEPTH
    lead = np.linspace(0, 1, 4)[:-1, None, None]
    curve = np.concatenate([(1 - lead) * flange + lead * start, curve])
    rows = len(curve)
    normals = grid_normals(curve)
    if (normals[0] @ frame.fwd).mean() < 0:
        normals = -normals
        faces = [f[::-1] for f in grid_faces(rows, len(a), wrap=True)]
    else:
        faces = grid_faces(rows, len(a), wrap=True)
    return create_object(name, curve.reshape(-1, 3), faces, material, parent,
                         normals=normals.reshape(-1, 3))


def build_lid(frame, edge, span, az_range, radius, material, parent, name, upward):
    """Spherical lid strip. edge(az) is the free edge elevation; the shell extends
    away from the opening (up for the upper lid, down for the lower lid)."""
    cols, rows = 48, 26
    a = np.linspace(-az_range, az_range, cols)
    s = np.linspace(0, 1, rows)[:, None]
    direction = 1 if upward else -1
    el = edge(a)[None, :] + direction * span * s ** 1.15
    # roll the free edge slightly towards the lens for a soft rim
    r = radius - 0.0025 * np.exp(-s / 0.04)
    A = np.broadcast_to(a, el.shape)
    pts = frame.sphere(A, el, 1.0)
    pts = frame.centre + (pts - frame.centre) * r[..., None] if np.ndim(r) else pts
    normals = grid_normals(pts)
    faces = grid_faces(rows, cols)
    if (normals.reshape(-1, 3) @ frame.fwd).mean() < 0:
        normals = -normals
        faces = [f[::-1] for f in faces]
    return create_object(name, pts.reshape(-1, 3), faces, material, parent,
                         normals=normals.reshape(-1, 3), frame=frame.matrix)


def build_eye(seams_eye, centre_px, side, materials, parent, label):
    frame = EyeFrame(centre_px, side)
    uv = FRONT.uv(seams_eye)
    opening = HEAD.point(FRONT.direction(uv)) + surface_normal(HEAD, FRONT, uv) * FACE_OFFSET
    lens = build_lens(frame, opening, materials["EyeLens"], parent, f"EyeLens{label}")
    iris_px = (centre_px[0] + IRIS_OFFSET_PX[0] * -side, centre_px[1] + IRIS_OFFSET_PX[1])
    iris_point, _ = face_point(to_model([iris_px]))
    iris_az, iris_el = frame.angles(iris_point)
    lens["irisCenter"] = [float(iris_az[0] * -side), float(iris_el[0])]
    lens["irisRadius"] = float(IRIS_RADIUS_PX / 500 / EYE_RADIUS * 1.12)
    build_bezel(frame, opening, materials["GraphiteGloss"], parent, f"EyeBezel{label}")

    az, el = frame.angles(opening)
    az_range = np.abs(az).max() + 0.08
    top, bottom = el.max(), el.min()
    height = top - bottom
    upper_edge_open = top + 0.1
    # lids meet high so the upper lid stays short (it must hide below the dome floor)
    meet = bottom + height * 0.62
    upper = build_lid(frame, lambda a: upper_edge_open - 0.05 * (1 - (a / az_range) ** 2),
                      (top - meet) + 0.04, az_range,
                      EYE_RADIUS + LID_GAP + 0.0015,
                      materials["EyeLid"], parent, f"EyeLidUpper{label}", True)
    upper["blinkAngle"] = float(upper_edge_open - meet)
    upper["smileAngle"] = float(0.1 + height * 0.1)
    lower_edge_open = bottom - 0.08
    arc = 0.2
    lower = build_lid(frame, lambda a: lower_edge_open - arc + arc * (1 - (a / az_range) ** 2),
                      height * 0.9 + arc, az_range, EYE_RADIUS + LID_GAP, materials["EyeLid"], parent,
                      f"EyeLidLower{label}", False)
    lower["blinkAngle"] = -float(meet - lower_edge_open + 0.02)
    lower["smileAngle"] = -float(height * 0.5 + 0.08)
    return frame


def mouth_tube(points_px, radius_mid, radius_end, rings=96, sides=14):
    xz = to_model([(627 + dx, y) for dx, y in points_px])
    path = catmull_rom_open(xz, rings)
    p, n = face_point(path)
    t = np.linspace(0, 1, len(p))
    radius = radius_end + (radius_mid - radius_end) * np.sin(np.pi * t) ** 1.2
    tangent = normalize(np.gradient(p, axis=0))
    binormal = normalize(np.cross(tangent, n))
    centre = p - n * radius[:, None] * 0.35
    angle = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    ring = (np.cos(angle)[None, :, None] * n[:, None, :] * 0.55
            + np.sin(angle)[None, :, None] * binormal[:, None, :])
    verts = centre[:, None, :] + ring * radius[:, None, None]
    return verts, ring


def build_mouth(materials, parent):
    # crescent groove: thick in the middle, tapering to fine ends (reference art)
    verts, ring = mouth_tube(MOUTH_NEUTRAL_PX, 0.013, 0.0025)
    smile, _ = mouth_tube(MOUTH_SMILE_PX, 0.016, 0.004)
    sad, _ = mouth_tube(MOUTH_SAD_PX, 0.006, 0.0035)
    wow, _ = mouth_tube(MOUTH_WOW_PX, 0.014, 0.008)
    rings, sides = verts.shape[:2]
    faces = grid_faces(rings, sides, wrap=True)
    cap = rings * sides
    flat = np.vstack([verts.reshape(-1, 3), verts[0].mean(0), verts[-1].mean(0)])
    for c in range(sides):
        c2 = (c + 1) % sides
        faces.append((cap, c2, c))
        faces.append((cap + 1, (rings - 1) * sides + c, (rings - 1) * sides + c2))
    normals = np.vstack([normalize(ring.reshape(-1, 3)), -normalize(verts[1, 0] - verts[0, 0])[None],
                         normalize(verts[-1, 0] - verts[-2, 0])[None]])
    mouth = create_object("Mouth", flat, faces, materials["Mouth"], parent, normals=normals)
    for name, shape in (("Smile", smile), ("Sad", sad), ("Wow", wow)):
        add_shape_key(mouth, name, np.vstack([shape.reshape(-1, 3), shape[0].mean(0), shape[-1].mean(0)]))
    return mouth


def build_face(materials, head, body):
    seams = Seams()
    build_eye(seams.eyes[0], EYE_CENTER_PX, -1, materials, head, "Left")
    build_eye(seams.eyes[1], mirrored([EYE_CENTER_PX])[0], 1, materials, head, "Right")
    build_mouth(materials, head)
