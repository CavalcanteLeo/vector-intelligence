from .primitives import ellipsoid, curve


def build_expressions(parent, materials):
    for side, label in ((-1, "Left"), (1, "Right")):
        ellipsoid(f"EyeCover{label}", (side * .56, -.87, -.08),
                  (.31, .045, .22), materials["white"], parent)
        curve(f"HappyEye{label}", [
            (side * .84, -.915, -.12),
            (side * .56, -.95, -.02),
            (side * .28, -.915, -.12),
        ], .026, materials["black"], parent)
        ellipsoid(f"HappyCheek{label}", (side * .83, -.7, -.4),
                  (.13, .018, .055), materials["cyan"], parent)

    ellipsoid("MouthCover", (0, -.7, -.53), (.32, .04, .13), materials["white"], parent)
    curve("HappyMouth", [(-.29, -.75, -.49), (-.16, -.77, -.6),
                         (0, -.78, -.64), (.16, -.77, -.6), (.29, -.75, -.49)],
          .024, materials["black"], parent)
