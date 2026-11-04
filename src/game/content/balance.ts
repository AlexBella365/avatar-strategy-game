// Match-tuning knobs (single source of truth for balance experiments).
//
// These are *data*, not engine logic: the engine reads them through
// `tuningOf(state)` and the self-play harness overrides them per cell
// (specs/balance_testing_plan.md §4/§10). Defaults describe the shipped game;
// changing a default here is a balance change and needs a note in the plan.
import type { MatchTuning } from "../types";

export const DEFAULT_MATCH_TUNING: MatchTuning = {
  /**
   * Base movement points per activation (gear adds on top). The lethality
   * pass raised this from 1 to 2: with 1 tile/activation both sides spent the
   * first ~3 rounds walking, and most matches hit the round cap before any KO.
   */
  movement: 2,
  /**
   * Multiplier on every character's max/starting HP. 0.58 turns the 14–20 HP
   * roster into 8–12 HP so a focused character dies inside a meaningful window.
   */
  hpScale: 0.58,
  /**
   * Rows inset from the deployment edges (1 = rows 1 and 5). Starting two rows
   * closer plus movement 2 makes contact happen in round 1–2 instead of 3–4.
   */
  deploymentInset: 1,
  /** Team energy refreshed at the start of each round. */
  energyPerRound: 4,
  /** Multiplier on card healing (instant and heal-over-time). */
  healingScale: 1,
  /**
   * Multiplier on incoming damage after the engine's damage formula. 1.75
   * lands the roster-parity pass: with 0.58 HP the printed 2-damage staples
   * deal 4, which gives hero sustain decks the finishing power they lacked
   * while keeping games inside the KO/cap bands (specs/balance_testing_plan.md
   * §10). The cardless basic attack opts out (rules/basics.ts).
   */
  damageScale: 1.75,
};

/** Resolved tuning for a match: per-match overrides fall back to defaults. */
export function tuningOf(state: { tuning?: Partial<MatchTuning> }): MatchTuning {
  return { ...DEFAULT_MATCH_TUNING, ...(state.tuning ?? {}) };
}
