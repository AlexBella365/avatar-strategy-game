// Step 1–2 (v2) tests: board geometry, deployment, paths, LOS, AoE shapes.
// Spec v2 §4.1, §4.2, §4.3, §4.5, §10 + test list §17 (battlefield/targeting).
import { describe, expect, it } from "vitest";
import { CHARACTERS } from "../content/characters";
import { createInitialState, occupantAt, type TeamSetup } from "../state";
import type { Position } from "../types";
import {
  GRID_COLS,
  GRID_ROWS,
  hasLineOfSight,
  inBounds,
  isOrthogonalAdjacent,
  key,
  lineTiles,
  manhattan,
  orthogonalNeighbors,
  reachableTiles,
  shapeTiles,
  sortTiles,
} from "./grid";

function setup(positions: [Position[], Position[]]) {
  const teams: [TeamSetup, TeamSetup] = [
    {
      playerId: "p1",
      characterDefs: [CHARACTERS[0], CHARACTERS[1], CHARACTERS[3]],
      positions: positions[0],
    },
    {
      playerId: "p2",
      characterDefs: [CHARACTERS[2], CHARACTERS[4], CHARACTERS[5]],
      positions: positions[1],
    },
  ];
  return createInitialState(teams);
}

const OPEN: [Position[], Position[]] = [
  [
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 5, y: 1 },
  ],
  [
    { x: 1, y: 5 },
    { x: 3, y: 5 },
    { x: 5, y: 5 },
  ],
];

describe("board bounds and deployment", () => {
  it(`board is ${GRID_COLS}×${GRID_ROWS}`, () => {
    expect(GRID_COLS).toBe(7);
    expect(GRID_ROWS).toBe(7);
  });

  it("inBounds accepts edges and rejects outside tiles", () => {
    expect(inBounds({ x: 0, y: 0 })).toBe(true);
    expect(inBounds({ x: 6, y: 6 })).toBe(true);
    expect(inBounds({ x: -1, y: 0 })).toBe(false);
    expect(inBounds({ x: 7, y: 0 })).toBe(false);
    expect(inBounds({ x: 0, y: 7 })).toBe(false);
  });

  it("six characters deploy on distinct tiles in their zones", () => {
    const state = setup(OPEN);
    const tiles = state.characters.map((c) => key(c.position));
    expect(new Set(tiles).size).toBe(6);
  });

  it("rejects overlapping deployment tiles", () => {
    expect(() =>
      setup([
        [
          { x: 1, y: 1 },
          { x: 1, y: 1 },
          { x: 5, y: 1 },
        ],
        OPEN[1],
      ]),
    ).toThrow(/already occupied/);
  });

  it("rejects out-of-zone and out-of-bounds deployment", () => {
    expect(() =>
      setup([
        [
          { x: 1, y: 2 },
          { x: 3, y: 1 },
          { x: 5, y: 1 },
        ],
        OPEN[1],
      ]),
    ).toThrow(/deployment zone/);
    expect(() =>
      setup([OPEN[0], [{ x: 9, y: 9 }, { x: 3, y: 5 }, { x: 5, y: 5 }]]),
    ).toThrow(/outside the 7×7 board/);
  });

  it("rejects second-team deployment outside rows 5-6", () => {
    expect(() =>
      setup([OPEN[0], [{ x: 1, y: 3 }, { x: 3, y: 5 }, { x: 5, y: 5 }]]),
    ).toThrow(/deployment zone/);
  });

  it("knockout removes a character from occupancy immediately", () => {
    const state = setup(OPEN);
    expect(occupantAt(state, { x: 1, y: 1 })?.id).toBe("p1-c0");
    state.characters.find((c) => c.id === "p1-c0")!.health = 0;
    expect(occupantAt(state, { x: 1, y: 1 })).toBeUndefined();
  });
});

