// Basic actions: the cardless fallback — one weak strike or a small shield.
// Spec v2 §8 Phase 3 (one action per activation) + user rule clarification.
import { describe, expect, it } from "vitest";
import { setup } from "../testutils";
import { applyGameAction } from "./cards";
import { endRound } from "./turns";
import { getCardDefinition } from "../content/cards";
import type { ActionResult, GameState } from "../types";

/** applyGameAction mutates a clone; copy the result back (e2e-test pattern). */
function act(state: GameState, action: Parameters<typeof applyGameAction>[1]): ActionResult {
  const result = applyGameAction(state, action);
  Object.assign(state, result.state);
  return result;
}

/** Setup with aang (p1-c0) adjacent to toph (p2-c0) at mid-board. */
function closePair(): GameState {
  const state = setup();
  state.characters.find((c) => c.id === "p1-c0")!.position = { x: 3, y: 3 };
  state.characters.find((c) => c.id === "p2-c0")!.position = { x: 3, y: 4 };
  return state;
}

function playAirBlast(state: GameState, instanceId: string): ActionResult {
  return act(state, {
    type: "PLAY_CARD",
    playerId: "p1",
    characterId: "p1-c0",
    cardInstanceId: instanceId,
    selection: { kind: "character", characterId: "p2-c0" },
    card: getCardDefinition("air-blast")!,
    reactions: [],
  });
}

describe("basic attack (cardless fallback)", () => {
  it("strikes an adjacent enemy for 1 and spends the activation's action", () => {
    const state = closePair();
    const before = state.characters.find((c) => c.id === "p2-c0")!.health;
    const result = act(state, {
      type: "BASIC_ATTACK",
      playerId: "p1",
      characterId: "p1-c0",
      targetCharacterId: "p2-c0",
    });
    expect(result.errors).toEqual([]);
    expect(state.characters.find((c) => c.id === "p2-c0")!.health).toBe(before - 1);
    expect(state.characters.find((c) => c.id === "p1-c0")!.techniqueBlockedThisActivation).toBe(true);
    expect(result.events.some((e) => e.includes("basic attack"))).toBe(true);
  });

  it("needs an orthogonally adjacent enemy", () => {
    const state = closePair();
    const before = state.characters.find((c) => c.id === "p2-c0")!.health;
    const result = act(state, {
      type: "BASIC_ATTACK",
      playerId: "p1",
      characterId: "p1-c0",
      targetCharacterId: "p2-c1", // sokka two rows away — out of melee reach
    });
    expect(result.errors.map((e) => e.code)).toEqual(["OUT_OF_RANGE"]);
    expect(state.characters.find((c) => c.id === "p2-c0")!.health).toBe(before);
  });

  it("cannot hit allies", () => {
    const state = closePair();
    state.characters.find((c) => c.id === "p1-c1")!.position = { x: 3, y: 2 }; // katara adjacent
    const result = act(state, {
      type: "BASIC_ATTACK",
      playerId: "p1",
      characterId: "p1-c0",
      targetCharacterId: "p1-c1",
    });
    expect(result.errors.map((e) => e.code)).toEqual(["NOT_AN_ENEMY"]);
  });

  it("is unavailable while a card is assigned (play the card instead)", () => {
    const state = closePair();
    const player = state.players.find((p) => p.id === "p1")!;
    player.assignments["p1-c0"] = { id: "a1", definitionId: "air-blast" };
    const before = state.characters.find((c) => c.id === "p2-c0")!.health;
    const result = act(state, {
      type: "BASIC_ATTACK",
      playerId: "p1",
      characterId: "p1-c0",
      targetCharacterId: "p2-c0",
    });
    expect(result.errors.map((e) => e.code)).toEqual(["CARD_ASSIGNED"]);
    expect(state.characters.find((c) => c.id === "p2-c0")!.health).toBe(before);
  });
});

describe("basic defense (cardless fallback)", () => {
  it("braces for shield 1 until next round, once per activation", () => {
    const state = closePair();
    const result = act(state, {
      type: "BASIC_DEFENSE",
      playerId: "p1",
      characterId: "p1-c0",
    });
    expect(result.errors).toEqual([]);
    expect(state.characters.find((c) => c.id === "p1-c0")!.shields).toEqual([
      { id: expect.any(String), amount: 1, duration: "untilNextRound" },
    ]);
    // Second basic action this activation is spent.
    const again = act(state, {
      type: "BASIC_ATTACK",
      playerId: "p1",
      characterId: "p1-c0",
      targetCharacterId: "p2-c0",
    });
    expect(again.errors.map((e) => e.code)).toEqual(["ACTIVATION_SPENT"]);
  });

  it("expires the brace at end of round", () => {
    const state = closePair();
    act(state, { type: "BASIC_DEFENSE", playerId: "p1", characterId: "p1-c0" });
    endRound(state);
    expect(state.characters.find((c) => c.id === "p1-c0")!.shields).toEqual([]);
  });
});

describe("one card per activation", () => {
  it("blocks a second card play after the first commits", () => {
    const state = closePair();
    const player = state.players.find((p) => p.id === "p1")!;
    player.assignments["p1-c0"] = { id: "a1", definitionId: "air-blast" };
    const first = playAirBlast(state, "a1");
    expect(first.errors).toEqual([]);
    // Re-assign and try to play again in the same activation: spent.
    player.assignments["p1-c0"] = { id: "a2", definitionId: "air-blast" };
    const second = playAirBlast(state, "a2");
    expect(second.errors.map((e) => e.code)).toEqual(["TECHNIQUE_SPENT"]);
  });

  it("blocks basic actions after playing a card", () => {
    const state = closePair();
    const player = state.players.find((p) => p.id === "p1")!;
    player.assignments["p1-c0"] = { id: "a1", definitionId: "air-blast" };
    expect(playAirBlast(state, "a1").errors).toEqual([]);
    const basic = act(state, {
      type: "BASIC_ATTACK",
      playerId: "p1",
      characterId: "p1-c0",
      targetCharacterId: "p2-c0",
    });
    expect(basic.errors.map((e) => e.code)).toEqual(["ACTIVATION_SPENT"]);
  });
});
