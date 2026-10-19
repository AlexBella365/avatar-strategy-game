// Step 3 tests: voluntary movement, Evade, forced movement, swap.
// Spec v2 §4.4, §4.7, §4A + test list §17.
import { describe, expect, it } from "vitest";
import { setup } from "../testutils";
import {
  applyEvade,
  applyMove,
  canEvade,
  getEvadeDestinations,
  movementAllowance,
  resolveForcedMove,
  resolveSwap,
  validateMove,
} from "./movement";
import { createTerrain } from "./terrain";
import { applyStatus } from "./statuses";

const AANG = "p1-c0"; // (1,1)

describe("voluntary movement", () => {
  it("moves one tile and spends the allowance", () => {
    const state = setup();
    const result = applyMove(state, AANG, [{ x: 1, y: 2 }]);
    expect(result.ok).toBe(true);
    expect(state.characters.find((c) => c.id === AANG)!.position).toEqual({ x: 1, y: 2 });
    expect(state.characters.find((c) => c.id === AANG)!.movementSpent).toBe(1);
    // a second step exceeds the 1-tile allowance
    const again = applyMove(state, AANG, [{ x: 2, y: 2 }]);
    expect(again.ok).toBe(false);
    expect(again.errors[0].code).toBe("INSUFFICIENT_MOVEMENT");
  });

  it("difficult terrain costs 2; over-allowance fails without mutation", () => {
    const state = setup();
    createTerrain(state, { x: 1, y: 2 }, "rubble", "permanent", "fail");
    const before = JSON.stringify(state.characters);
    // rubble (2) > allowance 1
    const result = applyMove(state, AANG, [{ x: 1, y: 2 }]);
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("INSUFFICIENT_MOVEMENT");
    expect(JSON.stringify(state.characters)).toBe(before);
  });

  it("cannot pass through or end on occupied tiles", () => {
    const state = setup();
    // (3,1) holds katara (p1-c1)
    const through = validateMove(state, AANG, [
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ]);
    expect(through.ok).toBe(false);
    expect(through.errors[0].code).toBe("TILE_OCCUPIED");
    const endOn = validateMove(state, AANG, [{ x: 2, y: 1 }, { x: 3, y: 1 }]);
    expect(endOn.ok).toBe(false);
    expect(endOn.errors[0].code).toBe("TILE_OCCUPIED");
  });

  it("cannot enter blocking terrain or leave the board", () => {
    const state = setup();
    createTerrain(state, { x: 1, y: 2 }, "rock-wall", "permanent", "fail");
    expect(validateMove(state, AANG, [{ x: 1, y: 2 }]).errors[0].code).toBe("TILE_BLOCKED");
    expect(validateMove(state, "p1-c1", [{ x: 3, y: 0 }, { x: 3, y: -1 }]).errors[0].code).toBe(
      "OUT_OF_BOUNDS",
    );
  });

  it("cannot walk onto or through water", () => {
    const state = setup();
    createTerrain(state, { x: 1, y: 2 }, "water-source", "permanent", "fail");
    // onto the pond
    expect(validateMove(state, AANG, [{ x: 1, y: 2 }]).errors[0].code).toBe("TILE_BLOCKED");
    // straight through a pond in the middle of the path
    const state2 = setup();
    createTerrain(state2, { x: 2, y: 1 }, "water-source", "permanent", "fail");
    // Aang's Glider gives +1 movement so the path can extend past a pond.
    state2.characters.find((c) => c.id === AANG)!.equippedGear.push({
      id: "glider-test",
      definitionId: "aang-glider",
    });
    expect(
      validateMove(state2, AANG, [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ]).errors[0].code,
    ).toBe("TILE_BLOCKED");
  });

  it("cannot walk onto or through rock walls", () => {
    const state = setup();
    createTerrain(state, { x: 2, y: 1 }, "rock-wall", "permanent", "fail");
    expect(validateMove(state, AANG, [{ x: 2, y: 1 }]).errors[0].code).toBe("TILE_BLOCKED");
    // Aang's Glider gives +1 movement for the 2-tile path.
    state.characters.find((c) => c.id === AANG)!.equippedGear.push({
      id: "glider-test",
      definitionId: "aang-glider",
    });
    expect(
      validateMove(state, AANG, [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ]).errors[0].code,
    ).toBe("TILE_BLOCKED");
  });

  it("rejects non-orthogonal paths and Bound characters", () => {
    const state = setup();
    expect(validateMove(state, AANG, [{ x: 2, y: 2 }]).errors[0].code).toBe("INVALID_PATH");
    applyStatus(state, AANG, "Bound", 2);
    expect(validateMove(state, AANG, [{ x: 1, y: 2 }]).errors[0].code).toBe("CHARACTER_BOUND");
  });

  it("equipped Gear grants +1 tile of movement", () => {
    const state = setup();
    expect(movementAllowance(state, AANG)).toBe(1);
    state.characters.find((c) => c.id === AANG)!.equippedGear.push({
      id: "glider-test",
      definitionId: "aang-glider",
    });
    expect(movementAllowance(state, AANG)).toBe(2);
  });

  it("can move into a tile freed by knockout", () => {
    const state = setup();
    state.characters.find((c) => c.id === "p1-c1")!.health = 0; // katara (3,1) KO'd
    state.characters.find((c) => c.id === AANG)!.position = { x: 2, y: 1 };
    const result = applyMove(state, AANG, [{ x: 3, y: 1 }]);
    expect(result.ok).toBe(true);
  });
});

