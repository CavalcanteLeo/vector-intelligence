import * as THREE from "three";
import { seededRandom, type Hemisphere } from "./neural-graph";

export type Branch = {
  points: THREE.Vector3[];
  /** Distance from the root at each point. */
  distances: number[];
  parent: number;
  /** Number of tips fed by this branch (drives its thickness). */
  tips: number;
  /** Index into `tips` when the branch ends in a terminal bulb, else -1. */
  tip: number;
};

export type NeuralTree = { branches: Branch[]; tips: THREE.Vector3[]; paths: number[][] };

type SurfacePoint = { position: THREE.Vector3; normal: THREE.Vector3; side: number };

const TIPS_PER_SIDE = 5;
const LIFT = 0.012;
const SAMPLES = 18;

function surfacePoints(hemispheres: Hemisphere[]) {
  const points: SurfacePoint[] = [];
  hemispheres.forEach(({ geometry, matrix }, side) => {
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const color = geometry.getAttribute("color");
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    for (let i = 0; i < position.count; i += 3) {
      if (color.getY(i) > 0.2) continue; // stay off the machined seams
      points.push({
        position: new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(matrix),
        normal: new THREE.Vector3().fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize(),
        side,
      });
    }
  });
  return points;
}

function nearest(surface: SurfacePoint[], point: THREE.Vector3) {
  let best = surface[0];
  let bestDistance = Infinity;
  for (const candidate of surface) {
    const distance = candidate.position.distanceToSquared(point);
    if (distance < bestDistance) { bestDistance = distance; best = candidate; }
  }
  return best;
}

/** Terminal bulbs spread over the front of each hemisphere (farthest-point sampling). */
function pickTips(surface: SurfacePoint[], box: THREE.Box3, random: () => number) {
  const height = box.max.y - box.min.y;
  const tips: SurfacePoint[] = [];
  for (let side = 0; side < 2; side++) {
    const candidates = surface.filter(({ position, normal, side: s }) =>
      s === side && normal.z > 0.45 && Math.abs(position.x) > 0.07 && position.y > box.min.y + height * 0.3);
    const chosen = [candidates[Math.floor(random() * candidates.length)]];
    while (chosen.length < TIPS_PER_SIDE) {
      let best = candidates[0];
      let bestDistance = -1;
      for (const candidate of candidates) {
        const distance = Math.min(...chosen.map((tip) => tip.position.distanceToSquared(candidate.position)));
        if (distance > bestDistance) { bestDistance = distance; best = candidate; }
      }
      chosen.push(best);
    }
    tips.push(...chosen);
  }
  return tips;
}

/** Split a tip set in two: by hemisphere first, then by the farthest pair. */
function split(indices: number[], tips: SurfacePoint[]) {
  const sides = [indices.filter((i) => tips[i].side === 0), indices.filter((i) => tips[i].side === 1)];
  if (sides[0].length && sides[1].length) return sides;
  let pair = [indices[0], indices[1]];
  let far = -1;
  for (const a of indices) for (const b of indices) {
    const distance = tips[a].position.distanceToSquared(tips[b].position);
    if (distance > far) { far = distance; pair = [a, b]; }
  }
  const [a, b] = pair.map((i) => tips[i].position);
  return [
    indices.filter((i) => tips[i].position.distanceToSquared(a) <= tips[i].position.distanceToSquared(b)),
    indices.filter((i) => tips[i].position.distanceToSquared(a) > tips[i].position.distanceToSquared(b)),
  ];
}

function centroid(indices: number[], tips: SurfacePoint[]) {
  return indices.reduce((sum, i) => sum.add(tips[i].position), new THREE.Vector3()).divideScalar(indices.length);
}

/**
 * Luminous axon tree (as in the reference art): a trunk rises in the gap
 * between the hemispheres and forks recursively towards terminal bulbs on
 * the front of the cortex. Branches hug the cortex surface.
 */
export function createNeuralTree(hemispheres: Hemisphere[], seed = 5): NeuralTree {
  const random = seededRandom(seed);
  const surface = surfacePoints(hemispheres);
  const box = new THREE.Box3().setFromPoints(surface.map(({ position }) => position));
  const tipPoints = pickTips(surface, box, random);
  const tree: NeuralTree = {
    branches: [],
    tips: tipPoints.map(({ position, normal }) => position.clone().addScaledVector(normal, LIFT)),
    paths: [],
  };
  const height = box.max.y - box.min.y;
  const root = new THREE.Vector3(0, box.min.y + height * 0.08, box.max.z - 0.16);
  const fork = new THREE.Vector3(0, box.min.y + height * 0.3, box.max.z - 0.08);

  const wrap = (point: THREE.Vector3, weight: number) => {
    if (weight <= 0) return point;
    const { position, normal } = nearest(surface, point);
    return point.lerp(position.clone().addScaledVector(normal, LIFT), weight);
  };

  const addBranch = (start: THREE.Vector3, startDir: THREE.Vector3, end: THREE.Vector3, endDir: THREE.Vector3,
    parent: number, indices: number[], tip: number, wrapFrom: number) => {
    const length = start.distanceTo(end);
    const curve = new THREE.CubicBezierCurve3(start, start.clone().addScaledVector(startDir, length * 0.4),
      end.clone().addScaledVector(endDir, -length * 0.3), end);
    const points = curve.getPoints(SAMPLES).map((point, i) =>
      wrap(point, wrapFrom < 0 ? 0 : THREE.MathUtils.smoothstep(i / SAMPLES, wrapFrom, wrapFrom + 0.35)));
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < points.length - 1; i++) points[i].lerp(points[i - 1].clone().add(points[i + 1]).multiplyScalar(0.5), 0.5);
    }
    const offset = parent < 0 ? 0 : tree.branches[parent].distances.at(-1)!;
    const distances = [offset];
    for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + points[i].distanceTo(points[i - 1]));
    tree.branches.push({ points, distances, parent, tips: indices.length, tip });
    return tree.branches.length - 1;
  };

  const grow = (start: THREE.Vector3, direction: THREE.Vector3, parent: number, indices: number[], depth: number) => {
    if (indices.length === 1) {
      const [tip] = indices;
      const end = tree.tips[tip];
      addBranch(start, direction, end, tipPoints[tip].normal.clone().negate().add(direction).normalize(),
        parent, indices, tip, depth === 1 ? 0.15 : 0);
      return;
    }
    for (const group of split(indices, tipPoints)) {
      const target = centroid(group, tipPoints);
      const junction = wrap(start.clone().lerp(target, 0.45), 1);
      const toward = junction.clone().sub(start).normalize();
      const branch = addBranch(start, direction, junction, toward, parent, group, -1, depth === 1 ? 0.2 : 0);
      grow(junction, toward, branch, group, depth + 1);
    }
  };

  const up = new THREE.Vector3(0, 1, 0.25).normalize();
  const trunk = addBranch(root, up, fork, up, -1, tipPoints.map((_, i) => i), -1, -1);
  grow(fork, up, trunk, tipPoints.map((_, i) => i), 1);

  tree.paths = tree.tips.map((_, tip) => {
    const path: number[] = [];
    let branch = tree.branches.findIndex((b) => b.tip === tip);
    while (branch >= 0) { path.unshift(branch); branch = tree.branches[branch].parent; }
    return path;
  });
  return tree;
}
