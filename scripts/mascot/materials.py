"""Named materials. The web runtime replaces them by name with tuned
three.js materials; the Blender values only drive the preview render."""
import bpy

SPECS = {
    "Ceramic": dict(color=(0.80, 0.82, 0.86), roughness=0.32),
    "Graphite": dict(color=(0.035, 0.04, 0.05), metallic=0.4, roughness=0.36),
    "GraphiteGloss": dict(color=(0.02, 0.025, 0.035), metallic=0.3, roughness=0.18),
    "Titanium": dict(color=(0.32, 0.35, 0.4), metallic=0.8, roughness=0.3),
    "Cavity": dict(color=(0.01, 0.015, 0.03), roughness=0.5),
    "Glass": dict(color=(1, 1, 1), roughness=0.02, transmission=1.0),
    "Light": dict(color=(0.1, 0.6, 1), emission=(0.1, 0.6, 1), strength=6),
    "EyeLens": dict(color=(0.01, 0.015, 0.03), roughness=0.08),
    "EyeLid": dict(color=(0.80, 0.82, 0.86), roughness=0.32),
    "Mouth": dict(color=(0.02, 0.025, 0.035), roughness=0.3),
    "Logo": dict(color=(0.04, 0.35, 0.95), roughness=0.3),
    "LogoMark": dict(color=(0.04, 0.35, 0.95), roughness=0.3),
    "Brain": dict(color=(0.02, 0.08, 0.35), emission=(0.05, 0.3, 1), strength=0.6),
}


def build_materials():
    materials = {}
    for name, spec in SPECS.items():
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        material.diffuse_color = (*spec["color"], 1)
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*spec["color"], 1)
        bsdf.inputs["Metallic"].default_value = spec.get("metallic", 0.0)
        bsdf.inputs["Roughness"].default_value = spec.get("roughness", 0.4)
        if "transmission" in spec:
            bsdf.inputs["Transmission Weight"].default_value = spec["transmission"]
        if "emission" in spec:
            bsdf.inputs["Emission Color"].default_value = (*spec["emission"], 1)
            bsdf.inputs["Emission Strength"].default_value = spec["strength"]
        materials[name] = material
    return materials
