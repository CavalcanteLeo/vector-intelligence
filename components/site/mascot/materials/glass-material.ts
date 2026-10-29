import * as THREE from "three";

export const MAX_GLASS_SIGNALS = 12;

/**
 * Clear, colourless dome glass.
 *
 * The shell only adds reflections (env + clearcoat) and a fresnel-weighted
 * attenuation of what is behind it, using premultiplied blending, so the
 * glass itself never tints the brain. Light from travelling neural signals
 * is scattered locally on the glass from their world positions.
 */
export function createGlassMaterial() {
  const signals = Array.from({ length: MAX_GLASS_SIGNALS }, () => new THREE.Vector4());
  const uniforms = {
    uSignals: { value: signals },
    uActivity: { value: 0.5 },
  };
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    roughness: 0.16,
    metalness: 0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.7,
    specularIntensity: 1,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGlassWorld;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvGlassWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vGlassWorld;
        uniform vec4 uSignals[${MAX_GLASS_SIGNALS}];
        uniform float uActivity;`,
      )
      .replace(
        "#include <opaque_fragment>",
        `float facing = clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
        float fresnel = pow(1.0 - facing, 3.0);
        vec3 scatter = vec3(0.0);
        for (int i = 0; i < ${MAX_GLASS_SIGNALS}; i++) {
          vec3 offset = vGlassWorld - uSignals[i].xyz;
          scatter += uSignals[i].w * exp(-dot(offset, offset) * 45.0);
        }
        vec3 glow = vec3(0.08, 0.3, 1.0) * (scatter * (0.12 + 0.6 * fresnel) + uActivity * (0.06 + 0.9 * fresnel));
        float alpha = clamp(0.04 + 0.42 * fresnel, 0.0, 0.6);
        // Soft-clip reflections so a light's highlight stays a sheen on the
        // glass instead of a blown-out flare picked up by the bloom pass.
        vec3 sheen = outgoingLight / (1.0 + outgoingLight * 1.4);
        // face-on reflections of the bright studio read as grey haze over the
        // dark chamber: keep them faint and let the rims carry the reflection
        sheen *= mix(0.2, 1.0, smoothstep(0.0, 0.5, fresnel));
        gl_FragColor = vec4(sheen + glow, alpha);`,
      );
  };
  return { material, signals, uniforms };
}

/**
 * Smoked tint of the dome: darkens everything already drawn behind the
 * glass, so the chamber reads deep and dark from any angle while the glass
 * stays colourless. It uses the dome's front faces, so parts sitting between
 * the front and back of the dome (the face plate's inner lip at the dip)
 * are smoked too. Rendered after the shells and before the brain (which
 * draws over it).
 */
export function createGlassInteriorMaterial() {
  return new THREE.MeshBasicMaterial({
    color: 0x030a2e,
    side: THREE.FrontSide,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.ConstantAlphaFactor,
    blendDst: THREE.OneMinusConstantAlphaFactor,
    blendAlpha: 0.97,
  });
}
