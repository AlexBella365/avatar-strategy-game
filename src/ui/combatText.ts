// Transient combat feedback: HP deltas shown as floating "-x" (damage) or
// "+y" (healing) next to the receiving character. Pure diff helpers so the
// UI can be driven from any state transition (attacks, hazards, heals).
import type { GameState } from "../game/types";

export type CombatTextKind = "damage" | "heal";

export interface CombatText {
  charId: string;
  amount: number;
  kind: CombatTextKind;
  /** Monotonic id so the CSS animation restarts on repeated hits. */
  seq: number;
}

/**
 * Per-character HP changes between two states. Damage is reported as a
 * positive amount (rendered "-x"), healing likewise (rendered "+y").
 */
export function healthDeltas(
  before: GameState,
  after: GameState,
): Omit<CombatText, "seq">[] {
  const out: Omit<CombatText, "seq">[] = [];
  for (const c of after.characters) {
    const prev = before.characters.find((b) => b.id === c.id);
    if (!prev) continue;
    const delta = c.health - prev.health;
    if (delta < 0) out.push({ charId: c.id, amount: -delta, kind: "damage" });
    else if (delta > 0) out.push({ charId: c.id, amount: delta, kind: "heal" });
  }
  return out;
}
