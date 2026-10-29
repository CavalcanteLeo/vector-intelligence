"""Blender object creation from numpy geometry."""
import bpy
import numpy as np
from mathutils import Matrix


def create_object(name, verts, faces, material, parent=None, normals=None, uv=None,
                  colors=None, frame=None):
    """Create a smooth-shaded mesh object.

    verts are given in world space; when frame (4x4) is provided the object
    origin/orientation is set to it and verts are stored in its local space.
    """
    verts = np.asarray(verts, dtype=float)
    world = Matrix.Identity(4) if frame is None else Matrix(frame)
    if frame is not None:
        inv = np.array(world.inverted())
        verts = verts @ inv[:3, :3].T + inv[:3, 3]
        if normals is not None:
            normals = np.asarray(normals) @ inv[:3, :3].T
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts.tolist(), [], [list(map(int, f)) for f in faces])
    mesh.update()
    mesh.shade_smooth()
    if normals is not None:
        n = np.asarray(normals, dtype=float)
        length = np.linalg.norm(n, axis=1, keepdims=True)
        if not np.all(length > 1e-12):
            print("DEGENERATE_NORMALS", name, int(np.sum(length <= 1e-12) + np.isnan(length).sum()))
        n /= np.maximum(length, 1e-12)
        mesh.normals_split_custom_set_from_vertices(n.tolist())
    if uv is not None:
        layer = mesh.uv_layers.new(name="UVMap")
        loop_vertex = np.zeros(len(mesh.loops), dtype=np.int32)
        mesh.loops.foreach_get("vertex_index", loop_vertex)
        layer.data.foreach_set("uv", np.asarray(uv, dtype=np.float32)[loop_vertex].ravel())
    if colors is not None:
        attribute = mesh.color_attributes.new("Color", "FLOAT_COLOR", "POINT")
        c = np.asarray(colors, dtype=np.float32)
        if c.shape[1] == 3:
            c = np.hstack([c, np.ones((len(c), 1), np.float32)])
        attribute.data.foreach_set("color", c.ravel())
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.matrix_world = world
    if parent is not None:
        attach(obj, parent)
    return obj


def attach(obj, parent):
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world
    return obj


def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    if parent is not None:
        attach(obj, parent)
    return obj


def add_shape_key(obj, name, world_verts):
    """Add a shape key from world-space vertex positions (same topology)."""
    if obj.data.shape_keys is None:
        obj.shape_key_add(name="Basis")
    key = obj.shape_key_add(name=name)
    inv = np.array(obj.matrix_world.inverted())
    local = np.asarray(world_verts) @ inv[:3, :3].T + inv[:3, 3]
    key.data.foreach_set("co", local.astype(np.float32).ravel())
    return key


def grid_faces(rows, cols, wrap=False):
    """Quad faces for a (rows x cols) vertex grid, optionally wrapping columns."""
    faces = []
    last = cols if wrap else cols - 1
    for r in range(rows - 1):
        for c in range(last):
            c2 = (c + 1) % cols
            faces.append((r * cols + c, r * cols + c2, (r + 1) * cols + c2, (r + 1) * cols + c))
    return faces


def grid_normals(points):
    """Smooth normals for a structured (rows, cols, 3) grid via central differences."""
    pu = np.gradient(points, axis=1)
    pv = np.gradient(points, axis=0)
    n = np.cross(pu, pv)
    return n / np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-12)
