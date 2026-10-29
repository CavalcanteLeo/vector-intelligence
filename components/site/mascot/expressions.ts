import * as THREE from "three";
import type { MascotModel } from "./model-setup";
import type { Mood } from "./pointer";

const { damp, randFloat } = THREE.MathUtils;
const CLOSE = 0.07;
const HOLD = 0.04;
const OPEN = 0.13;
const axis = new THREE.Vector3(1, 0, 0);
const turn = new THREE.Quaternion();

function blinkCurve(t: number) {
  if (t < CLOSE) return THREE.MathUtils.smootherstep(t, 0, CLOSE);
  if (t < CLOSE + HOLD) return 1;
  return 1 - THREE.MathUtils.smootherstep(t, CLOSE + HOLD, CLOSE + HOLD + OPEN);
}

export type Expression = { happy: number; curious: number; sad: number; surprise: number; wow: number; dizzy: number };

/** What the face reacts to. `spin` is the drag-turn speed (rad/s). */
export type Cues = { mood: Mood; away: boolean; spin: number };

/** Upper-lid closure of the narrowed eye when curious (share of a blink). */
const CURIOUS_SQUINT = 0.42;
/** Upper-lid droop when sad (share of a blink): a light, wistful look. */
const SAD_DROOP = 0.25;
/** Poke reaction: a quick startle, then a giggle (seconds). */
const STARTLE = 0.35;
const GIGGLE = 1.3;
/** Spin speed (rad/s) for a full "wow", and how fast the dizziness wears off (1/s). */
const WOW_SPIN = 2.2;
const DIZZY_RECOVERY = 0.55;

/** Quick attack, held, then a soft release over [start, end]. */
function bump(t: number, start: number, end: number) {
  if (t < start || t > end) return 0;
  const k = (t - start) / (end - start);
  return THREE.MathUtils.smoothstep(k, 0, 0.2) * (1 - THREE.MathUtils.smoothstep(k, 0.5, 1));
}

/**
 * Facial expressions driven by geometry: eyelids rotate around each
 * eyeball to blink, squint into a smile or narrow one eye when curious;
 * the mouth morphs to a grin, shrinks to a small "o" or turns into a light
 * frown; the irises brighten (happy), widen and scan faster (curious) or dim
 * (sad, while the visitor is away). A click on the robot startles it and
 * makes it giggle; spinning it makes it go "wow" (round mouth, wide eyes)
 * and leaves it a little dizzy (swirling irises) once it stops. Everything eases in and back to neutral.
 */
export function createExpressions(model: MascotModel) {
  const expression: Expression = { happy: 0, curious: 0, sad: 0, surprise: 0, wow: 0, dizzy: 0 };
  let pokeTime = Infinity;
  let blinkTime = -1;
  let nextBlink = randFloat(1.5, 3.5);
  let pendingDouble = false;
  let time = 0;
  const smileIndex = model.mouth?.morphTargetDictionary?.Smile ?? 0;
  const sadIndex = model.mouth?.morphTargetDictionary?.Sad ?? 1;
  const wowIndex = model.mouth?.morphTargetDictionary?.Wow ?? 2;

  function update(delta: number, { mood, away, spin }: Cues, motion: boolean) {
    for (const key of ["happy", "curious"] as const) {
      const on = !away && mood === key;
      expression[key] = damp(expression[key], on ? 1 : 0, on ? 7 : 4.5, delta);
    }
    expression.sad = damp(expression.sad, away ? 1 : 0, away ? 1.6 : 4, delta);
    pokeTime += delta;
    expression.surprise = bump(pokeTime, 0, STARTLE);
    const giggle = bump(pokeTime, STARTLE * 0.7, STARTLE + GIGGLE);
    expression.wow = damp(expression.wow, Math.min(Math.abs(spin) / WOW_SPIN, 1), expression.wow < 0.5 ? 9 : 4, delta);
    expression.dizzy = Math.max(expression.wow, expression.dizzy - delta * DIZZY_RECOVERY);
    const { curious, sad, surprise, wow, dizzy } = expression;
    const happy = Math.max(expression.happy, giggle);
    let blink = 0;
    if (motion) {
      nextBlink -= delta;
      if (blinkTime < 0 && nextBlink <= 0) {
        blinkTime = 0;
        pendingDouble = Math.random() < 0.18;
      }
      if (blinkTime >= 0) {
        blink = blinkCurve(blinkTime);
        blinkTime += delta;
        if (blinkTime > CLOSE + HOLD + OPEN) {
          blinkTime = -1;
          nextBlink = pendingDouble ? 0.12 : randFloat(2.4, 5.8);
          pendingDouble = false;
        }
      }
    }
    for (const lid of model.lids) {
      const upper = lid.blinkAngle > 0;
      const squint = upper && lid.mesh.name.endsWith("Right") ? curious * CURIOUS_SQUINT * lid.blinkAngle : 0;
      const droop = upper ? sad * SAD_DROOP * lid.blinkAngle : 0;
      const angle = upper
        ? Math.max(blink * lid.blinkAngle, happy * lid.smileAngle, squint, droop)
        : Math.min(blink * lid.blinkAngle, happy * lid.smileAngle);
      lid.mesh.quaternion.copy(lid.rest).multiply(turn.setFromAxisAngle(axis, angle));
    }
    if (model.mouth) {
      const influences = model.mouth.morphTargetInfluences;
      if (influences) {
        influences[smileIndex] = happy * (1 - curious) * (1 - surprise) * (1 - wow);
        influences[sadIndex] = sad * (1 - happy) * (1 - surprise) * (1 - wow);
        influences[wowIndex] = wow;
      }
      model.mouth.scale.x = 1 - Math.max(curious, surprise) * 0.4 * (1 - wow);
    }
    if (motion) time += delta * (1 + happy * 1.5 + curious * 4 + surprise * 12 + dizzy * 6);
    for (const eye of model.eyes) {
      eye.uniforms.uGlow.value = 1 + happy * 0.3 + curious * 0.2 + (surprise + wow) * 0.5 - sad * 0.25;
      eye.uniforms.uIrisScale.value = 1 + curious * 0.14 + Math.max(surprise, wow) * 0.22 - sad * 0.05;
      eye.uniforms.uDizzy.value = dizzy;
      eye.uniforms.uTime.value = time;
    }
    return { ...expression, happy };
  }

  return {
    update,
    /** React to a click on the robot. */
    poke: () => { pokeTime = 0; },
    isIdle: () => blinkTime < 0 && pokeTime > STARTLE + GIGGLE && expression.dizzy < 0.01,
  };
}
