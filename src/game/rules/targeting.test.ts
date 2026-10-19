// Step 4 tests: grid targeting legality, shapes, previews.
// Spec v2 §4.5, §10 + test list §17 (targeting).
import { describe, expect, it } from "vitest";
import { setup } from "../testutils";
import type { CardDefinition, Targeting } from "../types";
import { createTerrain } from "./terrain";
import {
  getAffectedCharacters,
  getLegalTargets,
  resolveTiles,
  validateTarget,
} from "./targeting";

function mkCard(targeting: Targeting, overrides: Partial<CardDefinition> = {}): CardDefinition {
  return {
    id: "test-card",
    name: "Test Card",
    cardType: "attack",
    energyCost: 1,
    focusCost: 0,
    targeting,
    tags: [],
    effects: [],
    rulesText: "",
    ...overrides,
  };
}

const focused = (range: number | "melee" | "any" = 3) =>
  mkCard({ kind: "character", allegiance: "enemies", range });

const AANG = "p1-c0"; // (1,1)
const TOPH = "p2-c0"; // (1,5)
const SOKKA = "p2-c1"; // (3,5)
const ZUKO = "p1-c2"; // (5,1)

describe("focused character targeting", () => {
  it("affects exactly one legal target", () => {
    const state = setup();
    expect(
      getAffectedCharacters(state, AANG, focused(5), { kind: "character", characterId: TOPH }),
    ).toEqual([TOPH]);
  });

  it("melee needs Manhattan distance 1", () => {
    const state = setup();
    state.characters.find((c) => c.id === AANG)!.position = { x: 3, y: 4 };
    const card = focused("melee");
    const sokka = getLegalTargets(state, AANG, card).find((o) => o.primaryCharacterId === SOKKA)!;
    expect(sokka.isLegal).toBe(true);
    const toph = getLegalTargets(state, AANG, card).find((o) => o.primaryCharacterId === TOPH)!;
    expect(toph.isLegal).toBe(false);
    expect(toph.illegalReason?.code).toBe("OUT_OF_RANGE");
  });

  it("ranged attacks need line of sight by default, unless opted out", () => {
    const state = setup();
    createTerrain(state, { x: 1, y: 2 }, "rock-wall", "permanent", "fail");
    const blocked = getLegalTargets(state, AANG, focused(6)).find(
      (o) => o.primaryCharacterId === TOPH,
    )!;
    expect(blocked.isLegal).toBe(false);
    expect(blocked.illegalReason?.code).toBe("NO_LINE_OF_SIGHT");
    // ...but the diagonal to sokka stays open
    const open = getLegalTargets(state, AANG, focused(6)).find(
      (o) => o.primaryCharacterId === SOKKA,
    )!;
    expect(open.isLegal).toBe(true);
    const ignores = mkCard(
      { kind: "character", allegiance: "enemies", range: 5, requiresLineOfSight: false },
    );
    expect(
      getLegalTargets(state, AANG, ignores).find((o) => o.primaryCharacterId === TOPH)!.isLegal,
    ).toBe(true);
  });

  it("water does not block line of sight (unlike a wall)", () => {
    const state = setup();
    // Aang (1,1) -> Toph (1,5): the pond at (1,2) sits on the line but is
    // see-through, so the ranged attack stays legal.
    createTerrain(state, { x: 1, y: 2 }, "water-source", "permanent", "fail");
    const toph = getLegalTargets(state, AANG, focused(6)).find(
      (o) => o.primaryCharacterId === TOPH,
    )!;
    expect(toph.isLegal).toBe(true);
  });

  it("rejects wrong allegiance and knocked-out targets", () => {
    const state = setup();
    const ally = validateTarget(state, AANG, focused(), { kind: "character", characterId: "p1-c1" });
    expect(ally.errors[0].code).toBe("WRONG_ALLEGIANCE");
    state.characters.find((c) => c.id === TOPH)!.health = 0;
    expect(
      getLegalTargets(state, AANG, focused()).some((o) => o.primaryCharacterId === TOPH),
    ).toBe(false);
  });
});

describe("tile targeting", () => {
  const tileCard = (allowsOccupiedTile: boolean) =>
    mkCard({ kind: "tile", range: 5, allowsOccupiedTile });

  it("resolves at the tile and hits occupants", () => {
    const state = setup();
    expect(
      getAffectedCharacters(state, AANG, tileCard(true), { kind: "tile", pos: { x: 1, y: 5 } }),
    ).toEqual([TOPH]);
    expect(
      getAffectedCharacters(state, AANG, tileCard(true), { kind: "tile", pos: { x: 2, y: 2 } }),
    ).toEqual([]);
  });

  it("enforces occupancy, blocking, and range rules", () => {
    const state = setup();
    createTerrain(state, { x: 2, y: 2 }, "rock-wall", "permanent", "fail");
    const occupied = validateTarget(state, AANG, tileCard(false), {
      kind: "tile",
      pos: { x: 1, y: 5 },
    });
    expect(occupied.errors[0].code).toBe("TILE_OCCUPIED");
    const blocked = validateTarget(state, AANG, tileCard(true), {
      kind: "tile",
      pos: { x: 2, y: 2 },
    });
    expect(blocked.errors[0].code).toBe("TILE_BLOCKED");
    const far = validateTarget(state, AANG, tileCard(true), {
      kind: "tile",
      pos: { x: 6, y: 4 },
    });
    expect(far.errors[0].code).toBe("OUT_OF_RANGE");
  });
});

