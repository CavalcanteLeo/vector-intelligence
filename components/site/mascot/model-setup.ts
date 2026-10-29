import * as THREE from "three";
import { aimGlints, createEyeMaterial } from "./materials/eye-material";
import { createGlassInteriorMaterial, createGlassMaterial } from "./materials/glass-material";
import { createLogoMaterial } from "./materials/logo-material";
import { createLightMaterial, createSurfaceMaterials } from "./materials/surface-materials";

export type Lid = { mesh: THREE.Object3D; rest: THREE.Quaternion; blinkAngle: number; smileAngle: number };
export type Eye = { uniforms: ReturnType<typeof createEyeMaterial>["uniforms"]; side: number };

/** Replace the Blender preview materials by name and collect the animated parts. */
export function setupModel(model: THREE.Object3D, logo: THREE.Texture) {
  const surfaces = createSurfaceMaterials();
  const light = createLightMaterial();
  const glass = createGlassMaterial();
  const glassInterior = createGlassInteriorMaterial();
  const logoMaterial = createLogoMaterial(logo);
  const eyes: Eye[] = [];
  const lids: Lid[] = [];
  const hemispheres: THREE.Mesh[] = [];
  const owned: THREE.Material[] = [...Object.values(surfaces), light.material, light.halo, glass.material, glassInterior, logoMaterial];
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
      const halo = new THREE.Mesh(object.geometry, light.halo);
      halo.renderOrder = 5;
      object.add(halo);
    }
    else if (name === "Logo") object.material = logoMaterial;
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
      logo.dispose();
      model.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
    },
  };
}

export type MascotModel = ReturnType<typeof setupModel>;
