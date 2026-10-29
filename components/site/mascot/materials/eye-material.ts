import * as THREE from "three";

type EyeOptions = { irisCenter: [number, number]; irisRadius: number; side: number };

/** Where the two catchlights sit on the iris at rest (iris radii; x towards the nose). */
const GLINTS = [new THREE.Vector2(0.36, 0.42), new THREE.Vector2(-0.42, -0.38)];
const normal = new THREE.Vector3();
const normalMatrix = new THREE.Matrix3();

/**
 * Glossy eyeball lens with a procedural, self-lit iris.
 *
 * UVs hold eyeball angles (u towards the nose, v up), so the iris is drawn
 * on the sphere and rotates with the gaze instead of sliding on a decal.
 * A parallax offset along the view direction makes it read as sitting
 * behind the cornea. The iris carries a live "lens" effect: a slowly
 * turning segmented ring, shimmering aperture spokes and a pulsing core,
 * which twists into a spinning spiral when the robot is dizzy.
 *
 * Catchlights are true reflections: each is a fixed direction in view
 * space, so like every other highlight they stay put while the iris looks
 * around and slide across the eyeball when the head turns.
 */
export function createEyeMaterial({ irisCenter, irisRadius, side }: EyeOptions) {
  const uniforms = {
    uIrisCenter: { value: new THREE.Vector2(...irisCenter) },
    uIrisRadius: { value: irisRadius },
    uLook: { value: new THREE.Vector2() },
    uSide: { value: side },
    uGlow: { value: 1 },
    uTime: { value: 0 },
    uIrisScale: { value: 1 },
    uDizzy: { value: 0 },
    uGlints: { value: GLINTS.map(() => new THREE.Vector3(0, 0, 1)) },
  };
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x05070b,
    metalness: 0.1,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.3,
  });
  material.defines = { USE_UV: "" };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec2 uIrisCenter;
        uniform float uIrisRadius;
        uniform vec2 uLook;
        uniform float uSide;
        uniform float uGlow;
        uniform float uTime;
        uniform float uIrisScale;
        uniform float uDizzy;
        uniform vec3 uGlints[${GLINTS.length}];
        float glint(vec3 surfaceNormal, vec3 direction, float size) {
          vec3 target = normalize((viewMatrix * vec4(direction, 0.0)).xyz);
          float angle = acos(clamp(dot(surfaceNormal, target), -1.0, 1.0));
          return 1.0 - smoothstep(size * 0.6, size, angle);
        }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          vec3 view = normalize(vViewPosition);
          vec2 parallax = vec2(view.x * uSide, -view.y) * 0.035;
          // glTF stores V flipped: recover the eyeball elevation
          vec2 angles = vec2(vUv.x, 1.0 - vUv.y);
          vec2 p = angles - uIrisCenter - uLook + parallax;
          float r = length(p) / (uIrisRadius * uIrisScale);
          // dizzy: twist the iris pattern into a turning spiral
          float angle = atan(p.y, p.x) + uDizzy * ((1.0 - r) * 9.0 + uTime * 3.0 * uSide);
          vec3 hot = vec3(0.35, 1.25, 2.0) * (1.0 + 0.12 * sin(uTime * 2.1));
          vec3 mid = vec3(0.04, 0.55, 1.45);
          vec3 deep = vec3(0.01, 0.12, 0.6);
          vec3 iris = mix(hot, mid, smoothstep(0.05, 0.55, r));
          iris = mix(iris, deep, smoothstep(0.6, 1.0, r));
          iris *= 0.93 + 0.07 * sin(angle * 23.0 + r * 7.0) * smoothstep(0.3, 0.7, r);
          iris *= 1.0 - 0.25 * exp(-pow((r - 0.5) / 0.08, 2.0));
          // aperture spokes drifting around the pupil
          float spokes = pow(0.5 + 0.5 * sin(angle * 14.0 + uTime * 0.7 * uSide), 6.0);
          iris += vec3(0.15, 0.6, 1.3) * spokes * smoothstep(0.2, 0.45, r) * (1.0 - smoothstep(0.6, 0.85, r)) * 0.35;
          // segmented lens ring turning slowly
          float segment = fract(angle / 6.28318 * 16.0 - uTime * 0.06 * uSide);
          float dash = smoothstep(0.08, 0.16, segment) * (1.0 - smoothstep(0.62, 0.7, segment));
          iris += vec3(0.4, 1.1, 2.0) * dash * exp(-pow((r - 0.8) / 0.035, 2.0)) * 0.55;
          float disc = 1.0 - smoothstep(0.94, 1.02, r);
          float halo = exp(-max(r - 1.0, 0.0) * 4.0) * (1.0 - disc);
          vec3 n = normalize(normal);
          float catchLight = glint(n, uGlints[0], 0.03) + 0.5 * glint(n, uGlints[1], 0.014);
          totalEmissiveRadiance += (iris * disc + vec3(0.0, 0.14, 0.55) * halo * 0.6) * uGlow
            + vec3(2.6) * catchLight;
        }`,
      );
  };
  return { material, uniforms };
}

/**
 * Aim the catchlights: take the lens normal (world space, model at rest)
 * where each glint should sit on the iris. The camera is fixed, so these
 * directions are fixed in view space from then on.
 */
export function aimGlints(lens: THREE.Mesh, { irisCenter, irisRadius, side }: EyeOptions, targets: THREE.Vector3[]) {
  const uv = lens.geometry.getAttribute("uv");
  const normals = lens.geometry.getAttribute("normal");
  normalMatrix.getNormalMatrix(lens.matrixWorld);
  GLINTS.forEach((offset, index) => {
    const u = irisCenter[0] + offset.x * side * irisRadius;
    const v = 1 - (irisCenter[1] + offset.y * irisRadius);
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < uv.count; i++) {
      const distance = (uv.getX(i) - u) ** 2 + (uv.getY(i) - v) ** 2;
      if (distance < bestDistance) { bestDistance = distance; best = i; }
    }
    targets[index].copy(normal.fromBufferAttribute(normals, best).applyMatrix3(normalMatrix).normalize());
  });
}