describe("Evade reaction", () => {
  it("lists only legal neighboring tiles", () => {
    const state = setup();
    createTerrain(state, { x: 1, y: 2 }, "rock-wall", "permanent", "fail");
    const dests = getEvadeDestinations(state, AANG);
    // neighbors of (1,1): (0,1),(2,1),(1,0),(1,2-blocked)
    expect(dests).toHaveLength(3);
  });

  it("spends 1 Focus, marks reaction used, moves", () => {
    const state = setup();
    const result = applyEvade(state, AANG, { x: 2, y: 1 }, true);
    expect(result.ok).toBe(true);
    const aang = state.characters.find((c) => c.id === AANG)!;
    expect(aang.focus).toBe(0);
    expect(aang.reactionUsedThisRound).toBe(true);
    expect(aang.position).toEqual({ x: 2, y: 1 });
  });

  it("enforces once-per-round, Focus, Bound, and unavoidability", () => {
    const state = setup();
    expect(canEvade(state, AANG, false).errors[0].code).toBe("CANNOT_BE_EVADED");
    applyEvade(state, AANG, { x: 2, y: 1 }, true);
    expect(canEvade(state, AANG, true).errors[0].code).toBe("REACTION_USED");
    const fresh = setup();
    fresh.characters.find((c) => c.id === AANG)!.focus = 0;
    expect(canEvade(fresh, AANG, true).errors[0].code).toBe("INSUFFICIENT_FOCUS");
    applyStatus(fresh, AANG, "Bound", 2);
    fresh.characters.find((c) => c.id === AANG)!.focus = 1;
    expect(canEvade(fresh, AANG, true).errors[0].code).toBe("CHARACTER_BOUND");
  });

  it("entry hazards trigger on the evade destination", () => {
    const state = setup();
    const aang = state.characters.find((c) => c.id === AANG)!;
    aang.health = 1;
    createTerrain(state, { x: 2, y: 1 }, "bonfire", "permanent", "fail");
    const result = applyEvade(state, AANG, { x: 2, y: 1 }, true);
    expect(result.ok).toBe(true);
    expect(aang.health).toBe(0); // bonfire KO'd the evader; resolution stops upstream
  });
});

describe("forced movement", () => {
  it("pushes along a direction and stops before occupied tiles", () => {
    const state = setup();
    const result = resolveForcedMove(state, "p2-c0", "north", 5); // toph (1,5)
    expect(result.moved).toBe(3); // (1,4),(1,3),(1,2), then aang holds (1,1)
    expect(result.stopped).toBe("occupied");
    expect(state.characters.find((c) => c.id === "p2-c0")!.position).toEqual({ x: 1, y: 2 });
  });

  it("stops before blocking terrain and occupied tiles", () => {
    const state = setup();
    createTerrain(state, { x: 3, y: 2 }, "rock-wall", "permanent", "fail");
    const result = resolveForcedMove(state, "p2-c1", "north", 3); // sokka (3,5)
    expect(result.moved).toBe(2); // (3,4),(3,3), then the wall at (3,2)
    expect(result.stopped).toBe("blocking");
  });

  it("OffBalance adds one step and is consumed", () => {
    const state = setup();
    const aang = state.characters.find((c) => c.id === AANG)!;
    aang.position = { x: 0, y: 2 }; // empty neutral row
    applyStatus(state, AANG, "OffBalance", 1);
    const result = resolveForcedMove(state, AANG, "east", 1);
    expect(result.moved).toBe(2);
    expect(aang.position).toEqual({ x: 2, y: 2 });
    expect(aang.statuses).toHaveLength(0);
  });

  it("tracks displacement in the round event log", () => {
    const state = setup();
    resolveForcedMove(state, "p2-c2", "west", 1);
    expect(state.roundEventLog).toContain("displaced:p2-c2");
  });

  it("swap exchanges tiles and rejects knocked-out characters", () => {
    const state = setup();
    const result = resolveSwap(state, AANG, "p2-c0");
    expect(result.ok).toBe(true);
    expect(state.characters.find((c) => c.id === AANG)!.position).toEqual({ x: 1, y: 5 });
    expect(state.characters.find((c) => c.id === "p2-c0")!.position).toEqual({ x: 1, y: 1 });
    state.characters.find((c) => c.id === "p2-c0")!.health = 0;
    expect(resolveSwap(state, AANG, "p2-c0").ok).toBe(false);
  });
});
