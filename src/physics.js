import RAPIER from '@dimforge/rapier2d-compat';

// Physics is metres/seconds. Rendering multiplies by PX_PER_M.
export const PX_PER_M = 18;

// Rapier steps at this constant dt, always. Never a variable frame delta.
export const FIXED_DT = 1 / 60;

// If the tab stalls, don't try to catch up more than this many steps at once.
const MAX_STEPS_PER_FRAME = 5;

let ready = false;

/** Loads the Rapier WASM. Must be awaited once before any world is created. */
export async function initRapier() {
  if (!ready) {
    await RAPIER.init();
    ready = true;
  }
  return RAPIER;
}

export { RAPIER };

/**
 * A Rapier world with a fixed-timestep accumulator.
 * Top-down game, so gravity is zero in both axes.
 */
export class Physics {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: 0 });
    this.world.timestep = FIXED_DT;
    this.accumulator = 0;
  }

  /**
   * Advances the world by whole fixed steps.
   * @param {number} dtMs frame delta in milliseconds, from Phaser
   * @param {(dt: number) => void} [onStep] called before each step, for per-step forces
   * @param {() => void} [afterStep] called after each step, for bookkeeping
   */
  step(dtMs, onStep, afterStep) {
    this.accumulator += Math.min(dtMs, 250) / 1000;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      if (onStep) onStep(FIXED_DT);
      this.world.step();
      if (afterStep) afterStep();
      this.accumulator -= FIXED_DT;
      steps += 1;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
  }

  destroy() {
    this.world.free();
    this.world = null;
  }
}

export const mToPx = (m) => m * PX_PER_M;
