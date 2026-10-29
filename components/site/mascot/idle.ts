import * as THREE from "three";

const { damp, randFloat, randFloatSpread } = THREE.MathUtils;
/** Quiet time (ms without pointer movement) before the robot looks around on its own. */
const QUIET_BEFORE_GLANCE = 2500;
const SERVO_SPEED = 3.2;

export type IdlePose = {
  lift: number;
  bodyYaw: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  /** Eye look offset matching the glance (iris angles). */
  look: THREE.Vector2;
};

/**
 * Idle life for a robot (no breathing): a slow "powered on" cycle that
 * lifts the torso and nudges the head like servos holding position, plus
 * occasional glances — the head turns (sometimes with a curious tilt),
 * holds, and returns — while nobody is moving the pointer.
 */
export function createIdle() {
  const pose: IdlePose = { lift: 0, bodyYaw: 0, headYaw: 0, headPitch: 0, headRoll: 0, look: new THREE.Vector2() };
  const glance = { yaw: 0, pitch: 0, roll: 0 };
  const current = { yaw: 0, pitch: 0, roll: 0 };
  let time = 0;
  let nextGlance = randFloat(4, 7);
  let holdUntil = -1;

  function update(delta: number, quiet: boolean) {
    time += delta;
    // glance scheduler: turn, hold, return to centre
    if (holdUntil >= 0 && time > holdUntil) {
      glance.yaw = glance.pitch = glance.roll = 0;
      holdUntil = -1;
      nextGlance = time + randFloat(5, 9);
    } else if (holdUntil < 0 && time > nextGlance) {
      if (quiet) {
        glance.yaw = randFloatSpread(0.36);
        glance.pitch = randFloatSpread(0.12);
        glance.roll = Math.random() < 0.4 ? randFloatSpread(0.16) : 0;
        holdUntil = time + randFloat(1.2, 2.2);
      } else {
        nextGlance = time + randFloat(2, 4);
      }
    }
    if (!quiet && holdUntil >= 0) holdUntil = Math.min(holdUntil, time);
    for (const key of ["yaw", "pitch", "roll"] as const) current[key] = damp(current[key], glance[key], SERVO_SPEED, delta);

    pose.lift = 0.007 * Math.sin(time * 0.9) + 0.002 * Math.sin(time * 2.3);
    pose.bodyYaw = 0.018 * Math.sin(time * 0.37) + current.yaw * 0.15;
    pose.headYaw = 0.012 * Math.sin(time * 0.61 + 1.3) + current.yaw;
    pose.headPitch = 0.014 * Math.sin(time * 0.9 - 0.6) + current.pitch;
    pose.headRoll = 0.018 * Math.sin(time * 0.47 + 2.1) + current.roll;
    pose.look.set(current.yaw * 0.25, -current.pitch * 0.4); // +pitch tilts the head down
    return pose;
  }

  return { update, isQuiet: (lastMoveAt: number) => performance.now() - lastMoveAt > QUIET_BEFORE_GLANCE };
}
