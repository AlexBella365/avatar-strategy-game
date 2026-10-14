// MVP terrain definitions (data-driven, spec §5.1–§5.2).
import type { TerrainDefinition } from "../types";

export const TERRAIN_DEFINITIONS: TerrainDefinition[] = [
  {
    id: "rock-wall",
    name: "Rock Wall",
    blocking: true,
    difficult: false,
  },
  {
    id: "rubble",
    name: "Rubble",
    blocking: false,
    difficult: true,
  },
  {
    id: "water-source",
    name: "Water Source",
    blocking: false,
    difficult: false,
    elementalSource: "water",
  },
  {
    id: "bonfire",
    name: "Bonfire",
    blocking: false,
    difficult: false,
    hazard: { amount: 1, timing: "onEntry", label: "bonfire" },
  },
  {
    id: "ice",
    name: "Ice",
    blocking: false,
    difficult: true,
    onEntryStatus: { statusId: "OffBalance", duration: 1 },
  },
  {
    id: "ember-field",
    name: "Ember Field",
    blocking: false,
    difficult: false,
    hazard: { amount: 1, timing: "endOfRound", label: "ember-field" },
  },
  {
    id: "cover",
    name: "Cover",
    blocking: false,
    difficult: false,
    cover: { reduction: 1, vs: ["ranged"] },
  },
];

export function getTerrainDefinition(id: string): TerrainDefinition | undefined {
  return TERRAIN_DEFINITIONS.find((d) => d.id === id);
}
