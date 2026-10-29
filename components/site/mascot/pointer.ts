export type Mood = "neutral" | "happy" | "curious";

const MOOD_SELECTOR = "[data-mascot-mood]";
const CLICK_SLOP = 6;
const CLICK_TIME = 400;

const moodOf = (element: Element | null | undefined): Mood =>
  (element?.closest?.(MOOD_SELECTOR)?.getAttribute("data-mascot-mood") as Mood | undefined) ?? "neutral";

/**
 * Pointer state for the mascot: cursor position (client px), drag rotation
 * on the canvas, clicks ("pokes") that did not turn into a drag, and the
 * mood requested by the hovered or focused element
 * (`data-mascot-mood="happy" | "curious"`).
 */
export function createPointer(canvas: HTMLElement, onActivity: () => void) {
  const state = {
    clientX: window.innerWidth / 2,
    clientY: window.innerHeight / 2,
    hasCursor: false,
    dragging: false,
    dragDelta: 0,
    lastDragAt: -Infinity,
    lastMoveAt: -Infinity,
    mood: "neutral" as Mood,
    /** The pointer left the document (to the browser chrome or another window). */
    away: false,
    /** Last click on the canvas (client px); `count` increases on each one. */
    poke: { count: 0, x: 0, y: 0 },
  };
  const press = { x: 0, y: 0, at: 0 };
  let lastX = 0;
  let pointerId = -1;

  const onMove = (event: PointerEvent) => {
    state.clientX = event.clientX;
    state.clientY = event.clientY;
    state.hasCursor = event.pointerType === "mouse" || state.dragging;
    state.lastMoveAt = performance.now();
    state.away = false;
    if (state.dragging && event.pointerId === pointerId) {
      state.dragDelta += event.clientX - lastX;
      lastX = event.clientX;
      state.lastDragAt = performance.now();
    }
    onActivity();
  };
  const onDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    state.dragging = true;
    pointerId = event.pointerId;
    lastX = event.clientX;
    state.lastDragAt = performance.now();
    Object.assign(press, { x: event.clientX, y: event.clientY, at: performance.now() });
    if (event.isTrusted) canvas.setPointerCapture(event.pointerId);
    onActivity();
  };
  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    state.dragging = false;
    pointerId = -1;
    const still = Math.hypot(event.clientX - press.x, event.clientY - press.y) < CLICK_SLOP;
    if (still && performance.now() - press.at < CLICK_TIME) {
      state.poke = { count: state.poke.count + 1, x: event.clientX, y: event.clientY };
      onActivity();
    }
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  const setMood = (event: Event) => {
    const leaving = event.type === "pointerout" || event.type === "focusout";
    const target = leaving ? (event as FocusEvent).relatedTarget : event.target;
    state.mood = moodOf(target as Element | null);
    onActivity();
  };
  const onLeave = () => {
    state.hasCursor = false;
    state.away = true;
    onActivity();
  };
  const onEnter = () => {
    state.away = false;
    onActivity();
  };
  const root = document.documentElement;

  window.addEventListener("pointermove", onMove, { passive: true });
  root.addEventListener("mouseleave", onLeave);
  root.addEventListener("mouseenter", onEnter);
  document.addEventListener("pointerover", setMood);
  document.addEventListener("pointerout", setMood);
  document.addEventListener("focusin", setMood);
  document.addEventListener("focusout", setMood);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  return {
    state,
    /** Horizontal drag distance (px) since the last call. */
    takeDrag() {
      const delta = state.dragDelta;
      state.dragDelta = 0;
      return delta;
    },
    dispose() {
      window.removeEventListener("pointermove", onMove);
      root.removeEventListener("mouseleave", onLeave);
      root.removeEventListener("mouseenter", onEnter);
      document.removeEventListener("pointerover", setMood);
      document.removeEventListener("pointerout", setMood);
      document.removeEventListener("focusin", setMood);
      document.removeEventListener("focusout", setMood);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    },
  };
}

export type Pointer = ReturnType<typeof createPointer>;
