import * as THREE from "three";
import { aimGlints, createEyeMaterial } from "./materials/eye-material";
import { createGlassInteriorMaterial, createGlassMaterial } from "./materials/glass-material";
import { createLogoMaterial } from "./materials/logo-material";
import { createLightMaterial, createSurfaceMaterials } from "./materials/surface-materials";

export type Lid = { mesh: THREE.Object3D; rest: THREE.Quaternion; blinkAngle: number; smileAngle: number };
export type Eye = { uniforms: ReturnType<typeof createEyeMaterial>["uniforms"]; side: number };

const HALO_FADE = 0.07;
const point = new THREE.Vector3();

/**
 * Per-vertex halo strength: 1 along the strip, easing to 0 towards the two
 * ends of an open strip, so the glow dissolves instead of being cut off.
 * The ends are the farthest-apart vertices (the compressed export does not
 * keep vertex order).
 */
function addHaloFade(geometry: THREE.BufferGeometry, open: boolean) {
  const position = geometry.getAttribute("position");
  const fade = new Float32Array(position.count).fill(1);
  if (open) {
    const farthest = (from: THREE.Vector3) => {
      const best = new THREE.Vector3();
      let far = -1;
      for (let i = 0; i < position.count; i++) {
        const d = point.fromBufferAttribute(position, i).distanceToSquared(from);
        if (d > far) { far = d; best.copy(point); }
      }
      return best;
    };
    const a = farthest(new THREE.Vector3().fromBufferAttribute(position, 0));
    const b = farthest(a);
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i);
      fade[i] = THREE.MathUtils.smoothstep(Math.min(point.distanceTo(a), point.distanceTo(b)), 0, HALO_FADE);
    }
  }
  geometry.setAttribute("aFade", new THREE.BufferAttribute(fade, 1));
}

/** Replace the Blender preview materials by name and collect the animated parts. */
export function setupModel(model: THREE.Object3D, logos: { chest: THREE.Texture; mark: THREE.Texture }) {
  const surfaces = createSurfaceMaterials();
  const light = createLightMaterial();
  const glass = createGlassMaterial();
  const glassInterior = createGlassInteriorMaterial();
  const logoMaterial = createLogoMaterial(logos.chest);
  const markMaterial = createLogoMaterial(logos.mark);
  const eyes: Eye[] = [];
  const lids: Lid[] = [];
  const hemispheres: THREE.Mesh[] = [];
  const owned: THREE.Material[] = [...Object.values(surfaces), light.material, light.halo, glass.material, glassInterior, logoMaterial, markMaterial];
  let mouth: THREE.Mesh | undefined;

  model.updateMatrixWorld(true);
  // collect first: halos and the glass interior are added as children below
  const meshes: THREE.Mesh[] = [];
  model.traverse((object) => void (object instanceof THREE.Mesh && meshes.push(object)));
  for (const object of meshes) {
    const authored = object.material as THREE.Material;
    const name = authored.name;
    if (name === "Brain") { hemispheres.push(object); continue; }
    authored.dispose();
    if (name in surfaces) object.material = surfaces[name as keyof typeof surfaces];
    else if (name === "EyeLid") object.material = surfaces.Ceramic;
    else if (name === "Light") {
      object.material = light.material;
      addHaloFade(object.geometry, object.name.startsWith("EarLight")); // the other lights are closed rings
      const halo = new THREE.Mesh(object.geometry, light.halo);
      halo.renderOrder = 5;
      object.add(halo);
    }
    else if (name === "Logo") object.material = logoMaterial;
    else if (name === "LogoMark") object.material = markMaterial;
    else if (name === "Glass") {
      object.material = glass.material;
      object.renderOrder = 10;
      const interior = new THREE.Mesh(object.geometry, glassInterior);
      interior.renderOrder = 0.5;
      object.add(interior);
    } else if (name === "EyeLens") {
      const side = object.name.endsWith("Left") ? 1 : -1;
      const options = { ...(object.userData as { irisCenter: [number, number]; irisRadius: number }), side };
      const eye = createEyeMaterial(options);
      aimGlints(object, options, eye.uniforms.uGlints.value);
      object.material = eye.material;
      owned.push(eye.material);
      eyes.push({ uniforms: eye.uniforms, side });
    }
    if (object.name.startsWith("EyeLid")) {
      const { blinkAngle, smileAngle } = object.userData as { blinkAngle: number; smileAngle: number };
      lids.push({ mesh: object, rest: object.quaternion.clone(), blinkAngle, smileAngle });
    }
    if (object.name === "Mouth") mouth = object;
  }

  return {
    head: model.getObjectByName("HeadRig")!,
    body: model.getObjectByName("BodyRig")!,
    eyes, lids, mouth, hemispheres, glass, light,
    dispose() {
      owned.forEach((material) => material.dispose());
      logos.chest.dispose();
      logos.mark.dispose();
      model.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
    },
  };
}

export type MascotModel = ReturnType<typeof setupModel>;
