// Lightweight per-element attack animations.
// A card play is mapped to one visual "kind"; the board renders a short,
// CSS-only effect on every affected tile. Kept data-only so it stays testable
// without a DOM (see attackFx.test.ts).
import type { CardDefinition } from "../game/types";

export type AttackFxKind = "fire" | "water" | "air" | "earth" | "slash";

/** One in-flight effect: which kind, which tiles, and a monotonic id so the
 *  CSS animation restarts even when the same tiles are hit again. */
export interface AttackFx {
  kind: AttackFxKind;
  /** Tile keys (see grid `key`) covered by the effect. */
  tiles: string[];
  seq: number;
}

/**
 * Which attack animation a card should trigger, or null for non-offensive
 * plays (support/defense/gear and anything without damage).
 * Element drives the kind; non-benders (and element-less strikes) slash.
 */
export function attackFxKind(card: CardDefinition): AttackFxKind | null {
  const offensive =
    card.cardType === "attack" || card.effects.some((e) => e.type === "damage");
  if (!offensive) return null;
  switch (card.element) {
    case "fire":
      return "fire";
    case "water":
      return "water";
    case "air":
      return "air";
    case "earth":
      return "earth";
    default:
      return "slash"; // non-bender / element-less strike
  }
}
