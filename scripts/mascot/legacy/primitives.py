import bpy
import math
from mathutils import Vector


def attach(obj, parent):
    obj.parent = parent
    return obj


def ellipsoid(name, location, scale, material, parent, segments=64):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=32, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return attach(obj, parent)


def cylinder(name, location, radius, depth, material, parent, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Soft machined edge", "BEVEL")
    bevel.width = .045
    bevel.segments = 3
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return attach(obj, parent)


def torus(name, location, major, minor, material, parent, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=96, minor_segments=12, location=location, rotation=rotation,
                                     major_radius=major, minor_radius=minor)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return attach(obj, parent)


def curve(name, points, radius, material, parent):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 24
    data.bevel_depth = radius
    data.bevel_resolution = 4
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return attach(obj, parent)


def projected_uv(obj, top=1.725, width=3.45):
    bpy.context.view_layer.update()
    uv = obj.data.uv_layers.new(name="Front projection")
    for polygon in obj.data.polygons:
        for loop_index in polygon.loop_indices:
            vertex = obj.data.vertices[obj.data.loops[loop_index].vertex_index]
            point = obj.matrix_world @ vertex.co
            uv.data[loop_index].uv = ((point.x / width) + .5, (top - point.z) / width)


def surface(name, vertices, faces, material, parent, thickness=0):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    for face in mesh.polygons:
        face.use_smooth = True
    if thickness:
        modifier = obj.modifiers.new("Shell thickness", "SOLIDIFY")
        modifier.thickness = thickness
        modifier.offset = -1
    return attach(obj, parent)
