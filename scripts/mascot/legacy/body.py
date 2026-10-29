import math
from .primitives import ellipsoid, cylinder, torus, curve, projected_uv


def build_body(parent, materials):
    cylinder("NeckCore", (0, 0, -.99), .43, .48, materials["dark"], parent)
    torus("CollarLight", (0, 0, -1.04), .47, .04, materials["cyan"], parent)
    torus("CollarTrim", (0, 0, -1.1), .53, .05, materials["chrome"], parent)
    ellipsoid("InnerTorso", (0, .08, -1.56), (1.09, .65, .8), materials["dark"], parent)
    front = ellipsoid("FrontArmor", (0, -.37, -1.64), (.88, .36, .57), materials["body_image"], parent)
    projected_uv(front)
    for side, label in ((-1, "Left"), (1, "Right")):
        ellipsoid(f"ShoulderJoint{label}", (side * 1.05, .04, -1.42), (.49, .47, .5), materials["dark"], parent)
        ellipsoid(f"ShoulderArmor{label}", (side * 1.08, -.22, -1.4), (.46, .39, .43), materials["white"], parent)
        curve(f"ShoulderLight{label}", [(side * .78, -.57, z) for z in (-1.18, -1.36, -1.58)],
              .027, materials["cyan"], parent)
