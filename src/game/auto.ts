// NPC entry point. Thin wrapper over the Track A utility policy
// (src/game/ai/policy.ts): the AI only *proposes* a GameAction and the engine
// validates/resolves it. This remains the stable seam used by the UI's auto
// loop and the auto-vs-auto tests.
import { validateTarget } from "./rules/targeting";
import { cloneState } from "./state";
import { chooseAiAction } from "./ai/policy";
import type { AiDecision, Weights } from "./ai/types";
import type { CardDefinition, GameAction, GameState, Position } from "./types";

/**
 * Would stepping to `dest` dodge a locked focused attack? Re-checks the
 * attack from the hypothetical tile using the shared validator.
 */
export function evadeEscapes(
  state: GameState,
  attackerId: string,
  card: CardDefinition,
  targetId: string,
  dest: Position,
): boolean {
  const clone = cloneState(state);
  const target = clone.characters.find((ch) => ch.id === targetId);
  if (!target) return false;
  target.position = { ...dest };
  return !validateTarget(clone, attackerId, card, {
    kind: "character",
    characterId: targetId,
  }).ok;
}

/**
 * One authorized action for `playerId`, or null when that side has nothing
 * left to do (caller should pass/end the round). Never invents illegal moves:
 * the policy re-validates every proposed action through the engine and falls
 * back to a pass on rejection.
 *
 * `weights` is the Track B seam: pre-resolved weight deltas (e.g. from a
 * round-level LLM stance) merged over the character's archetype. Omitting it
 * keeps decisions exactly Track-A-seeded.
 */
export function chooseAutoAction(
  state: GameState,
  playerId: string,
  random: () => number = Math.random,
  weights?: Partial<Weights>,
): GameAction | null {
  return chooseAiAction(state, playerId, { random, personality: weights }).action;
}

/** As chooseAutoAction, but also returns the decision trace (debug overlay). */
export function chooseAutoActionTraced(
  state: GameState,
  playerId: string,
  random: () => number = Math.random,
  weights?: Partial<Weights>,
): AiDecision {
  return chooseAiAction(state, playerId, { random, personality: weights });
}
