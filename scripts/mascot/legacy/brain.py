import math
from .primitives import curve, ellipsoid


BRANCHES = [
    [(635, 505), (646, 410), (625, 320), (670, 132)],
    [(640, 410), (510, 300), (385, 296)],
    [(510, 300), (520, 170)],
    [(510, 300), (425, 382)],
    [(640, 410), (770, 310), (843, 239)],
    [(770, 310), (930, 339)],
    [(770, 310), (925, 440)],
    [(635, 360), (600, 180)],
]


def on_dome(pixel):
    px, py = pixel
    x = (px / 1254 - .5) * 3.45
    z = 1.725 - py / 1254 * 3.45
    y = -.85 * math.sqrt(max(.045, 1 - (x / 1.2) ** 2 - ((z - .45) / 1.15) ** 2)) - .065
    return x, y, z


def build_brain(parent, materials):
    for index, branch in enumerate(BRANCHES):
        points = [on_dome(pixel) for pixel in branch]
        curve(f"BrainHalo{index}", points, .018, materials["cyan"], parent)
        curve(f"BrainBranch{index}", [(x, y - .012, z) for x, y, z in points],
              .007, materials["ice"], parent)
        end = points[-1]
        ellipsoid(f"BrainNode{index}", (end[0], end[1] - .035, end[2]),
                  (.026, .026, .026), materials["ice"], parent)
