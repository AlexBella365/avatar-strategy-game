// Damage / shields / healing. Spec §6.
import type { AttributeSet } from "../types";

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
