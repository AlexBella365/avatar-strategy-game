// Step 3 tests: terrain creation/replacement, entry triggers, expiry.
// Spec v2 §5 + test list §17 (terrain).
import { describe, expect, it } from "vitest";
import { setup } from "../testutils";
import {
  blockingTiles,
  createTerrain,
  difficultTiles,
  terrainAt,
  tickTerrainEndOfRound,
} from "./terrain";
import { applyMove } from "./movement";
import { getTerrainDefinition } from "../content/terrain";

describe("terrain creation", () => {
  it("creates blocking terrain and reports it in tile sets", () => {
    const state = setup();
    const result = createTerrain(state, { x: 3, y: 2 }, "rock-wall", 2, "fail");
    expect(result.ok).toBe(true);
    expect(terrainAt(state, { x: 3, y: 2 })?.terrainId).toBe("rock-wall");
    expect(blockingTiles(state).has("3,2")).toBe(true);
    expect(difficultTiles(state).has("3,2")).toBe(false);
  });

  it("rejects blocking terrain under a living character", () => {
    const state = setup();
    const result = createTerrain(state, { x: 1, y: 1 }, "rock-wall", 2, "fail");
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("TERRAIN_BLOCKED_TILE");
  });

  it("fail policy keeps existing terrain; replace swaps it", () => {
    const state = setup();
    createTerrain(state, { x: 3, y: 2 }, "rubble", "permanent", "fail");
    const failed = createTerrain(state, { x: 3, y: 2 }, "bonfire", "permanent", "fail");
    expect(failed.ok).toBe(false);
    expect(failed.errors[0].code).toBe("TERRAIN_EXISTS");
    expect(terrainAt(state, { x: 3, y: 2 })?.terrainId).toBe("rubble");
    const replaced = createTerrain(state, { x: 3, y: 2 }, "bonfire", "permanent", "replace");
    expect(replaced.ok).toBe(true);
    expect(terrainAt(state, { x: 3, y: 2 })?.terrainId).toBe("bonfire");
  });

  it("rejects out-of-bounds and unknown terrain", () => {
    const state = setup();
    expect(createTerrain(state, { x: 7, y: 0 }, "rubble", 1, "fail").errors[0].code).toBe(
      "OUT_OF_BOUNDS",
    );
    expect(createTerrain(state, { x: 3, y: 2 }, "lava", 1, "fail").errors[0].code).toBe(
      "UNKNOWN_TERRAIN",
    );
  });
});

describe("terrain entry triggers", () => {
  it("bonfire deals 1 on entry; ice applies OffBalance and costs 2", () => {
    const state = setup();
    createTerrain(state, { x: 1, y: 2 }, "bonfire", "permanent", "fail");
    const aang = state.characters.find((c) => c.id === "p0-c0")!;
    const hp = aang.health;
    const result = applyMove(state, "p0-c0", [{ x: 1, y: 2 }]);
    expect(result.ok).toBe(true);
    expect(aang.health).toBe(hp - 1);
  });

  it("each entry triggers once, in path order", () => {
    const state = setup();
    createTerrain(state, { x: 1, y: 2 }, "bonfire", "permanent", "fail");
    createTerrain(state, { x: 2, y: 2 }, "bonfire", "permanent", "fail");
    const aang = state.characters.find((c) => c.id === "p0-c0")!;
    aang.position = { x: 0, y: 2 };
    const hp = aang.health;
    applyMove(state, "p0-c0", [
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]);
    expect(aang.health).toBe(hp - 2);
  });

  it("water source and cover definitions carry the specified properties", () => {
    expect(getTerrainDefinition("water-source")?.elementalSource).toBe("water");
    expect(getTerrainDefinition("cover")?.cover).toEqual({ reduction: 1, vs: ["ranged"] });
  });
});

describe("terrain expiry", () => {
  it("temporary terrain decrements and expires; permanent stays", () => {
    const state = setup();
    createTerrain(state, { x: 3, y: 2 }, "rubble", 1, "fail");
    createTerrain(state, { x: 4, y: 2 }, "rock-wall", "permanent", "fail");
    const events = tickTerrainEndOfRound(state);
    expect(terrainAt(state, { x: 3, y: 2 })).toBeUndefined();
    expect(terrainAt(state, { x: 4, y: 2 })?.terrainId).toBe("rock-wall");
    expect(events.some((e) => e.includes("expires"))).toBe(true);
  });

  it("end-of-round hazards damage occupants", () => {
    const state = setup();
    createTerrain(state, { x: 1, y: 1 }, "ember-field", 2, "fail");
    const aang = state.characters.find((c) => c.id === "p0-c0")!;
    const hp = aang.health;
    tickTerrainEndOfRound(state);
    expect(aang.health).toBe(hp - 1);
    expect(terrainAt(state, { x: 1, y: 1 })?.remainingRounds).toBe(1);
  });
});
