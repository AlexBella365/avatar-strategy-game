// Auto-player test: a full deterministic auto-vs-auto match completes
// without validation errors.
import { describe, expect, it } from "vitest";
import { setup } from "../testutils";
import { chooseAutoAction } from "../auto";
import { applyGameAction } from "./cards";
import { drawCards, endRound, pendingActivations } from "./turns";
import { ECONOMY_TUNING } from "../content/economy";
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
});
