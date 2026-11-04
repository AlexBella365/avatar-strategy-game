// Heal-over-time (regeneration). Spec: healing is deliberately slower and
// weaker than damage, so most of a heal is *delayed* to the end of the round
// and cannot undo a burst in the same activation it lands.
//
// Pools stack, tick once per round-end, and clear on KO. The immediate `heal`
// effect still exists (see cards.ts); `healOverTime` schedules the delayed part.
import type { GameState } from "../types";

/** Total HP still owed by a character's regeneration pools (for previews/AI). */
export function pendingHealing(character: GameState["characters"][number]): number {
  return character.regeneration.reduce((sum, pool) => sum + pool.amount * pool.remainingRounds, 0);
}

/**
 * End-of-round tick: every living character regenerates once per remaining pool
 * (clamped to maxHealth), then each pool's countdown decrements and expires.
 * Returns log events (only when healing actually changed HP or a pool expired).
 */
export function tickRegeneration(state: GameState): string[] {
  const events: string[] = [];
  for (const c of state.characters) {
    if (c.health <= 0) {
      c.regeneration = []; // a KO'd character's pending heals are lost
      continue;
    }
    if (c.regeneration.length === 0) continue;
    const before = c.health;
    for (const pool of c.regeneration) {
      c.health = Math.min(c.maxHealth, c.health + pool.amount);
      pool.remainingRounds -= 1;
    }
    const healed = c.health - before;
    c.regeneration = c.regeneration.filter((pool) => pool.remainingRounds > 0);
    const expired = c.regeneration.length === 0;
    if (healed > 0) {
      events.push(`${c.definitionId} regenerates ${healed}${expired ? "" : " (more to come)"}.`);
    }
  }
  return events;
}
