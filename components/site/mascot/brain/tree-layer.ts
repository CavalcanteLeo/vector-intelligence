import * as THREE from "three";
import type { Branch, NeuralTree } from "./neural-tree";
import { HEADS_PER_BRANCH, PULSE_TRAIL, type TreePulses } from "./tree-pulses";
import { hullVisibility, pointFragment, pointVertex } from "./neural-shaders";

const SIDES = 8;
const radius = (tips: number) => 0.0034 * (1 + Math.sqrt(tips));

const tubeVertex = /* glsl */ `
${hullVisibility}
attribute float aDist;
attribute vec4 aHeads;
varying float vDist;
varying vec4 vHeads;
varying float vFacing;
varying float vVisible;
void main() {
  vDist = aDist;
  vHeads = aHeads;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
  vVisible = hullVisibility(position);
  gl_Position = projectionMatrix * mv;
}`;

const tubeFragment = /* glsl */ `
uniform float uIntensity;
varying float vDist;
varying vec4 vHeads;
varying float vFacing;
varying float vVisible;
float pulse(float head) {
  if (head < 0.0) return 0.0;
  float behind = head - vDist;
  return behind >= 0.0 ? exp(-behind / ${(PULSE_TRAIL / 3).toFixed(4)}) * step(behind, ${PULSE_TRAIL.toFixed(4)})
    : exp(-pow(behind / 0.012, 2.0));
}
void main() {
  float core = pow(vFacing, 1.6);
  float glow = pulse(vHeads.x) + pulse(vHeads.y) + pulse(vHeads.z) + pulse(vHeads.w);
  vec3 color = vec3(0.12, 0.5, 1.3) * (0.3 + 0.9 * core)
    + vec3(0.55, 1.15, 2.3) * glow * (0.35 + 0.9 * core);
  gl_FragColor = vec4(color * vVisible * uIntensity, 1.0);
}`;

/** Tapered tube around a branch polyline (parallel-transport frames). */
function appendTube(branch: Branch, startRadius: number, endRadius: number, out: {
  positions: number[]; normals: number[]; distances: number[]; indices: number[];
}) {
  const { points } = branch;
  const base = out.positions.length / 3;
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const direction = new THREE.Vector3();
  points.forEach((point, i) => {
    tangent.subVectors(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]).normalize();
    if (i === 0) normal.set(0, 0, 1).cross(tangent).normalize();
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    binormal.crossVectors(tangent, normal);
    const r = THREE.MathUtils.lerp(startRadius, endRadius, i / (points.length - 1));
    for (let s = 0; s < SIDES; s++) {
      const angle = (s / SIDES) * Math.PI * 2;
      direction.copy(normal).multiplyScalar(Math.cos(angle)).addScaledVector(binormal, Math.sin(angle));
      out.positions.push(point.x + direction.x * r, point.y + direction.y * r, point.z + direction.z * r);
      out.normals.push(direction.x, direction.y, direction.z);
      out.distances.push(branch.distances[i]);
    }
  });
  for (let i = 0; i < points.length - 1; i++) {
    for (let s = 0; s < SIDES; s++) {
      const a = base + i * SIDES + s;
      const b = base + i * SIDES + ((s + 1) % SIDES);
      out.indices.push(a, a + SIDES, b, b, a + SIDES, b + SIDES);
    }
  }
}

/** Glowing axon tree with terminal bulbs, lit by climbing pulses. */
export function createTreeLayer(tree: NeuralTree, pulses: TreePulses, uniforms: Record<string, THREE.IUniform>) {
  const out = { positions: [] as number[], normals: [] as number[], distances: [] as number[], indices: [] as number[] };
  const owner: number[] = [];
  tree.branches.forEach((branch, index) => {
    const start = radius(branch.parent < 0 ? branch.tips : tree.branches[branch.parent].tips);
    const before = out.distances.length;
    appendTube(branch, start, radius(branch.tips) * (branch.tip >= 0 ? 0.7 : 1), out);
    for (let i = before; i < out.distances.length; i++) owner.push(index);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(out.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(out.normals, 3));
  geometry.setAttribute("aDist", new THREE.Float32BufferAttribute(out.distances, 1));
  const heads = new THREE.BufferAttribute(new Float32Array(owner.length * 4).fill(-1), 4).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aHeads", heads);
  geometry.setIndex(out.indices);
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false };
  const tubes = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms: { ...uniforms }, vertexShader: tubeVertex, fragmentShader: tubeFragment, ...additive,
  }));

  const bulbGeometry = new THREE.BufferGeometry().setFromPoints(tree.tips);
  const bulbActivation = new THREE.BufferAttribute(new Float32Array(tree.tips.length), 1).setUsage(THREE.DynamicDrawUsage);
  bulbGeometry.setAttribute("aActivation", bulbActivation);
  const bulbs = new THREE.Points(bulbGeometry, new THREE.ShaderMaterial({
    uniforms: {
      ...uniforms,
      uSize: { value: 0.075 }, uScale: { value: 1 }, uColor: { value: new THREE.Color(0.7, 1.3, 2.4) }, uBase: { value: 0.75 },
    },
    vertexShader: pointVertex, fragmentShader: pointFragment, ...additive,
  }));

  return {
    objects: [tubes, bulbs],
    sync() {
      const array = heads.array as Float32Array;
      for (let v = 0; v < owner.length; v++) {
        for (let k = 0; k < HEADS_PER_BRANCH; k++) array[v * 4 + k] = pulses.heads[owner[v] * HEADS_PER_BRANCH + k];
      }
      heads.needsUpdate = true;
      (bulbActivation.array as Float32Array).set(pulses.tipActivation);
      bulbActivation.needsUpdate = true;
    },
  };
}
