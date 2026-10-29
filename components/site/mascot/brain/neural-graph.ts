import * as THREE from "three";

export type Edge = {
  a: number;
  b: number;
  /** Polyline from node a to node b. */
  points: THREE.Vector3[];
  /** Cumulative arc length per point (last = edge length). */
  lengths: number[];
};

export type NeuralGraph = {
  nodes: THREE.Vector3[];
  normals: THREE.Vector3[];
  edges: Edge[];
  adjacency: number[][];
};

export type Hemisphere = { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 };

const SURFACE_SPACING = 0.048;
const VOLUME_SPACING = 0.075;
const NEIGHBOURS = 4;
const MAX_EDGE = 0.14;
const SAMPLES_PER_EDGE = 8;

export function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function farEnough(point: THREE.Vector3, accepted: THREE.Vector3[], spacing: number) {
  const limit = spacing * spacing;
  return accepted.every((other) => other.distanceToSquared(point) > limit);
}

/** Pick neurons on gyri crests and inside the volume of one hemisphere. */
function sampleHemisphere({ geometry, matrix }: Hemisphere, random: () => number, graph: NeuralGraph) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const crest = geometry.getAttribute("color");
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  const centre = new THREE.Vector3();
  geometry.computeBoundingBox();
  geometry.boundingBox!.getCenter(centre).applyMatrix4(matrix);
  const surface: THREE.Vector3[] = [];
  const volume: THREE.Vector3[] = [];
  const order = Array.from({ length: position.count }, (_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const index of order) {
    const point = new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(matrix);
    const n = new THREE.Vector3().fromBufferAttribute(normal, index).applyMatrix3(normalMatrix).normalize();
    if (crest.getX(index) > 0.62 && farEnough(point, surface, SURFACE_SPACING)) {
      surface.push(point);
      graph.nodes.push(point.clone().addScaledVector(n, 0.006));
      graph.normals.push(n);
    }
    if (volume.length < 90 && random() < 0.02) {
      const inner = centre.clone().lerp(point, 0.25 + random() * 0.6);
      if (farEnough(inner, volume, VOLUME_SPACING)) {
        volume.push(inner);
        graph.nodes.push(inner);
        graph.normals.push(new THREE.Vector3());
      }
    }
  }
}

function makeEdge(graph: NeuralGraph, a: number, b: number, random: () => number): Edge {
  const start = graph.nodes[a];
  const end = graph.nodes[b];
  const lift = graph.normals[a].clone().add(graph.normals[b]);
  const length = start.distanceTo(end);
  const control = start.clone().lerp(end, 0.5);
  if (lift.lengthSq() > 0.5) control.addScaledVector(lift.normalize(), length * 0.18);
  else control.add(new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(length * 0.35));
  const curve = new THREE.QuadraticBezierCurve3(start, control, end);
  const points = curve.getPoints(SAMPLES_PER_EDGE);
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
  return { a, b, points, lengths };
}

/** Connect each neuron to its nearest neighbours, plus a few inter-hemisphere bridges. */
export function createNeuralGraph(hemispheres: Hemisphere[], seed = 7): NeuralGraph {
  const random = seededRandom(seed);
  const graph: NeuralGraph = { nodes: [], normals: [], edges: [], adjacency: [] };
  const side: number[] = [];
  hemispheres.forEach((hemisphere, index) => {
    const before = graph.nodes.length;
    sampleHemisphere(hemisphere, random, graph);
    for (let i = before; i < graph.nodes.length; i++) side.push(index);
  });
  graph.adjacency = graph.nodes.map(() => []);
  const linked = new Set<string>();
  const link = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (a === b || linked.has(key)) return;
    linked.add(key);
    graph.adjacency[a].push(graph.edges.length);
    graph.adjacency[b].push(graph.edges.length);
    graph.edges.push(makeEdge(graph, a, b, random));
  };
  graph.nodes.forEach((node, a) => {
    graph.nodes
      .map((other, b) => ({ b, distance: node.distanceTo(other) }))
      .filter(({ b, distance }) => b !== a && side[b] === side[a] && distance < MAX_EDGE)
      .sort((one, two) => one.distance - two.distance)
      .slice(0, NEIGHBOURS)
      .forEach(({ b }) => link(a, b));
  });
  // corpus callosum: bridge medial neurons across hemispheres
  const medial = graph.nodes.map((node, index) => ({ index, x: Math.abs(node.x) }))
    .filter(({ x }) => x < 0.12).map(({ index }) => index);
  for (const a of medial) {
    const partner = medial
      .filter((b) => side[b] !== side[a])
      .sort((one, two) => graph.nodes[a].distanceTo(graph.nodes[one]) - graph.nodes[a].distanceTo(graph.nodes[two]))[0];
    if (partner !== undefined && graph.nodes[a].distanceTo(graph.nodes[partner]) < 0.2 && random() < 0.5) link(a, partner);
  }
  return graph;
}

export function pointOnEdge(edge: Edge, distance: number, target: THREE.Vector3) {
  const { points, lengths } = edge;
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < distance) i++;
  const span = lengths[i] - lengths[i - 1] || 1;
  return target.lerpVectors(points[i - 1], points[i], THREE.MathUtils.clamp((distance - lengths[i - 1]) / span, 0, 1));
}
