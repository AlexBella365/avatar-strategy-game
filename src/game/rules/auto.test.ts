// Auto-player test: a full deterministic auto-vs-auto match completes
// without validation errors.
import { describe, expect, it } from "vitest";
import { setup } from "../testutils";
import { chooseAutoAction, evadeEscapes } from "../auto";
import { applyGameAction } from "./cards";
import { drawCards, endRound, pendingActivations } from "./turns";
import { ECONOMY_TUNING } from "../content/economy";
import { getCardDefinition } from "../content/cards";
import { manhattan } from "./grid";
import type { GameState } from "../types";

function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fullAutoMatch(seed: number): GameState {
  const state = setup();
  const random = mulberry(seed);
  drawCards(state, "p1", ECONOMY_TUNING.drawPerRound);
  drawCards(state, "p2", ECONOMY_TUNING.drawPerRound);
  let guard = 0;
  while (state.winnerId === null && !state.isDraw && state.round <= 8 && guard < 2000) {
    guard += 1;
    let acted = false;
    for (const playerId of ["p1", "p2"]) {
      const action = chooseAutoAction(state, playerId, random);
      if (!action) continue;
      const result = applyGameAction(state, action);
      expect(result.errors, `${action.type} should be authorized`).toEqual([]);
      Object.assign(state, result.state);
      acted = true;
    }
    if (pendingActivations(state).length === 0) {
      endRound(state);
    } else if (!acted) {
      throw new Error("auto stalled with pending activations");
    }
  }
  return state;
}

describe("auto-player", () => {
  it("completes a full match with only authorized actions", () => {
    const state = fullAutoMatch(42);
    expect(state.winnerId !== null || state.isDraw || state.round > 8).toBe(true);
    expect(state.log.length).toBeGreaterThan(50);
  });

  it("is deterministic for a fixed seed", () => {
    const a = JSON.stringify(fullAutoMatch(7));
    const b = JSON.stringify(fullAutoMatch(7));
    expect(a).toBe(b);
  });

  it("evadeEscapes spots real dodges", () => {
    const state = setup();
    // katara (3,1) water-whip (range 3) vs sokka at (3,3)
    state.characters.find((c) => c.id === "p2-c1")!.position = { x: 3, y: 3 };
    const card = getCardDefinition("water-whip")!;
    expect(evadeEscapes(state, "p1-c1", card, "p2-c1", { x: 5, y: 3 })).toBe(true); // d=4, out
    expect(evadeEscapes(state, "p1-c1", card, "p2-c1", { x: 3, y: 2 })).toBe(false); // d=1, still hit
  });

  it("advances toward the nearest enemy instead of wandering", () => {
    const state = setup();
    state.players[0].teamHand.push({ id: "es", definitionId: "earth-sweep" });
    const assign = applyGameAction(state, {
      type: "ASSIGN_CARD",
      playerId: "p1",
      characterId: "p1-c0",
      cardInstanceId: "es",
    });
    Object.assign(state, assign.state);
    // aang (1,0), enemies on row 6: any legal move must head south
    const action = chooseAutoAction(state, "p1", () => 0);
    expect(action?.type).toBe("MOVE");
    if (action?.type === "MOVE") {
      const before = manhattan({ x: 1, y: 0 }, { x: 1, y: 6 });
      const after = manhattan(action.to, { x: 1, y: 6 });
      expect(after).toBeLessThan(before);
    }
  });
});
