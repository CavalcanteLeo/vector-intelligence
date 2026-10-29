"""Shell panels cut from analytic surfaces.

A panel is a region of a surface chart (outer loop + optional holes). It is
triangulated with a constrained Delaunay triangulation that is dense near the
boundary, offset along the surface normal and given a rounded lip so every
edge reads as a machined, thick plate. Normals come from the analytic
position function, so shading is continuous regardless of triangulation.
"""
import numpy as np
from mathutils.geometry import delaunay_2d_cdt

from .surfaces import normalize
from .mesh_io import create_object

LIP_RINGS = np.array([0.0, 0.03, 0.1, 0.2, 0.33, 0.5, 0.7, 0.92, 1.2])


def signed_area(loop):
    x, y = loop[:, 0], loop[:, 1]
    return 0.5 * np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y)


def oriented(loop, ccw=True):
    loop = np.asarray(loop, dtype=float)
    return loop if (signed_area(loop) > 0) == ccw else loop[::-1]


def resample(loop, step):
    closed = np.vstack([loop, loop[:1]])
    seg = np.linalg.norm(np.diff(closed, axis=0), axis=1)
    length = np.concatenate([[0], np.cumsum(seg)])
    count = max(8, int(length[-1] / step))
    t = np.linspace(0, length[-1], count, endpoint=False)
    return np.stack([np.interp(t, length, closed[:, 0]), np.interp(t, length, closed[:, 1])], -1)


def offset_loop(loop, distance):
    """Offset a region-oriented loop (region on the left) into the region."""
    tangent = np.roll(loop, -1, 0) - np.roll(loop, 1, 0)
    tangent /= np.maximum(np.linalg.norm(tangent, axis=1, keepdims=True), 1e-12)
    inward = np.stack([-tangent[:, 1], tangent[:, 0]], -1)
    return loop + inward * distance


def distance_to_loops(points, loops):
    best = np.full(len(points), np.inf)
    for loop in loops:
        a = loop
        b = np.roll(loop, -1, 0)
        ab = b - a
        denom = np.maximum(np.sum(ab * ab, 1), 1e-18)
        for start in range(0, len(points), 4096):
            p = points[start:start + 4096, None, :]
            t = np.clip(np.sum((p - a) * ab, -1) / denom, 0, 1)
            d = np.linalg.norm(p - (a + t[..., None] * ab), axis=-1).min(1)
            best[start:start + 4096] = np.minimum(best[start:start + 4096], d)
    return best


def inside(points, loops):
    """Even-odd point in polygon test over all loops."""
    result = np.zeros(len(points), dtype=bool)
    x, y = points[:, 0:1], points[:, 1:2]
    for loop in loops:
        x1, y1 = loop[:, 0], loop[:, 1]
        x2, y2 = np.roll(x1, -1), np.roll(y1, -1)
        cond = (y1 > y) != (y2 > y)
        xi = x1 + (y - y1) * (x2 - x1) / np.where(y2 - y1 == 0, 1e-18, y2 - y1)
        result ^= (np.sum(cond & (x < xi), 1) % 2).astype(bool)
    return result


def lip_depth(distance, radius):
    """Quarter-round edge profile: 0 in the panel interior, radius at the edge."""
    if radius <= 0:
        return np.zeros_like(distance)
    d = np.clip(distance, 0, radius)
    return radius - np.sqrt(np.maximum(0, radius * radius - (radius - d) ** 2))


class Panel:
    def __init__(self, surface, chart, outer, holes=(), offset=0.0, lip=0.012, hole_lip=None,
                 gap=0.0, metric=0.82, spacing=0.03):
        self.surface, self.chart = surface, chart
        self.offset, self.lip = offset, lip
        self.hole_lip = lip if hole_lip is None else hole_lip
        self.metric = metric  # world units per chart radian (approximate)
        self.spacing = spacing / metric
        g = gap / 2 / metric
        self.outer = offset_loop(oriented(outer, True), g)
        self.holes = [offset_loop(oriented(h, False), g) for h in holes]

    def depths(self, uv):
        depth = lip_depth(distance_to_loops(uv, [self.outer]) * self.metric, self.lip)
        if self.holes:
            depth = np.maximum(depth, lip_depth(distance_to_loops(uv, self.holes) * self.metric,
                                                self.hole_lip))
        return depth

    def position(self, uv):
        d = self.chart.direction(uv)
        base = self.surface.point(d)
        eps = 1e-4
        pu = self.surface.point(self.chart.direction(uv + [eps, 0])) - self.surface.point(self.chart.direction(uv - [eps, 0]))
        pv = self.surface.point(self.chart.direction(uv + [0, eps])) - self.surface.point(self.chart.direction(uv - [0, eps]))
        n = normalize(np.cross(pu, pv))
        return base + n * (self.offset - self.depths(uv))[:, None]

    def triangulate(self):
        edge_step = self.spacing * 0.3
        max_lip = max(self.lip, self.hole_lip, 1e-4) / self.metric
        loops = [resample(self.outer, edge_step)] + [resample(h, edge_step) for h in self.holes]
        points = [np.vstack(loops)]
        faces, start = [], 0
        for loop in loops:
            faces.append(list(range(start, start + len(loop))))
            start += len(loop)
        all_loops = [self.outer] + self.holes
        for k in LIP_RINGS[1:]:
            for loop, base_lip in zip(all_loops, [self.lip] + [self.hole_lip] * len(self.holes)):
                d = max(k * max(base_lip, 0.006) / self.metric, edge_step * 0.15)
                ring = resample(offset_loop(loop, d), edge_step * (1 + k))
                true = distance_to_loops(ring, all_loops)
                keep = (np.abs(true - d) < 0.35 * d) & inside(ring, all_loops)
                points.append(ring[keep])
        lo = np.minimum.reduce([l.min(0) for l in loops])
        hi = np.maximum.reduce([l.max(0) for l in loops])
        s = self.spacing
        gx, gy = np.meshgrid(np.arange(lo[0], hi[0], s), np.arange(lo[1], hi[1], s * 0.866))
        gx = gx + (np.arange(gx.shape[0])[:, None] % 2) * s * 0.5
        grid = np.stack([gx.ravel(), gy.ravel()], -1)
        grid = grid[inside(grid, all_loops)]
        clearance = 1.25 * max_lip + 0.5 * s
        grid = grid[distance_to_loops(grid, all_loops) > clearance]
        points.append(grid)
        uv = np.vstack(points)
        out = delaunay_2d_cdt([tuple(p) for p in uv], [], faces, 3, 1e-7)
        return np.array([tuple(v) for v in out[0]]), [tuple(f) for f in out[2]]

    def build(self, name, material, parent=None):
        uv, faces = self.triangulate()
        positions = self.position(uv)
        eps = 2e-5
        pu = self.position(uv + [eps, 0]) - self.position(uv - [eps, 0])
        pv = self.position(uv + [0, eps]) - self.position(uv - [0, eps])
        normals = normalize(np.cross(pu, pv))
        return create_object(name, positions, faces, material, parent, normals=normals)
