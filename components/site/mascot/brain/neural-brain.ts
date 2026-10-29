import * as THREE from "three";
import { createBrainMaterial } from "./brain-material";
import { createNeuralActivity } from "./neural-activity";
import { createNeuralGraph } from "./neural-graph";
import { createNeuralLayers } from "./neural-layers";
import { createNeuralTree } from "./neural-tree";
import { createTreePulses } from "./tree-pulses";

const HULL_SCALE = 0.86;
/** Glass/cortex light slots reserved for pulses climbing the axon tree. */
const TREE_LIGHTS = 4;
const cameraLocal = new THREE.Vector3();
const worldPoint = new THREE.Vector3();

/** Brain hemispheres from the model + the animated neural network inside them. */
export function createNeuralBrain(hemispheres: THREE.Mesh[], signals: THREE.Vector4[]) {
  const parent = hemispheres[0].parent!;
  const material = createBrainMaterial(signals);
  const hull = { centers: [] as THREE.Vector3[], radii: [] as THREE.Vector3[] };
  for (const mesh of hemispheres) {
    (mesh.material as THREE.Material).dispose();
    mesh.material = material;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrix);
    hull.centers.push(box.getCenter(new THREE.Vector3()));
    hull.radii.push(box.getSize(new THREE.Vector3()).multiplyScalar(HULL_SCALE / 2));
  }
  const sources = hemispheres.map((mesh) => ({ geometry: mesh.geometry, matrix: mesh.matrix }));
  const graph = createNeuralGraph(sources);
  const activity = createNeuralActivity(graph);
  const tree = createNeuralTree(sources);
  // a pulse reaching a terminal bulb fires into the surrounding network
  const tipNeuron = tree.tips.map((tip) => graph.nodes.reduce((best, node, index) =>
    node.distanceToSquared(tip) < graph.nodes[best].distanceToSquared(tip) ? index : best, 0));
  const pulses = createTreePulses(tree, (tip) => activity.inject(tipNeuron[tip]));
  const layers = createNeuralLayers(graph, activity, hull, tree, pulses);
  parent.add(layers.group);

  return {
    /** Advance the simulation; dt = 0 keeps the network frozen. */
    update(delta: number, camera: THREE.Camera, pixelScale: number, intensity = 1) {
      activity.step(delta);
      pulses.step(delta, intensity);
      cameraLocal.setFromMatrixPosition(camera.matrixWorld);
      parent.worldToLocal(cameraLocal);
      layers.sync(cameraLocal, pixelScale, intensity);
      material.uniforms.uIntensity.value = 0.85 + 0.15 * intensity;
      // after the shells, far hemisphere first (the brain does not write depth)
      hemispheres
        .map((mesh, index) => ({ mesh, distance: hull.centers[index].distanceToSquared(cameraLocal) }))
        .sort((a, b) => b.distance - a.distance)
        .forEach(({ mesh }, order) => (mesh.renderOrder = 1 + order));
      // share the brightest signals with the glass and cortex shaders (world space)
      for (let i = 0; i < signals.length; i++) {
        const climbing = i < TREE_LIGHTS && pulses.headPosition(i, worldPoint);
        if (!climbing) worldPoint.copy(activity.positions[(i * 13) % activity.count]);
        parent.localToWorld(worldPoint);
        signals[i].set(worldPoint.x, worldPoint.y, worldPoint.z, (climbing ? 0.9 : 0.5) * intensity);
      }
    },
    dispose() {
      layers.dispose();
      material.dispose();
    },
  };
}
