// Damage / shields / healing. Spec §6.
// Full attack ordering (attribute mods, Avatar bonus, Cover, shields) lands
// with card resolution (step 4); this module hosts the shared HP/shield/KO
// core used by hazards, entry triggers, and tests.
import type { AttributeSet, GameState } from "../types";
import { getCharacterOrThrow } from "./statuses";
import { updateMatchResult } from "./turns";

export function aggressionModifier(agg: number): number {
  return Math.max(-1, Math.min(1, Math.floor((agg - 3) / 2)));
}

export function rawDamage(
  base: number,
  attackerAgg: number,
  scalesWithAggression: boolean,
  cardDamageModifier = 0,
): number {
  const mod = scalesWithAggression ? aggressionModifier(attackerAgg) : 0;
  return Math.max(0, base + mod + cardDamageModifier);
}

export function attackVsEvasion(
  attackerPerception: number,
  accuracyModifier: number,
  defenderAgility: number,
  evasionModifier: number,
): "hit" | "tie" | "evaded" {
  const attack = attackerPerception + accuracyModifier;
  const evade = defenderAgility + evasionModifier;
  if (evade > attack) return "evaded";
  if (evade === attack) return "tie";
  return "hit";
}

export function requiresAttributesMet(
  attrs: AttributeSet,
  required?: Partial<AttributeSet>,
): boolean {
  if (!required) return true;
  return (Object.keys(required) as (keyof AttributeSet)[]).every(
    (k) => attrs[k] >= (required[k] ?? 0),
  );
}

// TODO(step 3): applyDamage with shields, Cover, Avatar bonus ordering,
// knockout + Avatar instant-loss check.
export interface DamageOutcome {
  events: string[];
  knockedOut: boolean;
  matchEnded: boolean;
}

/**
 * Reduce HP by `amount` (shields absorb first, FIFO). Checks knockout and
 * the authoritative match result. Mutates state; returns log events.
 */
export function dealDamage(
  state: GameState,
  characterId: string,
  amount: number,
  cause: string,
): DamageOutcome {
  const events: string[] = [];
  const c = getCharacterOrThrow(state, characterId);
  if (c.health <= 0) return { events, knockedOut: false, matchEnded: false };
  let remaining = Math.max(0, amount);
  while (remaining > 0 && c.shields.length > 0) {
    const shield = c.shields[0];
    const absorbed = Math.min(shield.amount, remaining);
    shield.amount -= absorbed;
    remaining -= absorbed;
    events.push(`${c.definitionId}'s shield absorbs ${absorbed} (${cause}).`);
    if (shield.amount <= 0) c.shields.shift();
  }
  if (remaining > 0) {
    c.health -= remaining;
    events.push(`${c.definitionId} takes ${remaining} (${cause}).`);
  }
  let knockedOut = false;
  if (c.health <= 0) {
    c.health = 0;
    c.momentum = 0;
    knockedOut = true;
    events.push(`${c.definitionId} is knocked out.`);
  }
  updateMatchResult(state);
  return { events, knockedOut, matchEnded: state.winnerId !== null || state.isDraw };
}
