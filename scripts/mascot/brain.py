"""Brain hemispheres inside the glass dome.

Each hemisphere is a dense icosphere reshaped into a brain lobe profile
(flat medial face, flatter base, temporal bulge) and carved with gyri:
sulci follow the iso-lines of warped 3D noise, which gives the meandering
labyrinth pattern of a cortex. Machined panel seams (coronal rings and a
lateral band) split each hemisphere into segments so the brain reads as a
robotic part. Vertex colour: R = gyrus crest, G = seam mask, for the
runtime shader (plates shading, glowing seams).
"""
import bmesh
import bpy
import numpy as np
from mathutils import Vector, noise

CENTRE = np.array([0.0, 0.03, 1.28])
RADII = np.array([0.37, 0.66, 0.345])
MEDIAL_GAP = 0.014
GYRI_FREQUENCY = 3.4
GYRI_BANDS = 2.6
SULCUS_DEPTH = 0.018
SEAM_DEPTH = 0.012
SEAM_WIDTH = 0.013
CORONAL_SEAMS = (-0.42, 0.05, 0.5)  # along the lobe (unit-sphere y)
LATERAL_SEAM = 0.32  # height of the lateral band (unit-sphere z)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def icosphere(subdivisions=6):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1.0)
    verts = np.array([v.co[:] for v in bm.verts])
    faces = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    return verts, faces


def lobe_shape(d, side):
    lateral = d[:, 0] * side
    scale = np.ones_like(d)
    scale[:, 0] = 0.32 + 0.68 * smoothstep(-0.45, 0.35, lateral)       # flat medial face
    scale[:, 2] = np.where(d[:, 2] < 0, 0.78, 1.0)                     # flatter base
    scale[:, 1] = np.where(d[:, 1] < 0, 0.96, 1.0)                     # slightly shorter frontal lobe
    p = d * RADII * scale
    temporal = np.exp(-np.sum((d - np.array([0.55 * side, -0.35, -0.65])) ** 2, 1) / 0.18)
    p += d * temporal[:, None] * 0.05
    p[:, 0] += side * (RADII[0] * 0.32 + MEDIAL_GAP)
    return p


def gyri(points, side):
    crest = np.empty(len(points))
    for i, p in enumerate(points):
        q = Vector((p[0] * side, p[1], p[2])) * GYRI_FREQUENCY
        warp = noise.turbulence_vector(q * 0.7, 2, False, amplitude_scale=0.5, frequency_scale=2.0)
        n = noise.noise(q + warp * 0.55) + 0.5 * noise.noise(q * 2.1 + warp)
        crest[i] = abs(np.sin(np.pi * GYRI_BANDS * n))
    return crest ** 0.55


def seams(d, side):
    """Machined seam mask (1 on the seam floor), as distance bands on the surface."""
    distance = [np.abs(d[:, 1] - c) * RADII[1] for c in CORONAL_SEAMS]
    lateral = smoothstep(0.15, 0.45, d[:, 0] * side)
    distance.append(np.abs(d[:, 2] - LATERAL_SEAM) * RADII[2] + (1 - lateral))
    return 1 - smoothstep(SEAM_WIDTH * 0.35, SEAM_WIDTH, np.min(distance, 0))


def build_hemisphere(side, label, material, parent):
    d, faces = icosphere()
    p = lobe_shape(d, side)
    crest = gyri(p, side)
    # Lateral (Sylvian) fissure separating the temporal lobe.
    lateral = d[:, 0] * side
    fissure_line = -0.12 + 0.55 * (d[:, 1] + 0.15)
    fissure = np.exp(-((d[:, 2] - fissure_line) / 0.07) ** 2) * smoothstep(0.35, 0.7, lateral)
    fissure *= smoothstep(0.35, -0.1, d[:, 1])
    medial = smoothstep(0.1, -0.35, lateral)  # keep the medial face smooth
    seam = seams(d, side) * (1 - medial)
    depth = (SULCUS_DEPTH * (1 - crest) * (1 - 0.7 * medial) * (1 - seam)
             + 0.035 * fissure + SEAM_DEPTH * seam)
    normal = p / np.linalg.norm(p, axis=1, keepdims=True)
    p = p - normal * depth[:, None] + CENTRE
    mesh = bpy.data.meshes.new(f"Brain{label}")
    mesh.from_pydata(p.tolist(), [], faces)
    mesh.update()
    mesh.shade_smooth()
    color = np.clip(crest * (1 - fissure), 0, 1)
    attribute = mesh.color_attributes.new("Color", "FLOAT_COLOR", "POINT")
    attribute.data.foreach_set("color", np.column_stack([color, seam, color, np.ones_like(color)])
                               .astype(np.float32).ravel())
    mesh.materials.append(material)
    obj = bpy.data.objects.new(f"Brain{label}", mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj


def build_brain(materials, head, body):
    build_hemisphere(-1, "Left", materials["Brain"], head)
    build_hemisphere(1, "Right", materials["Brain"], head)
