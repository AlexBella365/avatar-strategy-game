// MVP terrain definitions (data-driven, spec §5.1–§5.2).
import type { TerrainDefinition } from "../types";

export const TERRAIN_DEFINITIONS: TerrainDefinition[] = [
  {
    id: "rock-wall",
    name: "Rock Wall",
    blocking: true, // blocks movement AND sight
    difficult: false,
  },
  {
    id: "rubble",
    name: "Rubble",
    blocking: false,
    difficult: true,
  },
  {
    // Water cannot be walked on (impassable) but does not block sight — a Pond
    // is a water source that water techs feed from across the surface.
    id: "water-source",
    name: "Water Source",
    blocking: false, // see-through; only `impassableToMove` gates movement
    impassableToMove: true,
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
  {
    id: "forest",
    name: "Forest",
    blocking: false,
    difficult: false,
  },
  // New base terrain: roads. Neutral for now; non-bending civilians are
  // planned to appear on roads (later). Roads are never ignited.
  {
    id: "road",
    name: "Road",
    blocking: false,
    difficult: false,
  },
];

export function getTerrainDefinition(id: string): TerrainDefinition | undefined {
  return TERRAIN_DEFINITIONS.find((d) => d.id === id);
}
