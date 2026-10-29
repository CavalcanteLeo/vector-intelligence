import * as THREE from "three";
import type { Expression } from "./expressions";
import { createIdle } from "./idle";
import type { MascotModel } from "./model-setup";
import type { Pointer } from "./pointer";

const { damp, clamp } = THREE.MathUtils;
const DRAG_SPEED = 0.0085;
const RETURN_DELAY = 2600;
const MAX_SPIN = 4;
const headScreen = new THREE.Vector3();

/**
 * Articulation: the gaze follows the cursor (eyes most, head a lot, torso
 * a little, all with natural limits); click-drag spins the whole mascot
 * around its vertical axis with inertia and eases back to face the viewer
 * once the user lets go. When the pointer rests, an idle cycle keeps the
 * robot alive (see idle.ts).
 */
export function createRig(root: THREE.Object3D, model: MascotModel, pointer: Pointer) {
  const gaze = { x: 0, y: 0 };
  const spin = { angle: 0, velocity: 0 };
  const headRest = model.head.quaternion.clone();
  const headEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const headTurn = new THREE.Quaternion();
  const idle = createIdle();
  const restY = root.position.y;

  function update(delta: number, camera: THREE.Camera, canvas: HTMLElement, { happy, curious, sad, surprise, dizzy }: Expression, motion: boolean) {
    const { state } = pointer;
    const rect = canvas.getBoundingClientRect();
    model.head.getWorldPosition(headScreen).setY(headScreen.y + 0.75).project(camera);
    const cursorX = ((state.clientX - rect.left) / rect.width) * 2 - 1;
    const cursorY = 1 - ((state.clientY - rect.top) / rect.height) * 2;
    const follow = motion && state.hasCursor && !state.dragging;
    const targetX = follow ? Math.tanh((cursorX - headScreen.x) * 0.5) : 0;
    const targetY = follow ? Math.tanh((cursorY - headScreen.y) * 0.7) : 0;
    gaze.x = damp(gaze.x, targetX, 4, delta);
    gaze.y = damp(gaze.y, targetY, 4, delta);

    const drag = pointer.takeDrag() * DRAG_SPEED;
    if (state.dragging) {
      spin.angle += drag;
      const velocity = delta > 0 ? clamp(drag / delta, -MAX_SPIN, MAX_SPIN) : 0;
      spin.velocity = damp(spin.velocity, velocity, 12, delta);
    } else {
      spin.angle += spin.velocity * delta;
      spin.velocity = damp(spin.velocity, 0, 7, delta);
      if (performance.now() - state.lastDragAt > RETURN_DELAY) {
        const facing = Math.round(spin.angle / (Math.PI * 2)) * Math.PI * 2;
        spin.angle = damp(spin.angle, facing, 2.2, delta);
      }
    }
    root.rotation.y = spin.angle;

    const quiet = motion && !state.dragging && idle.isQuiet(state.lastMoveAt);
    const pose = motion ? idle.update(delta, quiet) : null;
    root.position.y = restY + (pose?.lift ?? 0) + surprise * 0.025;
    const wobble = motion ? dizzy * Math.min(1, dizzy * 3) : 0;
    const t = performance.now() / 1000;
    headEuler.set(
      clamp(-gaze.y * 0.2, -0.16, 0.2) + curious * 0.06 + sad * 0.09 - surprise * 0.12 + wobble * 0.04 * Math.sin(t * 3.7) + (pose?.headPitch ?? 0),
      gaze.x * 0.34 + (pose?.headYaw ?? 0),
      gaze.x * -0.03 + (happy * 0.06 + curious * 0.2) * Math.sign(gaze.x || 1) + wobble * 0.09 * Math.sin(t * 5.5)
        + (pose?.headRoll ?? 0),
    );
    model.head.quaternion.copy(headRest).multiply(headTurn.setFromEuler(headEuler));
    model.body.rotation.y = gaze.x * 0.1 + (pose?.bodyYaw ?? 0);
    for (const eye of model.eyes) {
      eye.uniforms.uLook.value.set((gaze.x * 0.11 + (pose?.look.x ?? 0)) * eye.side, gaze.y * 0.07 + (pose?.look.y ?? 0) - sad * 0.04);
    }
  }

  return { update, spin, isSettled: () => !pointer.state.dragging && Math.abs(spin.velocity) < 1e-3 };
}
