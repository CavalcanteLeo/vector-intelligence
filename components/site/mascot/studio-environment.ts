import * as THREE from "three";

/**
 * Soft studio reflections: a vertical gradient dome plus two large, dim
 * softboxes (key upper-left, cool rim behind). Unlike RoomEnvironment it has
 * no hot emitters, so glossy ceramic and glass get broad, believable
 * highlights instead of blown-out squares.
 */
export function createStudioEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(10, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `varying vec3 vDir; void main(){
        float h = vDir.y;
        vec3 sky = mix(vec3(0.62, 0.66, 0.72), vec3(0.95, 0.97, 1.0), smoothstep(0.0, 0.8, h));
        vec3 ground = mix(vec3(0.62, 0.66, 0.72), vec3(0.16, 0.18, 0.22), smoothstep(0.0, -0.6, h));
        gl_FragColor = vec4(h > 0.0 ? sky : ground, 1.0);
      }`,
    }),
  );
  scene.add(dome);
  const softbox = (color: number, intensity: number, position: THREE.Vector3, size: [number, number]) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(...size),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    panel.position.copy(position);
    panel.lookAt(0, 0, 0);
    scene.add(panel);
  };
  softbox(0xffffff, 2.2, new THREE.Vector3(-4, 5, 5), [6, 4]);
  softbox(0xcfe0ff, 1.4, new THREE.Vector3(5, 3, -4), [3, 6]);
  softbox(0xffffff, 1.1, new THREE.Vector3(5, 1, 4), [3, 3]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
  });
  return target;
}
