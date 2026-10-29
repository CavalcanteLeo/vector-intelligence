"""Build the Vector Intelligence mascot.

    blender -b --factory-startup -P scripts/mascot/build.py [-- --preview]

Outputs:
    assets/mascot/vector-intelligence-mascot-v2.blend   (editable source)
    public/assets/models/vector-intelligence-mascot-v2.glb (web asset, Draco-compressed;
        decoder in public/assets/draco, copied from three/examples/jsm/libs/draco/gltf)
    assets/mascot/previews/*.png                         (with --preview)
"""
import math
import os
import sys

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.insert(0, ROOT)

from scripts.mascot.materials import build_materials  # noqa: E402
from scripts.mascot.mesh_io import empty  # noqa: E402
from scripts.mascot.outlines import NECK_PIVOT  # noqa: E402
from scripts.mascot.head import build_head  # noqa: E402

BLEND = os.path.join(ROOT, "assets/mascot/vector-intelligence-mascot-v2.blend")
GLB = os.path.join(ROOT, "public/assets/models/vector-intelligence-mascot-v2.glb")
PREVIEWS = os.path.join(ROOT, "assets/mascot/previews")


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def build():
    materials = build_materials()
    body = empty("BodyRig")
    head = empty("HeadRig", NECK_PIVOT, body)
    build_head(materials, head)
    for module, fn in PARTS:
        getattr(__import__(f"scripts.mascot.{module}", fromlist=[fn]), fn)(materials, head, body)


# Geometry compression (decoded in the browser by three's DRACOLoader).
# Quantization is high enough to be visually lossless on the glossy shells.
DRACO = dict(
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=10,
    export_draco_position_quantization=16,
    export_draco_normal_quantization=12,
    export_draco_texcoord_quantization=14,
    export_draco_color_quantization=10,
    export_draco_generic_quantization=14,
)

# Optional parts are registered here as they are implemented.
PARTS = [
    ("face", "build_face"),
    ("ears", "build_ears"),
    ("body", "build_body"),
    ("badge", "build_badge"),
    ("brain", "build_brain"),
]


def available_parts():
    here = os.path.dirname(__file__)
    return [(m, f) for m, f in PARTS if os.path.exists(os.path.join(here, f"{m}.py"))]


def render_previews():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_specular_highlight = True
    scene.render.resolution_x = scene.render.resolution_y = 900
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("World")
    scene.world = world
    cam_data = bpy.data.cameras.new("PreviewCamera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 2.9
    cam = bpy.data.objects.new("PreviewCamera", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    os.makedirs(PREVIEWS, exist_ok=True)
    for name, angle in [("front", 0), ("three-quarter", 40), ("side", 90), ("back", 180)]:
        a = math.radians(angle)
        cam.location = (7 * math.sin(a), -7 * math.cos(a), 0.6)
        cam.rotation_euler = (math.radians(90), 0, a)
        scene.render.filepath = os.path.join(PREVIEWS, f"{name}.png")
        bpy.ops.render.render(write_still=True)
    # Orthographic match of the reference framing (1254px == 2.508 units).
    cam_data.ortho_scale = 2.508
    cam.location = (0, -7, 0.666)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.render.resolution_x = scene.render.resolution_y = 627
    scene.render.film_transparent = True
    scene.render.filepath = os.path.join(PREVIEWS, "match.png")
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


def main():
    global PARTS
    reset()
    PARTS = available_parts()
    build()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
    bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", export_cameras=False,
                              export_lights=False, export_extras=True, export_morph=True,
                              export_morph_normal=False, export_vertex_color="ACTIVE",
                              export_apply=True, **DRACO)
    if "--preview" in sys.argv:
        render_previews()
    print("MASCOT_EXPORT", GLB)


if __name__ == "__main__":
    main()
