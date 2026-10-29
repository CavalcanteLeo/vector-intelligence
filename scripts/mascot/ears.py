"""Ear housings: graphite cups with a titanium rim, a light ring and a glossy cap."""
import numpy as np

from .solids import revolve, tube

EAR_CENTRE = (0.80, 0.03, 0.64)
SCALE = (1.08, 0.93)  # (vertical, depth)

SHELL = [(0.0, -0.07), (0.22, -0.07), (0.262, -0.04), (0.292, 0.02), (0.308, 0.08), (0.312, 0.13)]
RIM = [(0.312, 0.13), (0.306, 0.168), (0.29, 0.196), (0.266, 0.212), (0.246, 0.217)]
CAP = [(0.214, 0.21), (0.19, 0.222), (0.12, 0.234), (0.0, 0.238)]


def build_ears(materials, head, body):
    for side, label in ((-1, "Left"), (1, "Right")):
        origin = np.array(EAR_CENTRE) * [side, 1, 1]
        frame = (origin, (side, 0, 0), (0, 0, 1))
        revolve(f"EarShell{label}", SHELL, frame, materials["Graphite"], head, scale=SCALE, samples=40)
        revolve(f"EarRim{label}", RIM, frame, materials["Titanium"], head, scale=SCALE, samples=24)
        revolve(f"EarCap{label}", CAP, frame, materials["GraphiteGloss"], head, scale=SCALE, samples=20)
        angle = np.linspace(0, 2 * np.pi, 128, endpoint=False)
        r = 0.299
        ring = origin + np.stack([np.full_like(angle, 0.176 * side),
                                  np.sin(angle) * r * SCALE[1], np.cos(angle) * r * SCALE[0]], -1)
        tube(f"EarLight{label}", ring, 0.021, materials["Light"], head, sides=12, closed=True)
