// Track A NPC policy types. Pure data shapes for the utility scorer and the
// decision trace that feeds the "why did the NPC do that?" overlay/log.
// See specs/npc_ai_plan.md §2.
import type { GameAction } from "../types";

/** Named archetypes; behavior differences are weight vectors, never branches. */
export type PersonalityId =
  | "default"
  | "aggressive"
  | "cautious"
  | "sniper"
  | "berserker"
  | "support";

/**
 * Weights on normalized (0..1) considerations. A score is the sum of each
 * consideration times its weight — keep every signal ~0..1 so weights stay
 * interpretable while tuning (specs/npc_ai_plan.md §1.4).
 */
export interface Weights {
  damage: number; // damage dealt to enemies
  kill: number; // bonus for securing a knockout
  positioning: number; // closing on / holding the preferred distance
  safety: number; // avoiding incoming threat
  cover: number; // cover terrain / damage mitigation
  survival: number; // preserving own HP / self-protection
  focusFire: number; // concentrating on the most-wounded enemy
  economy: number; // energy/chi/focus efficiency (prefer cheap when high)
  support: number; // heals/shields for allies
  elemental: number; // standing on a matching elemental source (water)
}

/** One scored candidate. `components` are post-weight contributions (Σ ≈ score). */
export interface Scored<T> {
  value: T;
  score: number;
  components: Record<string, number>;
  label: string;
}

export interface TraceAlternative {
  label: string;
  score: number;
}

/** A single NPC decision, retained for the debug overlay and balance logs. */
export interface DecisionTrace {
  characterId: string;
  phase: "avatar" | "move" | "play" | "assign" | "pass" | "scrap";
  chosen: string;
  score: number;
  components: Record<string, number>;
  alternatives: TraceAlternative[];
  note?: string;
}

export interface ChooseAiOptions {
  /** Named archetype, or explicit weight overrides (merged over the archetype). */
  personality?: PersonalityId | Partial<Weights>;
  /** Seeded PRNG for tie-breaks (defaults to Math.random). */
  random?: () => number;
  /** Near-tie band as a fraction of the best score (default 0.06). */
  tieBand?: number;
  /** Alternatives retained in the trace (default 4). */
  traceTop?: number;
}

export interface AiDecision {
  /** The proposed action, or null when the side has nothing left to do. */
  action: GameAction | null;
  trace: DecisionTrace | null;
}
