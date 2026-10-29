/** GLSL shared by the network layers. */

/** Dims vertices seen through the brain hull (back side / inside the volume). */
export const hullVisibility = /* glsl */ `
uniform vec3 uCameraLocal;
uniform vec3 uHullCenter[2];
uniform vec3 uHullRadii[2];
float hullVisibility(vec3 p) {
  float visible = 1.0;
  for (int i = 0; i < 2; i++) {
    vec3 c = (uCameraLocal - uHullCenter[i]) / uHullRadii[i];
    vec3 d = (p - uHullCenter[i]) / uHullRadii[i] - c;
    float a = dot(d, d);
    float b = dot(c, d);
    float disc = b * b - a * (dot(c, c) - 1.0);
    if (disc > 0.0) {
      float enter = (-b - sqrt(disc)) / a;
      if (enter < 0.985) visible = min(visible, 0.26);
    }
  }
  return visible;
}`;

export const lineVertex = /* glsl */ `
${hullVisibility}
attribute float aActivation;
varying float vActivation;
varying float vVisible;
void main() {
  vActivation = aActivation;
  vVisible = hullVisibility(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const lineFragment = /* glsl */ `
uniform float uIntensity;
varying float vActivation;
varying float vVisible;
void main() {
  // dim wiring; edges recently crossed by a signal keep a fading afterglow
  vec3 color = vec3(0.04, 0.24, 0.75) * 0.17
    + vec3(0.08, 0.5, 1.25) * vActivation * 0.3;
  gl_FragColor = vec4(color * vVisible * uIntensity, 1.0);
}`;

export const pointVertex = /* glsl */ `
${hullVisibility}
attribute float aActivation;
uniform float uSize;
uniform float uScale;
varying float vActivation;
varying float vVisible;
void main() {
  vActivation = aActivation;
  vVisible = hullVisibility(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * (0.75 + aActivation * 0.9) * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

export const pointFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uBase;
uniform float uIntensity;
varying float vActivation;
varying float vVisible;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float core = exp(-r2 * 9.0) + 0.35 * exp(-r2 * 2.5);
  gl_FragColor = vec4(uColor * core * (uBase + vActivation) * vVisible * uIntensity, 1.0);
}`;
