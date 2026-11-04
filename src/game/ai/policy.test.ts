// Track A policy scenarios (specs/npc_ai_plan.md §2.A.8). Property-based:
// each test asserts a *behavior*, not a golden action, so the scorer can be
// tuned without rewriting tests.
import { describe, expect, it } from "vitest";
import { chooseAutoAction, chooseAutoActionTraced } from "../auto";
import { getCardDefinition } from "../content/cards";
import { applyGameAction } from "../rules/cards";
import { drawCards, endRound, pendingActivations } from "../rules/turns";
import { manhattan } from "../rules/grid";
import { ECONOMY_TUNING } from "../content/economy";
import { setup } from "../testutils";
import type { CharacterState, GameState } from "../types";
import { resolveWeights } from "./personalities";
import { scorePlay } from "./scoring";
import { chooseAiAction } from "./policy";
import { clearDecisions, recentDecisions } from "./traceLog";

function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function byId(state: GameState, id: string): CharacterState {
  return state.characters.find((c) => c.id === id)!;
}

/** Assign a card instance directly (bypassing the draw randomness). */
function assign(state: GameState, playerIdx: number, characterId: string, definitionId: string) {
  state.players[playerIdx].assignments[characterId] = {
    id: `${characterId}-${definitionId}`,
    definitionId,
  };
}

function fullPolicyMatch(seed: number): GameState {
  const state = setup();
  const random = mulberry(seed);
  drawCards(state, "p1", ECONOMY_TUNING.drawPerRound);
  drawCards(state, "p2", ECONOMY_TUNING.drawPerRound);
  let guard = 0;
  while (state.winnerId === null && !state.isDraw && state.round <= state.maxRounds && guard < 2000) {
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
    if (pendingActivations(state).length === 0) endRound(state);
    else if (!acted) throw new Error("policy stalled with pending activations");
  }
  return state;
}

describe("Track A policy", () => {
  it("is deterministic for a fixed seed", () => {
    const a = JSON.stringify(fullPolicyMatch(11));
    const b = JSON.stringify(fullPolicyMatch(11));
    expect(a).toBe(b);
  });

  it("completes matches across seeds and lands knockouts", () => {
    let knockouts = 0;
    for (const seed of [1, 2, 3, 5, 8, 13]) {
      const state = fullPolicyMatch(seed);
      expect(state.winnerId !== null || state.isDraw || state.round > state.maxRounds).toBe(true);
      knockouts += state.characters.filter((c) => c.health <= 0).length;
    }
    expect(knockouts).toBeGreaterThan(0);
  });

  it("advances toward the nearest enemy instead of wandering", () => {
    const state = setup();
    assign(state, 0, "p1-c0", "earth-sweep");
    const action = chooseAutoAction(state, "p1", () => 0);
    expect(action?.type).toBe("MOVE");
    if (action?.type === "MOVE") {
      const before = manhattan({ x: 1, y: 0 }, { x: 1, y: 6 });
      expect(manhattan(action.to, { x: 1, y: 6 })).toBeLessThan(before);
    }
  });

  it("focus-fires the most-wounded enemy", () => {
    const state = setup();
    // aang at (3,3) with air-blast (range 3) assigned; enemies adjacent.
    const aang = byId(state, "p1-c0");
    aang.position = { x: 3, y: 3 };
    aang.movementSpent = 1; // isolate the technique choice (no move phase)
    assign(state, 0, "p1-c0", "air-blast");
    const wounded = byId(state, "p2-c0");
    wounded.position = { x: 3, y: 4 };
    wounded.health = 1;
    byId(state, "p2-c1").position = { x: 4, y: 3 };

    const { action } = chooseAiAction(state, "p1", { personality: "aggressive", random: () => 0 });
    expect(action?.type).toBe("PLAY_CARD");
    if (action?.type === "PLAY_CARD") {
      expect(action.selection).toEqual({ kind: "character", characterId: wounded.id });
    }
  });

  it("prefers an affordable damage card over a defensive one when aggressive", () => {
    const state = setup();
    const aang = byId(state, "p1-c0");
    aang.position = { x: 3, y: 3 };
    aang.movementSpent = 1;
    byId(state, "p2-c0").position = { x: 3, y: 5 };
    state.players[0].teamHand.push({ id: "ab", definitionId: "air-blast" });
    state.players[0].teamHand.push({ id: "as", definitionId: "air-shield" });

    const { action } = chooseAiAction(state, "p1", { personality: "aggressive", random: () => 0 });
    expect(action?.type).toBe("ASSIGN_CARD");
    if (action?.type === "ASSIGN_CARD") expect(action.cardInstanceId).toBe("ab");
  });

  it("activates Avatar State when healthy but holds it when near death", () => {
    const ready = setup();
    const aang = byId(ready, "p1-c0");
    aang.avatarState!.resonance = 6;
    aang.focus = 2;
    const healthy = chooseAiAction(ready, "p1", { random: () => 0 });
    expect(healthy.action?.type).toBe("ACTIVATE_AVATAR_STATE");

    const hurt = setup();
    const wounded = byId(hurt, "p1-c0");
    wounded.avatarState!.resonance = 6;
    wounded.focus = 2;
    wounded.health = 3;
    byId(hurt, "p2-c0").position = { x: 2, y: 2 };
    byId(hurt, "p2-c1").position = { x: 4, y: 2 };
    byId(hurt, "p2-c2").position = { x: 3, y: 2 };
    const cautious = chooseAiAction(hurt, "p1", { personality: "cautious", random: () => 0 });
    expect(cautious.action?.type).not.toBe("ACTIVATE_AVATAR_STATE");
  });

  it("makes damage weight actually reach play scoring", () => {
    const state = setup();
    const aang = byId(state, "p1-c0");
    aang.position = { x: 3, y: 3 };
    byId(state, "p2-c0").position = { x: 3, y: 4 };
    assign(state, 0, "p1-c0", "air-blast");
    const card = getCardDefinition("air-blast")!;
    const selection = { kind: "character" as const, characterId: "p2-c0" };
    const mellow = scorePlay(state, aang.id, card, "p1-c0-air-blast", selection, resolveWeights(undefined, "cautious"));
    const fierce = scorePlay(state, aang.id, card, "p1-c0-air-blast", selection, resolveWeights(undefined, "berserker"));
    expect(mellow).not.toBeNull();
    expect(fierce).not.toBeNull();
    expect(fierce!.score).toBeGreaterThan(mellow!.score);
    expect(fierce!.components.damage).toBeGreaterThan(mellow!.components.damage);
  });

  it("reports a trace with a phase, chosen label, and component scores", () => {
    const state = setup();
    assign(state, 0, "p1-c0", "earth-sweep");
    clearDecisions();
    const { trace } = chooseAutoActionTraced(state, "p1", () => 0);
    expect(trace).not.toBeNull();
    expect(trace!.characterId).toBe("p1-c0");
    expect(["avatar", "move", "play", "assign", "pass", "scrap"]).toContain(trace!.phase);
    expect(trace!.chosen.length).toBeGreaterThan(0);
    expect(Object.keys(trace!.components).length).toBeGreaterThan(0);
    expect(recentDecisions().length).toBe(1);
  });
});
