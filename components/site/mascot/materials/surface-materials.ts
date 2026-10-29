import * as THREE from "three";
import { withMetalGrain } from "./metal-grain";

/** Opaque shell materials, keyed by the material names authored in Blender. */
export function createSurfaceMaterials() {
  return {
    // satin metallic paint: soft grain under a smooth clear coat
    Ceramic: withMetalGrain(new THREE.MeshPhysicalMaterial({
      color: 0xf0f2f5, metalness: 0.15, roughness: 0.4, clearcoat: 0.55, clearcoatRoughness: 0.2, envMapIntensity: 0.9,
    }), { bump: 0.15, roughness: 0.3, tone: 0.04, flakes: 0 }),
    // gunmetal: cast-metal grain, speckled roughness, soft tone variation
    Graphite: withMetalGrain(new THREE.MeshPhysicalMaterial({
      color: 0x2c3038, metalness: 0.85, roughness: 0.34, clearcoat: 0.25, clearcoatRoughness: 0.3,
    }), { bump: 0.3, roughness: 0.3, tone: 0.12, flakes: 0 }),
    GraphiteGloss: withMetalGrain(new THREE.MeshPhysicalMaterial({
      color: 0x1a1d24, metalness: 0.8, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08,
    }), { bump: 0.18, roughness: 0.25, tone: 0.08, flakes: 0 }),
    // satin titanium (ear rims): bright metal with speckled roughness
    Titanium: withMetalGrain(new THREE.MeshPhysicalMaterial({
      color: 0xaab2bd, metalness: 1, roughness: 0.32, envMapIntensity: 1.2,
    }), { bump: 0.15, roughness: 0.45, tone: 0.1, flakes: 0 }),
    // inner chamber (core + floor): double-sided so the cavity is closed from inside
    Cavity: new THREE.MeshStandardMaterial({
      color: 0x04060c, roughness: 0.7, metalness: 0, emissive: 0x1238c8, emissiveIntensity: 0.3,
      envMapIntensity: 0.08, side: THREE.DoubleSide,
    }),
    Mouth: new THREE.MeshPhysicalMaterial({
      color: 0x0d1118, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.1,
    }),
  };
}

export type SurfaceMaterials = ReturnType<typeof createSurfaceMaterials>;

const LIGHT_COLOR = new THREE.Color(0.2, 0.58, 2.6);
const ALERT_COLOR = new THREE.Color(2.6, 0.16, 0.12);
const HALO_COLOR = new THREE.Color(0.22, 0.56, 1.0);
const ALERT_HALO_COLOR = new THREE.Color(1.0, 0.16, 0.12);
const HALO_WIDTH = 0.034;

/**
 * Glow around a light strip: the strip's own geometry inflated along its
 * normals, faded towards the silhouette and alpha-blended, so it tints the
 * white ceramic and graphite around the strip blue (which the bloom pass
 * cannot do without also blooming the white page).
 */
function createHaloMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: HALO_COLOR.clone() }, uStrength: { value: 0.55 } },
    vertexShader: /* glsl */ `
      varying float vFacing;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position + normal * ${HALO_WIDTH}, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying float vFacing;
      void main() {
        gl_FragColor = vec4(uColor, pow(vFacing, 3.0) * uStrength);
      }`,
    transparent: true,
    depthWrite: false,
  });
}

/** Self-lit strips (ears, neck ring, shoulders) and their glow halo; `alert` blends blue to red. */
export function createLightMaterial() {
  const material = new THREE.MeshBasicMaterial({ color: LIGHT_COLOR.clone(), toneMapped: false });
  const halo = createHaloMaterial();
  return {
    material,
    halo,
    setLevel(level: number, alert = 0) {
      material.color.lerpColors(LIGHT_COLOR, ALERT_COLOR, alert).multiplyScalar(level);
      halo.uniforms.uColor.value.lerpColors(HALO_COLOR, ALERT_HALO_COLOR, alert);
      halo.uniforms.uStrength.value = 0.8 * level;
    },
  };
}
