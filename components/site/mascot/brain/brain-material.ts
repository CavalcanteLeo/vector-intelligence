import * as THREE from "three";
import { MAX_GLASS_SIGNALS } from "../materials/glass-material";

/**
 * Machined cortex: dark blue metal plates on the gyri with a crisp
 * highlight, recessed sulci, and seams that act as light channels: they
 * glow faintly and flare up where travelling signals pass nearby.
 * It does not write depth so the network behind can be revealed (dimmed by
 * the hull test); hemispheres are drawn far-to-near via renderOrder.
 */
export function createBrainMaterial(signals: THREE.Vector4[]) {
  return new THREE.ShaderMaterial({
    uniforms: { uSignals: { value: signals }, uIntensity: { value: 1 } },
    vertexColors: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying float vCrest;
      varying float vSeam;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorld;
      void main() {
        vCrest = color.r;
        vSeam = color.g;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec4 uSignals[${MAX_GLASS_SIGNALS}];
      uniform float uIntensity;
      varying float vCrest;
      varying float vSeam;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorld;
      void main() {
        vec3 normal = normalize(vNormal);
        float facing = clamp(dot(normal, vView), 0.0, 1.0);
        float rim = pow(1.0 - facing, 2.2);
        float plate = smoothstep(0.25, 0.85, vCrest) * (1.0 - vSeam);
        vec3 sulcus = vec3(0.012, 0.01, 0.07);
        vec3 metal = vec3(0.03, 0.07, 0.38);
        vec3 color = mix(sulcus, metal, plate);
        // crisp studio highlight on the plates (key light up-left, view space)
        vec3 halfway = normalize(normalize(vec3(-0.5, 0.8, 0.6)) + vView);
        color += vec3(0.45, 0.62, 1.0) * pow(max(dot(normal, halfway), 0.0), 60.0) * plate * 0.5;
        color += vec3(0.1, 0.22, 0.9) * rim * (0.3 + 0.4 * plate);
        // channels: sulci and seams carry a faint resting glow
        float channel = max(vSeam, 1.0 - smoothstep(0.05, 0.4, vCrest));
        color += vec3(0.05, 0.3, 0.95) * channel * 0.12;
        float light = 0.0;
        for (int i = 0; i < ${MAX_GLASS_SIGNALS}; i++) {
          vec3 offset = vWorld - uSignals[i].xyz;
          light += uSignals[i].w * exp(-dot(offset, offset) * 220.0);
        }
        color += vec3(0.08, 0.45, 1.1) * light * (0.15 + 0.25 * plate + 1.1 * channel);
        gl_FragColor = vec4(color * uIntensity, 1.0);
      }`,
  });
}
