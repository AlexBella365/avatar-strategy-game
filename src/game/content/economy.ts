// v0.3 economy: single source of truth for card/chi/slot numbers.
// Tune here, never in engine code. Amendment: ECONOMIC_TUNING + CARD_ECONOMY
// for the 12 starter cards + 2 signature gear (+ Comet Strike reference).
import type { Restriction } from "../types";

export const ECONOMY_TUNING = {
  drawPerRound: 5,
  slotsTotal: 4,
  gearCap: 2,
  attackCap: 2,
  defenseCap: 2,
  energyPerRound: 4,
  chiValueMin: 1,
  chiValueMax: 3,
} as const;

/** Named crews used by companion-card affinity restrictions. */
export const CARD_TEAMS: Record<string, string[]> = {
  "team-avatar": ["aang", "katara", "sokka", "toph"],
};

export interface CardEconomyEntry {
  value: number; // chi gained when banked/scrapped (1..3)
  chiCost: number; // chi spent to Play (0..6)
  energy: number;
  restrictions: Restriction[];
  slotType: "gear" | "attack" | "defense";
}

/** Demo deck: card definition ids in fixed order (shuffled deterministically). */
export const STARTER_DECK_IDS: string[] = [
  "earth-sweep",
  "earth-sweep",
  "air-blast",
  "air-blast",
  "water-whip",
  "water-whip",
  "water-recovery",
  "sokkas-feint",
  "seismic-read",
  "rising-flame",
  "ice-bind",
  "earth-wall",
  "precision-strike",
  "air-shield",
  "fire-sweep",
  "aang-glider",
  "sokka-boomerang",
  "water-shoes",
  "rocket-flight",
  "appa-lift",
  "momo-scout",
  "comet-strike",
  "travel-rations",
  "travel-rations",
  "smoke-bomb",
  "dust-toss",
  "air-cocoon",
  "earth-smash",
  "seismic-snare",
  "octopus-intercept",
  "miraculous-balm",
  "healing-waters",
  "second-wind",
];

/** chi value / chi cost / energy / restrictions / slot per card. */
export const CARD_ECONOMY: Record<string, CardEconomyEntry> = {
  "earth-sweep": { value: 1, chiCost: 0, energy: 1, restrictions: [{ type: "element", elements: ["earth", "avatar"] }], slotType: "attack" },
  "air-blast": { value: 1, chiCost: 0, energy: 1, restrictions: [{ type: "element", elements: ["air", "avatar"] }], slotType: "attack" },
  "rising-flame": { value: 2, chiCost: 1, energy: 2, restrictions: [{ type: "element", elements: ["fire"] }], slotType: "attack" },
  "water-whip": { value: 1, chiCost: 0, energy: 1, restrictions: [{ type: "element", elements: ["water", "avatar"] }], slotType: "attack" },
  "air-shield": { value: 1, chiCost: 1, energy: 1, restrictions: [{ type: "element", elements: ["air", "avatar"] }], slotType: "defense" },
  "earth-wall": { value: 2, chiCost: 1, energy: 1, restrictions: [{ type: "element", elements: ["earth", "avatar"] }], slotType: "defense" },
  "fire-sweep": { value: 2, chiCost: 2, energy: 2, restrictions: [{ type: "element", elements: ["fire"] }], slotType: "attack" },
  "ice-bind": { value: 2, chiCost: 1, energy: 1, restrictions: [{ type: "element", elements: ["water"] }], slotType: "attack" },
  "sokkas-feint": { value: 1, chiCost: 0, energy: 1, restrictions: [{ type: "unique", characterId: "sokka" }], slotType: "attack" },
  "precision-strike": { value: 2, chiCost: 1, energy: 1, restrictions: [{ type: "element", elements: ["nonbender"] }], slotType: "attack" },
  "water-recovery": { value: 1, chiCost: 0, energy: 1, restrictions: [{ type: "element", elements: ["water", "avatar"] }], slotType: "defense" },
  "seismic-read": { value: 1, chiCost: 0, energy: 1, restrictions: [{ type: "element", elements: ["earth"] }], slotType: "attack" },
  "aang-glider": { value: 2, chiCost: 1, energy: 1, restrictions: [{ type: "unique", characterId: "aang" }], slotType: "gear" },
  "sokka-boomerang": { value: 2, chiCost: 1, energy: 1, restrictions: [{ type: "unique", characterId: "sokka" }], slotType: "gear" },
  "water-shoes": { value: 2, chiCost: 1, energy: 1, restrictions: [{ type: "element", elements: ["water", "avatar"] }], slotType: "gear" },
  "rocket-flight": { value: 2, chiCost: 3, energy: 2, restrictions: [{ type: "element", elements: ["fire"] }], slotType: "defense" },
  "appa-lift": { value: 2, chiCost: 2, energy: 2, restrictions: [{ type: "unique", characterId: "aang" }], slotType: "defense" },
  "momo-scout": { value: 2, chiCost: 2, energy: 1, restrictions: [{ type: "team", teamId: "team-avatar" }], slotType: "attack" },
  "comet-strike": { value: 3, chiCost: 3, energy: 2, restrictions: [{ type: "element", elements: ["fire"] }], slotType: "attack" },
  "travel-rations": { value: 1, chiCost: 0, energy: 1, restrictions: [], slotType: "defense" },
  "smoke-bomb": { value: 1, chiCost: 0, energy: 1, restrictions: [], slotType: "defense" },
  "dust-toss": { value: 1, chiCost: 0, energy: 1, restrictions: [], slotType: "attack" },
  // Prototype values expose the mechanic in the demo; these cards are not balanced.
  "air-cocoon": { value: 1, chiCost: 0, energy: 1, restrictions: [{ type: "element", elements: ["air", "avatar"] }], slotType: "defense" },
  "earth-smash": { value: 1, chiCost: 0, energy: 1, restrictions: [{ type: "element", elements: ["earth", "avatar"] }], slotType: "defense" },
  "seismic-snare": { value: 1, chiCost: 0, energy: 1, restrictions: [{ type: "element", elements: ["earth", "avatar"] }], slotType: "defense" },
  "octopus-intercept": { value: 1, chiCost: 0, energy: 1, restrictions: [{ type: "element", elements: ["water", "avatar"] }], slotType: "defense" },
  // Spike heals: instant (not delayed), so they cost more — chi gates them so
  // they stay rare against the weak end-of-round regeneration baseline.
  "miraculous-balm": { value: 2, chiCost: 2, energy: 2, restrictions: [], slotType: "defense" },
  "healing-waters": { value: 2, chiCost: 1, energy: 1, restrictions: [{ type: "element", elements: ["water", "avatar"] }], slotType: "defense" },
  "second-wind": { value: 1, chiCost: 0, energy: 1, restrictions: [], slotType: "defense" },
};

/** Restriction gate for assign AND play (banking is always legal). */
export function restrictionSatisfied(
  character: { definitionId: string; element: string; role?: string },
  restriction: Restriction,
): boolean {
  switch (restriction.type) {
    case "unique":
      return character.definitionId === restriction.characterId;
    case "element":
      return restriction.elements.includes(character.element);
    case "alignment":
      // hero/villain map from roster role; antihero/neutral match nothing.
      return character.role === restriction.alignment;
    case "team":
      return CARD_TEAMS[restriction.teamId]?.includes(character.definitionId) ?? false;
  }
}
