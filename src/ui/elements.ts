import { CHARACTERS } from "../game/content/characters";

/** Bending colors (CSS vars from theme.css): grey=air, red=fire, green=earth,
 *  blue=water, purple=nonbender. */
export const ELEMENT_COLORS: Record<string, string> = {
  air: "var(--element-air)",
  fire: "var(--element-fire)",
  earth: "var(--element-earth)",
  water: "var(--element-water)",
  nonbender: "var(--element-nonbender)",
  avatar: "var(--element-avatar)", // Aang reads as Air (roster base class)
};

export function bendingOf(definitionId: string): string {
  const element = CHARACTERS.find((d) => d.id === definitionId)?.element;
  if (!element) return "nonbender";
  if (element === "avatar") return "avatar";
  return element;
}

export function bendingColor(definitionId: string): string {
  return ELEMENT_COLORS[bendingOf(definitionId)] ?? ELEMENT_COLORS.nonbender;
}

export function bendingLabel(definitionId: string): string {
  const bending = bendingOf(definitionId);
  if (bending === "avatar") return "Avatar";
  if (bending === "nonbender") return "Non-bender";
  return bending[0].toUpperCase() + bending.slice(1);
}