describe("distance and adjacency", () => {
  it("Manhattan distance; diagonals are not one step", () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
    expect(isOrthogonalAdjacent({ x: 2, y: 2 }, { x: 3, y: 2 })).toBe(true);
    expect(isOrthogonalAdjacent({ x: 2, y: 2 }, { x: 3, y: 3 })).toBe(false);
    expect(isOrthogonalAdjacent({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(false);
  });

  it("orthogonal neighbors stay in bounds", () => {
    expect(orthogonalNeighbors({ x: 0, y: 0 })).toHaveLength(2);
    expect(orthogonalNeighbors({ x: 3, y: 2 })).toHaveLength(4);
  });
});

describe("line of sight", () => {
  it("clear lines see through; blockers break LOS", () => {
    const a = { x: 0, y: 2 };
    const b = { x: 6, y: 2 };
    expect(hasLineOfSight(a, b, new Set())).toBe(true);
    expect(hasLineOfSight(a, b, new Set(["3,2"]))).toBe(false);
    expect(hasLineOfSight(a, b, new Set(["3,1"]))).toBe(true);
  });

  it("excludes the source tile but not the space between", () => {
    const a = { x: 1, y: 1 };
    const b = { x: 1, y: 3 };
    expect(hasLineOfSight(a, b, new Set(["1,1"]))).toBe(true);
    expect(hasLineOfSight(a, b, new Set(["1,2"]))).toBe(false);
  });

  it("lineTiles is deterministic and endpoint-inclusive", () => {
    const line = lineTiles({ x: 0, y: 0 }, { x: 2, y: 1 });
    expect(line[0]).toEqual({ x: 0, y: 0 });
    expect(line[line.length - 1]).toEqual({ x: 2, y: 1 });
    expect(lineTiles({ x: 0, y: 0 }, { x: 2, y: 1 })).toEqual(line);
  });
});

describe("movement paths", () => {
  const empty = { blocked: new Set<string>(), occupied: new Set<string>(), difficult: new Set<string>() };

  it("allowance 1 from open center reaches Manhattan ≤ 1", () => {
    const reach = reachableTiles({ x: 3, y: 2 }, { ...empty, allowance: 1 });
    expect(reach.size).toBe(4); // 4 orthogonal neighbors
    for (const [k, cost] of reach) {
      const [x, y] = k.split(",").map(Number);
      expect(cost).toBe(manhattan({ x: 3, y: 2 }, { x, y }));
    }
  });

  it("difficult terrain costs 2 to enter", () => {
    const reach = reachableTiles(
      { x: 3, y: 2 },
      { ...empty, allowance: 2, difficult: new Set(["3,1"]) },
    );
    expect(reach.get("3,1")).toBe(2);
    // beyond the difficult tile would cost 3: unreachable
    expect(reach.has("3,0")).toBe(false);
    // ...and with the standard allowance of 1 it cannot be entered at all
    const short = reachableTiles(
      { x: 3, y: 2 },
      { ...empty, allowance: 1, difficult: new Set(["3,1"]) },
    );
    expect(short.has("3,1")).toBe(false);
  });

  it("cannot enter or pass through blocked/occupied tiles", () => {
    const reach = reachableTiles(
      { x: 3, y: 2 },
      {
        ...empty,
        allowance: 3,
        blocked: new Set(["3,1"]),
        occupied: new Set(["4,2"]),
      },
    );
    expect(reach.has("3,1")).toBe(false);
    expect(reach.has("3,0")).toBe(false); // only detour is 4 steps, over allowance
    expect(reach.has("4,2")).toBe(false);
  });

  it("finds a way around blockers within allowance", () => {
    const reach = reachableTiles(
      { x: 0, y: 2 },
      { ...empty, allowance: 4, blocked: new Set(["1,2"]) },
    );
    expect(reach.get("2,2")).toBe(4); // around via row 1 or 3
  });
});

describe("AoE shape tiles", () => {
  it("singleTile is just the origin", () => {
    expect(shapeTiles({ x: 3, y: 2 }, "singleTile")).toEqual([{ x: 3, y: 2 }]);
  });

  it("plus covers origin + orthogonal neighbors, clipped at edges", () => {
    expect(shapeTiles({ x: 3, y: 2 }, "plus")).toHaveLength(5);
    expect(shapeTiles({ x: 0, y: 0 }, "plus")).toEqual(
      sortTiles([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]),
    );
  });

  it("line extends along a direction up to maxLength", () => {
    expect(shapeTiles({ x: 1, y: 2 }, "line", { direction: "east", maxLength: 3 })).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ]);
  });

  it("line stops at board edge and before blockers", () => {
    expect(shapeTiles({ x: 5, y: 2 }, "line", { direction: "east", maxLength: 5 })).toEqual([
      { x: 6, y: 2 },
    ]);
    expect(
      shapeTiles({ x: 1, y: 2 }, "line", {
        direction: "east",
        maxLength: 5,
        blocked: new Set(["3,2"]),
      }),
    ).toEqual([{ x: 2, y: 2 }]);
  });

  it("rectangle spans width×height east/south from origin", () => {
    expect(shapeTiles({ x: 1, y: 1 }, "rectangle", { width: 2, height: 2 })).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]);
  });

  it("radiusManhattan covers the diamond, sorted y,x", () => {
    const tiles = shapeTiles({ x: 3, y: 2 }, "radiusManhattan", { radius: 1 });
    expect(tiles).toHaveLength(5);
    expect(tiles).toEqual(sortTiles(tiles));
    expect(tiles[0]).toEqual({ x: 3, y: 1 });
  });
});
