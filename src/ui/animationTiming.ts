// Single source of truth for combat-feedback animation timings (milliseconds).
//
// Board.tsx injects these into the board as CSS custom properties, so the
// keyframes in Board.css and the JS dismiss timers in App.tsx stay in sync.
// Tune here only.
export const ANIMATION_TIMING = {
  /** One effect per attack element; the board shows the matching keyframes. */
  attackFx: {
    fire: 500,
    water: 550,
    air: 550,
    earth: 550,
    slash: 350,
  },
  /** How long a floating "-x" / "+y" number stays on screen. */
  combatFloat: 1600,
} as const;

/** Longest attack effect, used to keep the overlay mounted long enough. */
export const ATTACK_FX_MAX_MS = Math.max(...Object.values(ANIMATION_TIMING.attackFx));

/** Dismiss the attack overlay a beat after its animation ends. */
export const ATTACK_FX_DISMISS_MS = ATTACK_FX_MAX_MS + 120;

/** Dismiss the floating number a beat after its animation ends. */
export const COMBAT_FLOAT_DISMISS_MS = ANIMATION_TIMING.combatFloat + 120;
