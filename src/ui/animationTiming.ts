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
  /** Stagger between the light secondary marks in compound element effects. */
  attackFxDelay: {
    waterEcho: 120,
    slashSecond: 60,
  },
  /** Vector cue timings by reusable move shape. */
  moveShape: {
    projectile: 420,
    line: 480,
    area: 520,
    "push-pull": 400,
    dash: 360,
  },
  /** Short viewport-level cues; keep every value below one second. */
  screenImpact: {
    dust: 460,
    fire: 250,
    water: 420,
    air: 360,
    earth: 460,
    slash: 190,
  },
  /** How long a floating "-x" / "+y" number stays on screen. */
  combatFloat: 800,
} as const;

/** Longest attack effect, used to keep the overlay mounted long enough. */
export const ATTACK_FX_MAX_MS = Math.max(
  ...Object.values(ANIMATION_TIMING.attackFx),
  ...Object.values(ANIMATION_TIMING.moveShape),
  ...Object.values(ANIMATION_TIMING.screenImpact),
);

/** Dismiss the attack overlay a beat after its animation ends. */
export const ATTACK_FX_DISMISS_MS = ATTACK_FX_MAX_MS + 120;

/** Dismiss the floating number a beat after its animation ends. */
export const COMBAT_FLOAT_DISMISS_MS = ANIMATION_TIMING.combatFloat + 120;
