import { describe, expect, it } from "vitest";
import { GRID_COLS, GRID_ROWS } from "./rules/grid";
import { parseTerrainGrid } from "./mapGrid";
import { createTestMapTerrain } from "./state";

const blankGrid = Array.from({ length: GRID_ROWS }, () =>
  Array.from({ length: GRID_COLS }, () => "G").join("|"),
).join("\n");

describe("parseTerrainGrid", () => {
  it("parses a full grid into one terrain per tile", () => {
    const terrain = parseTerrainGrid(blankGrid);
    expect(terrain).toHaveLength(GRID_COLS * GRID_ROWS);
    expect(terrain.every((t) => t.terrainId === "cover")).toBe(true);
  });

  it("maps single letters to engine terrain ids", () => {
    const rows = blankGrid.split("\n");
    rows[0] = "P|K|W|I|B|A|R";
    const top = parseTerrainGrid(rows.join("\n")).filter((t) => t.y === 0);
    expect(top.map((t) => t.terrainId)).toEqual([
      "water-source",
      "rubble",
      "rock-wall",
      "ice",
      "bonfire",
      "ember-field",
      "road",
    ]);
  });

  it("also accepts full names and engine ids", () => {
    const rows = blankGrid.split("\n");
    rows[0] = "pond|rocks|wall|ice|fire|ash|road";
    const top = parseTerrainGrid(rows.join("\n")).filter((t) => t.y === 0);
    expect(top.map((t) => t.terrainId)).toEqual([
      "water-source",
      "rubble",
      "rock-wall",
      "ice",
      "bonfire",
      "ember-field",
      "road",
    ]);
  });

  it("ignores comments and blank lines, and tolerates spaces", () => {
    const raw = `# header\n\n${blankGrid.replace(/\|/g, " | ")}\n# trailing\n`;
    expect(parseTerrainGrid(raw)).toHaveLength(GRID_COLS * GRID_ROWS);
  });

  it("rejects unknown tiles and wrong dimensions", () => {
    expect(() => parseTerrainGrid(blankGrid.replace("G", "Z"))).toThrow(/unknown tile/i);
    expect(() => parseTerrainGrid("G|G")).toThrow(/expected/i);
  });
});

/** True if the road tiles form one connected path spanning opposite edges
 *  (top-to-bottom or left-to-right). */
function roadSpansField(terrain: ReadonlyArray<{ x: number; y: number; terrainId: string }>) {
  const roads = new Set(
    terrain.filter((t) => t.terrainId === "road").map((t) => `${t.x},${t.y}`),
  );
  const flood = (seeds: Array<[number, number]>) => {
    const seen = new Set<string>();
    const queue: Array<[number, number]> = [];
    for (const [x, y] of seeds) {
      seen.add(`${x},${y}`);
      queue.push([x, y]);
    }
    while (queue.length > 0) {
      const [x, y] = queue.shift() as [number, number];
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= GRID_COLS || ny >= GRID_ROWS) continue;
        if (roads.has(k) && !seen.has(k)) {
          seen.add(k);
          queue.push([nx, ny]);
        }
      }
    }
    return seen;
  };
  const seedsTop: Array<[number, number]> = [];
  for (let x = 0; x < GRID_COLS; x++) {
    if (roads.has(`${x},0`)) seedsTop.push([x, 0]);
  }
  if ([...flood(seedsTop)].some((k) => k.endsWith(`,${GRID_ROWS - 1}`))) return true;
  const seedsLeft: Array<[number, number]> = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    if (roads.has(`0,${y}`)) seedsLeft.push([0, y]);
  }
  return [...flood(seedsLeft)].some((k) => k.startsWith(`${GRID_COLS - 1},`));
}

describe("demo map", () => {
  const terrain = createTestMapTerrain();

  it("fills every tile", () => {
    expect(terrain).toHaveLength(GRID_COLS * GRID_ROWS);
  });

  it("never pre-places blaze (it only ignites in play)", () => {
    expect(terrain.some((t) => t.terrainId === "bonfire")).toBe(false);
  });

  it("has a forest patch", () => {
    expect(terrain.some((t) => t.terrainId === "forest")).toBe(true);
  });

  it("has a connected road crossing the field", () => {
    expect(roadSpansField(terrain)).toBe(true);
  });
});