describe("direction and area targeting", () => {
  it("direction attacks run a line from the source", () => {
    const state = setup();
    const card = mkCard({ kind: "direction", maxLength: 4, directions: ["north", "south"] });
    const tiles = resolveTiles(state, ZUKO, card, { kind: "direction", direction: "south" });
    // stable y,x order
    expect(tiles).toEqual([
      { x: 5, y: 2 },
      { x: 5, y: 3 },
      { x: 5, y: 4 },
      { x: 5, y: 5 },
    ]);
    expect(getAffectedCharacters(state, ZUKO, card, { kind: "direction", direction: "south" })).toEqual([
      "p2-c2",
    ]);
    const disallowed = validateTarget(state, ZUKO, card, { kind: "direction", direction: "east" });
    expect(disallowed.errors[0].code).toBe("TARGET_MISMATCH");
  });

  it("line stops before blockers unless includeBlocker is set", () => {
    const state = setup();
    state.characters.find((c) => c.id === AANG)!.position = { x: 0, y: 2 };
    createTerrain(state, { x: 2, y: 2 }, "rock-wall", "permanent", "fail");
    const stop = mkCard({ kind: "direction", maxLength: 4, directions: ["east"] });
    expect(resolveTiles(state, AANG, stop, { kind: "direction", direction: "east" })).toEqual([
      { x: 1, y: 2 },
    ]);
    const through = mkCard({ kind: "direction", maxLength: 4, directions: ["east"], includeBlocker: true });
    expect(resolveTiles(state, AANG, through, { kind: "direction", direction: "east" })).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]);
  });

  it("a line runs across water (water is not a sight blocker)", () => {
    const state = setup();
    state.characters.find((c) => c.id === AANG)!.position = { x: 0, y: 2 };
    createTerrain(state, { x: 1, y: 2 }, "water-source", "permanent", "fail");
    const card = mkCard({ kind: "direction", maxLength: 4, directions: ["east"] });
    expect(resolveTiles(state, AANG, card, { kind: "direction", direction: "east" })).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ]);
  });

  it("plus AoE hits the origin tile and orthogonal neighbors", () => {
    const state = setup();
    const card = mkCard({
      kind: "area",
      shape: "plus",
      allegiance: "enemies",
      maxRange: 5,
    });
    expect(
      getAffectedCharacters(state, AANG, card, { kind: "tile", pos: { x: 1, y: 5 } }),
    ).toEqual([TOPH]);
    const far = validateTarget(state, AANG, card, { kind: "tile", pos: { x: 1, y: 5 } });
    expect(far.ok).toBe(true); // distance (1,1)->(1,5) = 4 ≤ 5
    const tooFar = validateTarget(state, AANG, card, { kind: "tile", pos: { x: 5, y: 5 } });
    expect(tooFar.errors[0].code).toBe("OUT_OF_RANGE");
  });

  it("allEnemies and sourceAndAdjacent need no selection", () => {
    const state = setup();
    const all = mkCard({ kind: "area", shape: "allEnemies", allegiance: "enemies" });
    expect(getAffectedCharacters(state, AANG, all, { kind: "automatic" })).toEqual([
      TOPH,
      SOKKA,
      "p2-c2",
    ]);
    const guard = mkCard({ kind: "area", shape: "sourceAndAdjacent", allegiance: "allies" });
    expect(getAffectedCharacters(state, AANG, guard, { kind: "automatic" })).toEqual([AANG]);
  });

  it("radiusManhattan returns exactly the expected tiles", () => {
    const state = setup();
    const card = mkCard({
      kind: "area",
      shape: "radiusManhattan",
      allegiance: "enemies",
      radius: 1,
    });
    const tiles = resolveTiles(state, AANG, card, { kind: "tile", pos: { x: 3, y: 5 } });
    expect(tiles).toEqual([
      { x: 3, y: 4 },
      { x: 2, y: 5 },
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 6 },
    ]);
    expect(getAffectedCharacters(state, AANG, card, { kind: "tile", pos: { x: 3, y: 5 } })).toEqual([
      SOKKA,
    ]);
  });
});

describe("preview-resolution consistency", () => {
  it("every option preview equals the shared resolution functions", () => {
    const state = setup();
    const cards = [
      focused(3),
      mkCard({ kind: "tile", range: 2, allowsOccupiedTile: true }),
      mkCard({ kind: "direction", maxLength: 2, directions: ["north", "east", "south", "west"] }),
      mkCard({ kind: "area", shape: "plus", allegiance: "enemies", maxRange: 3 }),
      mkCard({ kind: "area", shape: "allEnemies", allegiance: "enemies" }),
      mkCard({ kind: "self" }, { cardType: "support" }),
    ];
    for (const card of cards) {
      for (const option of getLegalTargets(state, AANG, card)) {
        expect(option.affectedTiles).toEqual(
          resolveTiles(state, AANG, card, option.selection),
        );
        expect(option.affectedCharacterIds).toEqual(
          getAffectedCharacters(state, AANG, card, option.selection),
        );
        expect(validateTarget(state, AANG, card, option.selection).ok).toBe(option.isLegal);
      }
    }
  });

  it("a target is never affected twice by one resolution", () => {
    const state = setup();
    const card = mkCard({ kind: "area", shape: "plus", allegiance: "all", maxRange: 5 });
    const affected = getAffectedCharacters(state, AANG, card, { kind: "tile", pos: { x: 1, y: 1 } });
    expect(new Set(affected).size).toBe(affected.length);
  });
});
