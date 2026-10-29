import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { createStudioEnvironment } from "./studio-environment";

/** Framing of the reference image in model units (y up). */
const FRAME = { centerY: 0.62, height: 2.62, width: 2.5 };
const FOV = 28;

export type Stage = ReturnType<typeof createStage>;

/** Background colour of the nearest ancestor that paints one, so the canvas blends in. */
function pageBackground(element: HTMLElement | null) {
  for (; element; element = element.parentElement) {
    const color = getComputedStyle(element).backgroundColor;
    if (color && color !== "transparent" && !color.startsWith("rgba(0, 0, 0, 0")) return color;
  }
  return "#ffffff";
}

export function createStage(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // The page background must match exactly, so no tone mapping:
  // materials stay within range and only emissive light exceeds 1 (bloom).
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.domElement.className = "absolute inset-0 size-full touch-pan-y cursor-grab active:cursor-grabbing";
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const background = new THREE.Color(pageBackground(container));
  scene.background = background;
  const environment = createStudioEnvironment(renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.85;

  const key = new THREE.DirectionalLight(0xffffff, 0.95);
  key.position.set(-2.5, 3.5, 4);
  const fill = new THREE.DirectionalLight(0xdfe9ff, 0.3);
  fill.position.set(3, 1, 3);
  const rim = new THREE.DirectionalLight(0x7fb2ff, 0.7);
  rim.position.set(1.5, 2.5, -4);
  scene.add(key, fill, rim, new THREE.HemisphereLight(0xffffff, 0xb8c3d6, 0.2));

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.25, 1.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    background.setStyle(pageBackground(container));
    const aspect = width / height;
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const distance = Math.max(FRAME.height / 2 / tan, FRAME.width / 2 / (tan * aspect));
    camera.aspect = aspect;
    // keep the bottom of the frame anchored like the original "object-bottom" image
    const visibleHalf = distance * tan;
    camera.position.set(0, FRAME.centerY - FRAME.height / 2 + visibleHalf + 0.12, distance);
    camera.lookAt(0, camera.position.y - 0.12, 0);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    bloom.resolution.set(width / 2, height / 2);
  }

  return {
    renderer,
    scene,
    camera,
    resize,
    render: () => composer.render(),
    dispose() {
      composer.passes.forEach((pass) => pass.dispose());
      composer.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
