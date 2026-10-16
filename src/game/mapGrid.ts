// Human-editable map loading. The demo board lives in maps/demo.grid.txt as a
// plain 7x7 grid of single-letter tiles split by "|"; this turns it into
// engine TerrainState[].
import { GRID_COLS, GRID_ROWS } from "./rules/grid";
import type { TerrainState } from "./types";

/** Single letters used in the map file -> engine terrain id. */
export const TERRAIN_LETTERS: Record<string, string> = {
  G: "cover", // grass / plains
  R: "road",
  P: "water-source", // pond / water
  K: "rubble", // rocks
  F: "forest",
  W: "rock-wall", // wall
  I: "ice",
  B: "bonfire", // blaze / fire
  A: "ember-field", // ash / embers
};

/** Full names and raw engine ids are also accepted (readability / compatibility). */
export const TERRAIN_ALIASES: Record<string, string> = {
  grass: "cover",
  plains: "cover",
  cover: "cover",
  road: "road",
  pond: "water-source",
  water: "water-source",
  "water-source": "water-source",
  rocks: "rubble",
  rubble: "rubble",
  forest: "forest",
  wall: "rock-wall",
  "rock-wall": "rock-wall",
  ice: "ice",
  blaze: "bonfire",
  fire: "bonfire",
  bonfire: "bonfire",
  ash: "ember-field",
  embers: "ember-field",
  "ember-field": "ember-field",
};

/** Resolve a grid token (single letter, friendly name, or engine id). */
function resolveTile(token: string): string | undefined {
  return TERRAIN_LETTERS[token.toUpperCase()] ?? TERRAIN_ALIASES[token.toLowerCase()];
}

/** Parse a "|"-separated grid of tile tokens into terrain instances. */
export function parseTerrainGrid(raw: string): TerrainState[] {
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter((line) => line.length > 0)
    .map((line) =>
      line
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0),
    );

  if (rows.length !== GRID_ROWS) {
    throw new Error(`Map grid: expected ${GRID_ROWS} rows, got ${rows.length}.`);
  }

  const valid = [...Object.keys(TERRAIN_LETTERS), ...Object.keys(TERRAIN_ALIASES)].join(", ");
  const terrain: TerrainState[] = [];
  rows.forEach((cells, y) => {
    if (cells.length !== GRID_COLS) {
      throw new Error(`Map grid: row ${y} has ${cells.length} tiles (expected ${GRID_COLS}).`);
    }
    cells.forEach((token, x) => {
      const terrainId = resolveTile(token);
      if (!terrainId) {
        throw new Error(`Map grid: unknown tile "${token}" at (${x},${y}). Valid: ${valid}.`);
      }
      terrain.push({ id: `map-${y * GRID_COLS + x}`, x, y, terrainId, remainingRounds: null });
    });
  });
  return terrain;
}
