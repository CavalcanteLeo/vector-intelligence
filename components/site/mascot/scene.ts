import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createNeuralBrain } from "./brain/neural-brain";
import { createExpressions } from "./expressions";
import { loadLogoTexture } from "./materials/logo-material";
import { setupModel } from "./model-setup";
import { createStatusLights } from "./status-lights";
import { createPointer } from "./pointer";
import { createRig } from "./rig";
import { createStage } from "./stage";

const MODEL_URL = "/assets/models/vector-intelligence-mascot-v2.glb";
const WARM_UP_STEPS = 90;
const raycaster = new THREE.Raycaster();
// only solid meshes count as the robot: skip the neural points and wires
raycaster.params.Points.threshold = 0;
raycaster.params.Line.threshold = 0;
const pokePoint = new THREE.Vector2();

/** Mounts the interactive mascot into `container`; resolves to a cleanup function. */
export async function startMascotScene(container: HTMLElement, onReady: () => void) {
  const stage = createStage(container);
  const [gltf, logo] = await Promise.all([new GLTFLoader().loadAsync(MODEL_URL), loadLogoTexture()]);
  const root = gltf.scene;
  const model = setupModel(root, logo);
  stage.scene.add(root);
  const brain = createNeuralBrain(model.hemispheres, model.glass.signals);
  const canvas = stage.renderer.domElement;
  const pointer = createPointer(canvas, wake);
  const rig = createRig(root, model, pointer);
  const expressions = createExpressions(model);
  const statusLights = createStatusLights();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const timer = new THREE.Timer();
  let running = false;
  let frame = 0;
  let visible = false;
  let elapsed = 0;
  let pokes = 0;

  /** A click counts as a poke only when it lands on the robot itself. */
  function checkPoke() {
    const { poke } = pointer.state;
    if (poke.count === pokes) return;
    pokes = poke.count;
    const rect = canvas.getBoundingClientRect();
    pokePoint.set(((poke.x - rect.left) / rect.width) * 2 - 1, 1 - ((poke.y - rect.top) / rect.height) * 2);
    raycaster.setFromCamera(pokePoint, stage.camera);
    if (raycaster.intersectObject(root, true).some(({ object }) => object instanceof THREE.Mesh)) expressions.poke();
  }

  function pixelScale() {
    const height = canvas.height;
    return height / (2 * Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2)));
  }

  function renderFrame(delta: number) {
    const motion = !reducedMotion.matches;
    elapsed += delta;
    checkPoke();
    const expression = expressions.update(delta, { ...pointer.state, spin: rig.spin.velocity }, motion);
    const { happy, curious } = expression;
    rig.update(delta, stage.camera, canvas, expression, motion);
    const status = statusLights.update(delta, pointer.state.away, motion);
    const level = 0.9 + (motion ? 0.08 * Math.sin(elapsed * 1.3) : 0) + happy * 0.25 + expression.surprise * 0.6;
    model.light.setLevel(level * status.power, status.alert);
    root.updateMatrixWorld();
    brain.update(motion ? delta * status.brainSpeed : 0, stage.camera, pixelScale(), 1 + happy * 0.35 + curious * 0.5);
    stage.render();
  }

  function shouldContinue() {
    if (!visible || document.hidden) return false;
    return !reducedMotion.matches || !rig.isSettled() || !expressions.isIdle() || !statusLights.isSettled() || pointer.state.dragging;
  }

  function tick() {
    frame = 0;
    timer.update();
    renderFrame(Math.min(timer.getDelta(), 1 / 20));
    if (shouldContinue()) frame = requestAnimationFrame(tick);
    else running = false;
  }

  function wake() {
    if (frame || !visible || document.hidden) return;
    if (!running) timer.reset();
    running = true;
    frame = requestAnimationFrame(tick);
  }

  function resize() {
    stage.resize();
    renderFrame(0);
  }

  for (let i = 0; i < WARM_UP_STEPS; i++) brain.update(1 / 60, stage.camera, pixelScale());
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake();
  });
  visibility.observe(container);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  document.addEventListener("visibilitychange", wake);
  reducedMotion.addEventListener("change", wake);
  resize();
  onReady();

  return () => {
    visible = false;
    cancelAnimationFrame(frame);
    timer.dispose();
    visibility.disconnect();
    resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", wake);
    reducedMotion.removeEventListener("change", wake);
    pointer.dispose();
    brain.dispose();
    model.dispose();
    stage.dispose();
  };
}
