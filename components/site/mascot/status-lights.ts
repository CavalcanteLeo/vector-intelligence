import * as THREE from "three";

/**
 * Power envelope when switching modes, eased between keys:
 * [time (s), power, 0 = old colour / 1 = new colour].
 * Fade out, one soft blink in the new colour, dim, then power up.
 */
const KEYS: [number, number, number][] = [
  [0, 1, 0], [0.22, 0.08, 0], [0.24, 0.08, 1], [0.36, 0.7, 1], [0.5, 0.12, 1], [0.9, 1, 1],
];
const FLICKER_LENGTH = KEYS[KEYS.length - 1][0];

function envelope(time: number) {
  const next = KEYS.findIndex(([t]) => t > time);
  if (next <= 0) return next === 0 ? KEYS[0] : KEYS[KEYS.length - 1];
  const [t0, p0, c0] = KEYS[next - 1];
  const [t1, p1, c1] = KEYS[next];
  const k = THREE.MathUtils.smootherstep(time, t0, t1);
  return [time, p0 + (p1 - p0) * k, k < 1 ? c0 : c1] as const;
}

/** Brain speed while nobody is around. */
const IDLE_BRAIN_SPEED = 0.3;

/**
 * Status lights: blue while the visitor's pointer is on the page, red
 * (standby) once it leaves the document. Switching dims, blinks once softly
 * and powers back up in the new colour, like a system changing state. The
 * brain stays blue but slows down in standby.
 */
export function createStatusLights() {
  const status = { alert: 0, power: 1, brainSpeed: 1 };
  let target = false;
  let from = 0;
  let clock = Infinity;

  function update(delta: number, away: boolean, motion: boolean) {
    if (away !== target) {
      target = away;
      from = status.alert;
      clock = motion ? 0 : Infinity;
    }
    const to = target ? 1 : 0;
    clock += delta;
    const [, power, colour] = envelope(clock);
    status.alert = colour < 1 ? from : to;
    status.power = power;
    status.brainSpeed = THREE.MathUtils.damp(status.brainSpeed, target ? IDLE_BRAIN_SPEED : 1, 1.5, delta);
    return status;
  }

  return {
    update,
    isSettled: () => clock > FLICKER_LENGTH && Math.abs(status.brainSpeed - (target ? IDLE_BRAIN_SPEED : 1)) < 0.01,
  };
}
