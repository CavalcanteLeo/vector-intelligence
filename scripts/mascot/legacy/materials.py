import bpy


def pbr(name, color, metallic=0.0, roughness=0.3, emission=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    node = material.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = (*color, 1)
    node.inputs["Metallic"].default_value = metallic
    node.inputs["Roughness"].default_value = roughness
    if emission:
        node.inputs["Emission Color"].default_value = (*emission, 1)
        node.inputs["Emission Strength"].default_value = 2.5
    return material


def projected(name, image_path, metallic=0.1, roughness=0.25):
    material = pbr(name, (1, 1, 1), metallic, roughness)
    nodes = material.node_tree.nodes
    image = nodes.new("ShaderNodeTexImage")
    image.image = bpy.data.images.load(image_path, check_existing=True)
    image.image.pack()
    principled = nodes.get("Principled BSDF")
    material.node_tree.links.new(image.outputs["Color"], principled.inputs["Base Color"])
    material.node_tree.links.new(image.outputs["Alpha"], principled.inputs["Alpha"])
    return material


def all_materials(image_path):
    return {
        "white": pbr("Ceramic white", (.79, .85, .96), .16, .23),
        "dark": pbr("Graphite shell", (.012, .025, .06), .36, .28),
        "black": pbr("Eye glass", (.002, .008, .025), .22, .08),
        "chrome": pbr("Silver trim", (.48, .58, .76), .82, .18),
        "dome": pbr("Sapphire dome", (.008, .09, .44), .52, .13),
        "cyan": pbr("Cyan light", (.02, .3, .72), .05, .22, (.03, .64, 1)),
        "ice": pbr("Ice light", (.56, .9, 1), .0, .2, (.7, .93, 1)),
        "face_image": projected("Original face paint", image_path, .08, .32),
        "dome_image": projected("Original cranial paint", image_path, .4, .16),
        "body_image": projected("Original armor paint", image_path, .18, .28),
    }
