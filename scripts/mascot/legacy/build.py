import bpy
import math
import os
import sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.insert(0, ROOT)

from scripts.mascot.materials import all_materials
from scripts.mascot.primitives import ellipsoid
from scripts.mascot.head import build_head
from scripts.mascot.brain import build_brain
from scripts.mascot.body import build_body
from scripts.mascot.expressions import build_expressions


def empty(name, parent=None, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.parent = parent
    return obj


def aim(obj, point):
    direction = Vector(point) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_setup():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.world.color = (.8, .8, .8)

    bpy.ops.object.camera_add(location=(0, -7, -.13))
    camera = bpy.context.object
    camera.name = "PreviewCamera"
    aim(camera, (0, 0, -.13))
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 3.65
    scene.camera = camera

    for name, location, power, size in [
        ("Key", (-3, -5, 5), 950, 4),
        ("Fill", (4, -3, 2), 600, 3),
        ("Rim", (1, 3, 4), 1100, 2),
    ]:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = power
        light.data.shape = "DISK"
        light.data.size = size
        aim(light, (0, 0, 0))


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    image = os.path.join(ROOT, "public/assets/images/vector-intelligence-mascote-cutout.png")
    materials = all_materials(image)
    body_rig = empty("BodyRig")
    head_rig = empty("HeadRig", body_rig, (0, 0, -.87))
    head_geometry = empty("HeadGeometry", head_rig, (0, 0, .87))

    build_body(body_rig, materials)
    build_head(head_geometry, materials)
    build_brain(head_geometry, materials)
    build_expressions(head_geometry, materials)

    expression_objects = [obj for obj in bpy.data.objects if obj.name.startswith(("EyeCover", "Happy")) or obj.name == "MouthCover"]
    for obj in expression_objects:
        obj.hide_render = True

    render_setup()
    os.makedirs(os.path.join(ROOT, "public/assets/models"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "assets/mascot"), exist_ok=True)
    blend_path = os.path.join(ROOT, "assets/mascot/vector-intelligence-mascot.blend")
    glb_path = os.path.join(ROOT, "public/assets/models/vector-intelligence-mascot.glb")
    preview_path = os.path.join(ROOT, "assets/mascot/preview.png")

    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    scene = bpy.context.scene
    scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)
    for obj in expression_objects:
        obj.hide_render = False
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", export_cameras=False,
                              export_lights=False, export_apply=True)
    print("MODEL_EXPORT", glb_path)


if __name__ == "__main__":
    main()
