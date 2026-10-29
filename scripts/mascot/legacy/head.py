import math
import bpy
from .primitives import ellipsoid, surface, projected_uv, curve, cylinder, torus


def hemisphere(name, parent, material, front=True):
    vertices, faces = [], []
    rings, slices = 30, 64
    start = math.pi if front else 0
    for row in range(rings + 1):
        theta = row / rings * math.pi / 2
        for column in range(slices + 1):
            phi = start + column / slices * math.pi
            vertices.append((1.2 * math.sin(theta) * math.cos(phi),
                             .85 * math.sin(theta) * math.sin(phi),
                             .45 + 1.15 * math.cos(theta)))
    for row in range(rings):
        for column in range(slices):
            index = row * (slices + 1) + column
            faces.append((index, index + 1, index + slices + 2, index + slices + 1))
    return surface(name, vertices, faces, material, parent, .025)


def face_plate(parent, material):
    vertices, faces = [], []
    columns, rows = 64, 32
    for row in range(rows + 1):
        v = row / rows
        for column in range(columns + 1):
            u = (column / columns) * 2 - 1
            x = 1.12 * u * (1 - .14 * v * v)
            top = .29 + .31 * abs(u) ** 1.5
            bottom = -.83 + .58 * abs(u) ** 1.7
            z = top * (1 - v) + bottom * v
            y = -.88 * math.sqrt(max(.04, 1 - (x / 1.25) ** 2 - ((z - .35) / 1.22) ** 2)) - .045
            vertices.append((x, y, z))
    for row in range(rows):
        for column in range(columns):
            index = row * (columns + 1) + column
            faces.append((index, index + 1, index + columns + 2, index + columns + 1))
    return surface("FacePlate", vertices, faces, material, parent, .035)


def build_head(parent, materials):
    ellipsoid("GraphiteHeadVolume", (0, .02, .34), (1.2, .84, 1.17), materials["dark"], parent)
    dome_front = hemisphere("DomeFront", parent, materials["dome_image"])
    hemisphere("DomeBack", parent, materials["dome"], False)
    face = face_plate(parent, materials["face_image"])
    projected_uv(dome_front)
    projected_uv(face)

    rim = [(1.18 * math.cos(index * math.tau / 96),
            .84 * math.sin(index * math.tau / 96), .45) for index in range(97)]
    curve("DomeChromeRim", rim, .035, materials["chrome"], parent)
    curve("DomeBlueRim", [(x, y, z + .045) for x, y, z in rim], .012, materials["cyan"], parent)

    top_edge = []
    for index in range(49):
        u = index / 48 * 2 - 1
        x = 1.12 * u
        z = .29 + .31 * abs(u) ** 1.5
        y = -.88 * math.sqrt(max(.04, 1 - (x / 1.25) ** 2 - ((z - .35) / 1.22) ** 2)) - .06
        top_edge.append((x, y, z))
    curve("FacePlateTopSeam", top_edge, .018, materials["dark"], parent)

    for side, label in ((-1, "Left"), (1, "Right")):
        ear = ellipsoid(f"EarHousing{label}", (side * 1.22, -.06, .05), (.22, .38, .35), materials["dark"], parent)
        ellipsoid(f"EarCeramic{label}", (side * 1.28, -.18, .05), (.16, .3, .29), materials["white"], parent)
        curve(f"EarLight{label}", [(side * 1.38, -.42, z) for z in (-.16, -.05, .08, .2, .28)],
              .026, materials["cyan"], parent)
        cylinder(f"EarDisc{label}", (side * 1.42, .0, .06), .25, .07,
                 materials["dark"], parent, (0, math.pi / 2, 0))
        torus(f"EarRing{label}", (side * 1.47, .0, .06), .17, .022,
              materials["cyan"], parent, (0, math.pi / 2, 0))

    return parent
