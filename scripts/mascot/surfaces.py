"""Analytic surfaces and charts.

Every shell of the mascot is a region of a smooth analytic surface, so
neighbouring panels share exact boundaries and normals are computed from
the surface itself instead of from an irregular mesh.
"""
import numpy as np

# Reference image -> model space (Blender: X right, -Y front, Z up).
PX_PER_UNIT = 500.0
IMAGE_CENTER_X = 627.0
IMAGE_NECK_Y = 960.0


def ref(px, py):
    """Convert reference image pixels to model x/z."""
    return ((px - IMAGE_CENTER_X) / PX_PER_UNIT, (IMAGE_NECK_Y - py) / PX_PER_UNIT)


def normalize(v):
    v = np.asarray(v, dtype=float)
    return v / np.linalg.norm(v, axis=-1, keepdims=True)


def spow(x, e):
    return np.sign(x) * np.abs(x) ** e


class SuperEgg:
    """Superellipsoid of revolution with different top/bottom curvature."""

    def __init__(self, center, a, b, top, bottom, p_top=2.0, p_bottom=2.0, q=2.0):
        self.center = np.asarray(center, dtype=float)
        self.a, self.b, self.top, self.bottom = a, b, top, bottom
        self.p_top, self.p_bottom, self.q = p_top, p_bottom, q

    def point(self, d):
        d = normalize(d)
        c = np.clip(d[..., 2], -1, 1)
        s = np.sqrt(np.maximum(0.0, 1 - c * c))
        upper = c >= 0
        p = np.where(upper, self.p_top, self.p_bottom)
        z = np.where(upper, self.top, self.bottom) * spow(c, 2 / p)
        r = s ** (2 / p)
        h = np.maximum(np.hypot(d[..., 0], d[..., 1]), 1e-12)
        x = self.a * r * spow(d[..., 0] / h, 2 / self.q)
        y = self.b * r * spow(d[..., 1] / h, 2 / self.q)
        return np.stack([x, y, z], -1) + self.center

    def direction_at_height(self, theta, z):
        """Direction whose surface point has height z at azimuth theta (0 = front)."""
        t = (np.asarray(z, dtype=float) - self.center[2])
        c = np.where(t >= 0, np.clip(t / self.top, 0, 1) ** (self.p_top / 2),
                     -np.clip(-t / self.bottom, 0, 1) ** (self.p_bottom / 2))
        s = np.sqrt(np.maximum(0, 1 - c * c))
        return np.stack([s * np.sin(theta), -s * np.cos(theta), c], -1)


class Chart:
    """Azimuthal equidistant chart of the unit sphere around axis n."""

    def __init__(self, n, e1):
        self.n = normalize(n)
        self.e1 = normalize(e1)
        self.e2 = np.cross(self.n, self.e1)

    def direction(self, uv):
        uv = np.asarray(uv, dtype=float)
        rho = np.linalg.norm(uv, axis=-1, keepdims=True)
        k = np.where(rho > 1e-9, np.sin(rho) / np.maximum(rho, 1e-9), 1.0)
        return np.cos(rho) * self.n + k * (uv[..., :1] * self.e1 + uv[..., 1:] * self.e2)

    def uv(self, d):
        d = normalize(d)
        rho = np.arccos(np.clip(d @ self.n, -1, 1))[..., None]
        t = np.stack([d @ self.e1, d @ self.e2], -1)
        return rho * t / np.maximum(np.linalg.norm(t, axis=-1, keepdims=True), 1e-12)


FRONT = Chart((0, -1, 0), (1, 0, 0))
TOP = Chart((0, 0, 1), (1, 0, 0))
BACK = Chart((0, 1, 0), (-1, 0, 0))
BOTTOM = Chart((0, 0, -1), (1, 0, 0))


def surface_normal(surface, chart, uv, eps=1e-4):
    uv = np.asarray(uv, dtype=float)
    du = np.array([eps, 0.0])
    dv = np.array([0.0, eps])
    pu = surface.point(chart.direction(uv + du)) - surface.point(chart.direction(uv - du))
    pv = surface.point(chart.direction(uv + dv)) - surface.point(chart.direction(uv - dv))
    return normalize(np.cross(pu, pv))


def project(surface, chart, targets, axes=(0, 2), iterations=12):
    """Find chart uv whose surface point matches targets on the given axes.

    Used to trace outlines from the orthographic reference straight onto
    the curved surfaces (front view uses x/z).
    """
    targets = np.asarray(targets, dtype=float)
    guess = np.zeros(targets.shape[:-1] + (3,))
    guess[..., axes[0]] = targets[..., 0] - surface.center[axes[0]]
    guess[..., axes[1]] = targets[..., 1] - surface.center[axes[1]]
    free = 3 - axes[0] - axes[1]
    guess[..., free] = -0.6 if chart is FRONT else 0.6
    uv = chart.uv(guess)
    eps = 1e-5
    for _ in range(iterations):
        def f(q):
            p = surface.point(chart.direction(q))
            return np.stack([p[..., axes[0]], p[..., axes[1]]], -1)
        r = f(uv) - targets
        ju = (f(uv + [eps, 0]) - f(uv - [eps, 0])) / (2 * eps)
        jv = (f(uv + [0, eps]) - f(uv - [0, eps])) / (2 * eps)
        det = ju[..., 0] * jv[..., 1] - ju[..., 1] * jv[..., 0]
        det = np.where(np.abs(det) < 1e-9, 1e-9, det)
        step_u = (r[..., 0] * jv[..., 1] - r[..., 1] * jv[..., 0]) / det
        step_v = (ju[..., 0] * r[..., 1] - ju[..., 1] * r[..., 0]) / det
        uv = uv - np.stack([step_u, step_v], -1)
    return uv


def catmull_rom_loop(points, samples_per_segment=24):
    """Closed, smooth curve through control points (centripetal-ish uniform)."""
    p = np.asarray(points, dtype=float)
    n = len(p)
    out = []
    for i in range(n):
        p0, p1, p2, p3 = p[(i - 1) % n], p[i], p[(i + 1) % n], p[(i + 2) % n]
        for t in np.linspace(0, 1, samples_per_segment, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    return np.array(out)


def catmull_rom_open(points, samples=64):
    p = np.asarray(points, dtype=float)
    p = np.vstack([2 * p[0] - p[1], p, 2 * p[-1] - p[-2]])
    per = max(2, samples // (len(p) - 3))
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for t in np.linspace(0, 1, per, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(p[-2])
    return np.array(out)
