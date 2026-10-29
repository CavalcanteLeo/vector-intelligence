import * as THREE from "three";
import type { NeuralGraph } from "./neural-graph";
import { TRAIL_POINTS, type NeuralActivity } from "./neural-activity";
import { lineFragment, lineVertex, pointFragment, pointVertex } from "./neural-shaders";
import type { NeuralTree } from "./neural-tree";
import { createTreeLayer } from "./tree-layer";
import type { TreePulses } from "./tree-pulses";

type Hull = { centers: THREE.Vector3[]; radii: THREE.Vector3[] };

function sharedUniforms(hull: Hull) {
  return {
    uCameraLocal: { value: new THREE.Vector3() },
    uHullCenter: { value: hull.centers },
    uHullRadii: { value: hull.radii },
    uIntensity: { value: 1 },
  };
}

function additive(uniforms: Record<string, THREE.IUniform>, vertexShader: string, fragmentShader: string) {
  return new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
}

/** Wires, neurons, comet-trailed signals and the axon tree, rendered as additive light. */
export function createNeuralLayers(graph: NeuralGraph, activity: NeuralActivity, hull: Hull,
  tree: NeuralTree, pulses: TreePulses) {
  const uniforms = sharedUniforms(hull);
  const segments = graph.edges.reduce((sum, edge) => sum + edge.points.length - 1, 0);
  const positions = new Float32Array(segments * 6);
  const owner = new Uint32Array(segments * 2);
  let vertex = 0;
  graph.edges.forEach((edge, index) => {
    for (let i = 0; i < edge.points.length - 1; i++) {
      for (const k of [i, i + 1]) {
        edge.points[k].toArray(positions, vertex * 3);
        owner[vertex++] = index;
      }
    }
  });
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const lineActivation = new THREE.BufferAttribute(new Float32Array(vertex), 1).setUsage(THREE.DynamicDrawUsage);
  lineGeometry.setAttribute("aActivation", lineActivation);
  const wires = new THREE.LineSegments(lineGeometry, additive({ ...uniforms }, lineVertex, lineFragment));

  const pointUniforms = (size: number, color: THREE.Color, base: number) => ({
    ...uniforms,
    uSize: { value: size },
    uScale: { value: 1 },
    uColor: { value: color },
    uBase: { value: base },
  });
  const nodeGeometry = new THREE.BufferGeometry().setFromPoints(graph.nodes);
  const nodeActivation = new THREE.BufferAttribute(new Float32Array(graph.nodes.length), 1).setUsage(THREE.DynamicDrawUsage);
  nodeGeometry.setAttribute("aActivation", nodeActivation);
  const nodes = new THREE.Points(nodeGeometry, additive(pointUniforms(0.014, new THREE.Color(0.3, 0.9, 1.9), 0.06), pointVertex, pointFragment));

  // comet: bright head fading into a tapering tail
  const signalGeometry = new THREE.BufferGeometry().setFromPoints(activity.trail);
  const fade = activity.trail.map((_, i) => 0.75 * Math.pow(1 - (i % TRAIL_POINTS) / TRAIL_POINTS, 1.8));
  signalGeometry.setAttribute("aActivation", new THREE.Float32BufferAttribute(fade, 1));
  const signals = new THREE.Points(signalGeometry, additive(pointUniforms(0.022, new THREE.Color(0.45, 1.1, 2.2), 0.02), pointVertex, pointFragment));
  signals.frustumCulled = false;

  const treeLayer = createTreeLayer(tree, pulses, uniforms);
  const group = new THREE.Group();
  group.name = "NeuralNetwork";
  const layers = [wires, nodes, signals, ...treeLayer.objects];
  group.add(...layers);
  layers.forEach((layer, index) => (layer.renderOrder = 2 + index));

  return {
    group,
    sync(cameraLocal: THREE.Vector3, pixelScale: number, intensity: number) {
      for (let i = 0; i < owner.length; i++) lineActivation.array[i] = activity.edgeActivation[owner[i]];
      lineActivation.needsUpdate = true;
      treeLayer.sync();
      (nodeActivation.array as Float32Array).set(activity.nodeActivation);
      nodeActivation.needsUpdate = true;
      const signalPosition = signalGeometry.getAttribute("position") as THREE.BufferAttribute;
      activity.trail.forEach((point, index) => signalPosition.setXYZ(index, point.x, point.y, point.z));
      signalPosition.needsUpdate = true;
      for (const layer of layers) {
        const material = layer.material as THREE.ShaderMaterial;
        material.uniforms.uCameraLocal.value.copy(cameraLocal);
        material.uniforms.uIntensity.value = intensity;
        if (material.uniforms.uScale) material.uniforms.uScale.value = pixelScale;
      }
    },
    dispose() {
      for (const layer of layers) {
        layer.geometry.dispose();
        (layer.material as THREE.Material).dispose();
      }
    },
  };
}
