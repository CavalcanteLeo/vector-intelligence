import * as THREE from "three";
import { withMetalGrain } from "./metal-grain";

/** Opaque shell materials, keyed by the material names authored in Blender. */
export function createSurfaceMaterials() {
  return {
    // smooth satin ceramic, light grey like the reference art
    Ceramic: new THREE.MeshPhysicalMaterial({
      color: 0xe1e4e9, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.85,
    }),
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
    // inner chamber (core + floor): the chest's grained gunmetal, darker and
    // with weak reflections (the floor faces the key light), double-sided so
    // the cavity is closed from inside
    Cavity: withMetalGrain(new THREE.MeshPhysicalMaterial({
      color: 0x030304, metalness: 0, roughness: 0.85, specularIntensity: 0.06, envMapIntensity: 0.06,
      side: THREE.DoubleSide,
    }), { bump: 0.3, roughness: 0.3, tone: 0.12, flakes: 0 }),
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
      attribute float aFade;
      varying float vFacing;
      varying float vFade;
      void main() {
        vFade = aFade;
        vec4 mv = modelViewMatrix * vec4(position + normal * ${HALO_WIDTH}, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying float vFacing;
      varying float vFade;
      void main() {
        gl_FragColor = vec4(uColor, pow(vFacing, 3.0) * uStrength * vFade);
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
