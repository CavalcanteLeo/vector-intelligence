import * as THREE from "three";
import { seededRandom } from "./neural-graph";
import type { Branch, NeuralTree } from "./neural-tree";

export const HEADS_PER_BRANCH = 4;
/** Length of the light trail behind a pulse head (model units). */
export const PULSE_TRAIL = 0.11;
const SPAWN_INTERVAL = 0.42;
const TIP_DECAY = 2.2;

type Pulse = { tip: number; head: number; speed: number; arrived: boolean };

function pointAt(branch: Branch, distance: number, target: THREE.Vector3) {
  const { points, distances } = branch;
  let i = 1;
  while (i < distances.length - 1 && distances[i] < distance) i++;
  const span = distances[i] - distances[i - 1] || 1;
  return target.lerpVectors(points[i - 1], points[i], THREE.MathUtils.clamp((distance - distances[i - 1]) / span, 0, 1));
}

/**
 * Impulses climbing the axon tree: each one leaves the root, follows the
 * path to one terminal bulb and lights it on arrival. Head distances are
 * measured from the root, so trails flow across forks without breaks.
 */
export function createTreePulses(tree: NeuralTree, onArrive: (tip: number) => void, seed = 3) {
  const random = seededRandom(seed);
  const pulses: Pulse[] = [];
  const heads = new Float32Array(tree.branches.length * HEADS_PER_BRANCH).fill(-1);
  const tipActivation = new Float32Array(tree.tips.length);
  const end = (branch: Branch) => branch.distances[branch.distances.length - 1];
  let clock = SPAWN_INTERVAL;
  let nextTip = 0;

  function spawn() {
    // walk the tips in a shuffled cycle so every branch fires regularly
    nextTip = (nextTip + 1 + Math.floor(random() * (tree.tips.length - 1))) % tree.tips.length;
    pulses.push({ tip: nextTip, head: 0, speed: 0.42 + random() * 0.16, arrived: false });
  }

  function step(delta: number, rate = 1) {
    clock -= delta * rate;
    while (clock <= 0) { spawn(); clock += SPAWN_INTERVAL * (0.6 + random() * 0.8); }
    const decay = Math.exp(-delta * TIP_DECAY);
    for (let i = 0; i < tipActivation.length; i++) tipActivation[i] *= decay;
    heads.fill(-1);
    for (let p = pulses.length - 1; p >= 0; p--) {
      const pulse = pulses[p];
      pulse.head += pulse.speed * delta;
      const path = tree.paths[pulse.tip];
      const last = end(tree.branches[path[path.length - 1]]);
      if (!pulse.arrived && pulse.head >= last) {
        pulse.arrived = true;
        tipActivation[pulse.tip] = 1;
        onArrive(pulse.tip);
      }
      if (pulse.head - PULSE_TRAIL > last) { pulses.splice(p, 1); continue; }
      for (const index of path) {
        const branch = tree.branches[index];
        if (pulse.head < branch.distances[0] || pulse.head - PULSE_TRAIL > end(branch)) continue;
        for (let slot = 0; slot < HEADS_PER_BRANCH; slot++) {
          if (heads[index * HEADS_PER_BRANCH + slot] < 0) { heads[index * HEADS_PER_BRANCH + slot] = pulse.head; break; }
        }
      }
    }
  }

  /** World-ish (tree space) position of the n-th newest travelling pulse head, if any. */
  function headPosition(n: number, target: THREE.Vector3) {
    const pulse = pulses.filter((p) => !p.arrived)[n];
    if (!pulse) return null;
    const path = tree.paths[pulse.tip];
    const branch = path.find((index) => pulse.head <= end(tree.branches[index])) ?? path[path.length - 1];
    return pointAt(tree.branches[branch], pulse.head, target);
  }

  return { step, heads, tipActivation, headPosition };
}

export type TreePulses = ReturnType<typeof createTreePulses>;
