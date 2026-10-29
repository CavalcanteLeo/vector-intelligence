import * as THREE from "three";
import { pointOnEdge, seededRandom, type NeuralGraph } from "./neural-graph";

type Step = { edge: number; forward: boolean };
type Signal = Step & { travelled: number; speed: number; history: Step[] };

const SIGNAL_COUNT = 140;
const EDGE_DECAY = 1.4;
const NODE_DECAY = 3.2;
/** Points per comet trail (head first) and their spacing along the path. */
export const TRAIL_POINTS = 10;
const TRAIL_SPACING = 0.009;
const HISTORY = 4;

/**
 * Signals travelling through the network. Each one moves along an edge at
 * its own speed and, on reaching a neuron, continues into a connected edge
 * (preferring the straightest continuation). Every signal drags a comet
 * trail sampled backwards along the path it actually took, so the light
 * flows through neurons without restarting on each connection.
 */
export function createNeuralActivity(graph: NeuralGraph, seed = 11) {
  const random = seededRandom(seed);
  const edgeLength = graph.edges.map((edge) => edge.lengths[edge.lengths.length - 1]);
  const signals: Signal[] = Array.from({ length: SIGNAL_COUNT }, () => {
    const edge = Math.floor(random() * graph.edges.length);
    return { edge, forward: random() > 0.5, travelled: random() * edgeLength[edge], speed: 0.16 + random() * 0.2, history: [] };
  });
  /** Per edge: glow left behind by recent signals. */
  const edgeActivation = new Float32Array(graph.edges.length);
  const nodeActivation = new Float32Array(graph.nodes.length);
  /** Signal heads, then their trails: trail[k] of signal i at i * TRAIL_POINTS + k. */
  const positions = signals.map(() => new THREE.Vector3());
  const trail = Array.from({ length: SIGNAL_COUNT * TRAIL_POINTS }, () => new THREE.Vector3());
  const tangentA = new THREE.Vector3();
  const tangentB = new THREE.Vector3();
  let injectCursor = 0;

  const along = ({ edge, forward }: Step, distance: number, target: THREE.Vector3) =>
    pointOnEdge(graph.edges[edge], forward ? distance : edgeLength[edge] - distance, target);

  function direction(edgeIndex: number, fromNode: number, target: THREE.Vector3) {
    const { points, a } = graph.edges[edgeIndex];
    return fromNode === a ? target.subVectors(points[1], points[0]).normalize()
      : target.subVectors(points[points.length - 2], points[points.length - 1]).normalize();
  }

  function nextEdge(signal: Signal, node: number) {
    const options = graph.adjacency[node].filter((id) => id !== signal.edge);
    if (!options.length) return signal.edge;
    direction(signal.edge, node, tangentA).negate();
    let best = options[0];
    let bestScore = -Infinity;
    for (const option of options) {
      const score = direction(option, node, tangentB).dot(tangentA) * 1.5 + random() * 1.2;
      if (score > bestScore) { bestScore = score; best = option; }
    }
    return best;
  }

  /** Point `distance` behind the head of a signal, following its history. */
  function behind(signal: Signal, distance: number, target: THREE.Vector3) {
    if (distance <= signal.travelled) return along(signal, signal.travelled - distance, target);
    let remaining = distance - signal.travelled;
    for (const step of signal.history) {
      const length = edgeLength[step.edge];
      if (remaining <= length) return along(step, length - remaining, target);
      remaining -= length;
    }
    const oldest = signal.history[signal.history.length - 1] ?? signal;
    return along(oldest, 0, target);
  }

  function step(delta: number) {
    const decay = Math.exp(-delta * EDGE_DECAY);
    const nodeDecay = Math.exp(-delta * NODE_DECAY);
    for (let i = 0; i < edgeActivation.length; i++) edgeActivation[i] *= decay;
    for (let i = 0; i < nodeActivation.length; i++) nodeActivation[i] *= nodeDecay;
    signals.forEach((signal, index) => {
      signal.travelled += signal.speed * delta;
      while (signal.travelled >= edgeLength[signal.edge]) {
        signal.travelled -= edgeLength[signal.edge];
        const edge = graph.edges[signal.edge];
        const node = signal.forward ? edge.b : edge.a;
        nodeActivation[node] = 1;
        signal.history.unshift({ edge: signal.edge, forward: signal.forward });
        signal.history.length = Math.min(signal.history.length, HISTORY);
        signal.edge = nextEdge(signal, node);
        signal.forward = graph.edges[signal.edge].a === node;
      }
      edgeActivation[signal.edge] = Math.max(edgeActivation[signal.edge], 1);
      along(signal, signal.travelled, positions[index]);
      for (let k = 0; k < TRAIL_POINTS; k++) behind(signal, k * TRAIL_SPACING, trail[index * TRAIL_POINTS + k]);
    });
  }

  /** Launch a signal out of `node` (recycles signals round-robin). */
  function inject(node: number) {
    const options = graph.adjacency[node];
    if (!options.length) return;
    const signal = signals[injectCursor];
    injectCursor = (injectCursor + 1) % SIGNAL_COUNT;
    signal.edge = options[Math.floor(random() * options.length)];
    signal.forward = graph.edges[signal.edge].a === node;
    signal.travelled = 0;
    signal.history = [];
    signal.speed = 0.3 + random() * 0.12;
    nodeActivation[node] = 1;
  }

  return { step, inject, positions, trail, edgeActivation, nodeActivation, count: SIGNAL_COUNT };
}

export type NeuralActivity = ReturnType<typeof createNeuralActivity>;
