import { CHARACTERS } from "../game/content/characters";

/** Bending colors: yellow=air, red=fire, green=earth, blue=water, grey=nonbender. */
export const ELEMENT_COLORS: Record<string, string> = {
  air: "#d9a406",
  fire: "#d62728",
  earth: "#2a9d48",
  water: "#1e78ff",
  nonbender: "#6b7280",
  avatar: "#d9a406", // Aang reads as Air (roster base class)
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
