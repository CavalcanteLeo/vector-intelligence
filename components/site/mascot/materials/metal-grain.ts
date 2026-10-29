import type * as THREE from "three";

type Grain = {
  /** Micro-relief strength (bump). */
  bump: number;
  /** Roughness spread around the material's value (0..1). */
  roughness: number;
  /** Large-scale tone variation (0..1). */
  tone: number;
  /** Share of randomly tilted metal flakes that sparkle in the reflections (0..1). */
  flakes: number;
};

const noise = /* glsl */ `
varying vec3 vGrainPos;
float grainHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float grainNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(grainHash(i), grainHash(i + vec3(1, 0, 0)), f.x),
                 mix(grainHash(i + vec3(0, 1, 0)), grainHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(grainHash(i + vec3(0, 0, 1)), grainHash(i + vec3(1, 0, 1)), f.x),
                 mix(grainHash(i + vec3(0, 1, 1)), grainHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
vec3 grainFlake(vec3 p) {
  vec3 cell = floor(p);
  return vec3(grainHash(cell), grainHash(cell + 17.31), grainHash(cell + 41.7)) - 0.5;
}
vec3 grainPerturb(vec3 position, vec3 surfaceNormal, float height, float side) {
  vec3 sigmaX = dFdx(position);
  vec3 sigmaY = dFdy(position);
  vec3 r1 = cross(sigmaY, surfaceNormal);
  vec3 r2 = cross(surfaceNormal, sigmaX);
  float det = dot(sigmaX, r1) * side;
  vec3 gradient = sign(det) * (dFdx(height) * r1 + dFdy(height) * r2);
  return normalize(abs(det) * surfaceNormal - gradient);
}`;

/**
 * Procedural cast-metal finish in object space (the meshes carry no UVs):
 * fine sandblasted grain as micro-relief, roughness speckle that breaks up
 * the reflections, randomly tilted flakes that sparkle with the environment
 * (so the finish reads even where the part is in shadow) and tone variation.
 */
export function withMetalGrain<T extends THREE.MeshStandardMaterial>(material: T, { bump, roughness, tone, flakes }: Grain) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGrainPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGrainPos = transformed;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${noise}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float grainTone = grainNoise(vGrainPos * 7.0) * 0.45 + grainNoise(vGrainPos * 21.0) * 0.35
          + grainNoise(vGrainPos * 90.0) * 0.2;
        diffuseColor.rgb *= 1.0 + ${tone.toFixed(3)} * (grainTone - 0.5) * 2.0;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        float grainFine = grainNoise(vGrainPos * 260.0);
        roughnessFactor = clamp(roughnessFactor * (1.0 + ${roughness.toFixed(3)} * (grainFine * 2.0 - 1.0 + grainTone - 0.5)), 0.04, 1.0);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        float grainHeight = (grainFine + 0.5 * grainNoise(vGrainPos * 520.0)) * ${(bump * 0.001).toFixed(5)};
        normal = grainPerturb(-vViewPosition, normal, grainHeight, faceDirection);
        vec3 flake = grainFlake(vGrainPos * 380.0);
        float flakeOn = step(1.0 - ${flakes.toFixed(3)}, grainHash(floor(vGrainPos * 380.0) + 5.13));
        normal = normalize(normal + flake * flakeOn * 0.9);`,
      );
  };
  material.customProgramCacheKey = () => `metal-grain-${bump}-${roughness}-${tone}-${flakes}`;
  return material;
}
