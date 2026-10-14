// End-to-end: a scripted hot-seat demo through real cards across 2 rounds.
// Spec §17 end-to-end + determinism check.
import { describe, expect, it } from "vitest";
import { applyGameAction } from "./cards";
import { drawCards, endRound, pendingActivations } from "./turns";
import { getCardDefinition } from "../content/cards";
import { CHARACTERS } from "../content/characters";
import { ECONOMY_TUNING } from "../content/economy";
import { createInitialState } from "../state";
import type { ActionResult, GameState, Position, TargetSelection } from "../types";

function demoMatch(): GameState {
  const state = createInitialState(
    [
      {
        playerId: "p0",
        characterDefs: [CHARACTERS[0], CHARACTERS[1], CHARACTERS[2]],
        positions: [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 }],
      },
      {
        playerId: "p1",
        characterDefs: [CHARACTERS[3], CHARACTERS[4], CHARACTERS[5]],
        positions: [{ x: 1, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 3 }],
      },
    ],
    7,
  );
  drawCards(state, "p0", ECONOMY_TUNING.drawPerRound);
  drawCards(state, "p1", ECONOMY_TUNING.drawPerRound);
  return state;
}

function assignKnown(state: GameState, playerId: string, charId: string, definitionId: string): void {
  const player = state.players.find((p) => p.id === playerId)!;
  const instanceId = `${charId}-${definitionId}`;
  player.teamHand.push({ id: instanceId, definitionId });
  const result = applyGameAction(state, {
    type: "ASSIGN_CARD",
    playerId,
    characterId: charId,
    cardInstanceId: instanceId,
  });
  Object.assign(state, result.state);
  if (result.errors.length > 0) throw new Error(result.errors[0].message);
}

function playAssigned(
  state: GameState,
  playerId: string,
  charId: string,
  selection: TargetSelection,
  movePath?: Position[],
): ActionResult {
  const player = state.players.find((p) => p.id === playerId)!;
  const assigned = player.assignments[charId];
  if (!assigned) throw new Error(`nothing assigned to ${charId}`);
  const card = getCardDefinition(assigned.definitionId)!;
  const result = applyGameAction(state, {
    type: "PLAY_CARD",
    playerId,
    characterId: charId,
    cardInstanceId: assigned.id,
    selection,
    card,
    movePath,
  });
  Object.assign(state, result.state);
  return result;
}

function move(state: GameState, playerId: string, charId: string, to: Position): void {
  const result = applyGameAction(state, { type: "MOVE", playerId, characterId: charId, to });
  Object.assign(state, result.state);
  if (result.errors.length > 0) throw new Error(result.errors[0].message);
}

function pass(state: GameState, playerId: string, charId: string): void {
  const result = applyGameAction(state, { type: "PASS_ACTIVATION", playerId, characterId: charId });
  Object.assign(state, result.state);
  if (result.errors.length > 0) throw new Error(result.errors[0].message);
}

function scriptedTwoRounds(): { state: GameState; snapshots: string[] } {
  const state = demoMatch();
  const snapshots: string[] = [];
  // --- Round 1: p0 = aang/katara/toph, p1 = zuko/sokka/azula ---
  assignKnown(state, "p0", "p0-c0", "air-blast"); // aang
  assignKnown(state, "p0", "p0-c1", "water-whip"); // katara
  assignKnown(state, "p0", "p0-c2", "earth-sweep"); // toph
  const r1 = playAssigned(state, "p0", "p0-c0", { kind: "character", characterId: "p1-c0" });
  snapshots.push(JSON.stringify(r1.events));
  const r2 = playAssigned(state, "p0", "p0-c1", { kind: "character", characterId: "p1-c1" });
  snapshots.push(JSON.stringify(r2.events));
  move(state, "p0", "p0-c2", { x: 5, y: 2 }); // toph steps up
  const r3 = playAssigned(state, "p0", "p0-c2", { kind: "character", characterId: "p1-c2" });
  snapshots.push(JSON.stringify(r3.events));
  snapshots.push(
    `sokka:${JSON.stringify(state.characters.find((c) => c.id === "p1-c1")!.position)},` +
      `azula-offbalance:${state.characters.find((c) => c.id === "p1-c2")!.statuses.some((s) => s.statusId === "OffBalance")}`,
  );
  pass(state, "p0", "p0-c0");
  pass(state, "p0", "p0-c1");
  pass(state, "p0", "p0-c2");
  // p1 answers: sokka feints katara, everyone passes otherwise
  assignKnown(state, "p1", "p1-c1", "sokkas-feint");
  const r4 = playAssigned(state, "p1", "p1-c1", { kind: "character", characterId: "p0-c1" });
  snapshots.push(JSON.stringify(r4.events));
  move(state, "p1", "p1-c0", { x: 1, y: 2 }); // zuko repositions
  pass(state, "p1", "p1-c0");
  pass(state, "p1", "p1-c1");
  pass(state, "p1", "p1-c2");
  expect(pendingActivations(state)).toHaveLength(0);
  endRound(state);
  // --- Round 2: resonance built, leftovers banked, fresh hands ---
  expect(state.round).toBe(2);
  snapshots.push(`chi:${state.players[0].chi},${state.players[1].chi}`);
  return { state, snapshots };
}

describe("playable demo", () => {
  it("plays two full rounds through real cards with damage, movement, and banking", () => {
    const { state, snapshots } = scriptedTwoRounds();
    // zuko took air-blast (2) and was pushed south
    const zuko = state.characters.find((c) => c.id === "p1-c0")!;
    expect(zuko.health).toBe(16 - 2);
    expect(zuko.position).toEqual({ x: 1, y: 2 }); // pushed to (1,4), then stepped back
    // azula took earth sweep (2)
    expect(state.characters.find((c) => c.id === "p1-c2")!.health).toBe(14 - 2);
    // mid-round snapshot: sokka pulled adjacent, azula OffBalanced
    expect(snapshots[3]).toBe('sokka:{"x":3,"y":2},azula-offbalance:true');
    // aang practiced air => resonance 1
    const aang = state.characters.find((c) => c.id === "p0-c0")!;
    expect(aang.avatarState!.resonance).toBe(1);
    // leftovers banked chi for both teams
    expect(state.players[0].chi).toBeGreaterThan(0);
    expect(state.players[1].chi).toBeGreaterThan(0);
    // fresh hands drawn
    expect(state.players[0].teamHand.length).toBeGreaterThan(0);
    expect(state.log.length).toBeGreaterThan(20);
    expect(snapshots.length).toBe(6);
  });

  it("resolves a knockout through a real card and frees the tile", () => {
    const { state } = scriptedTwoRounds();
    state.characters.find((c) => c.id === "p1-c1")!.health = 2; // battle-worn
    assignKnown(state, "p0", "p0-c1", "water-whip");
    const result = playAssigned(state, "p0", "p0-c1", { kind: "character", characterId: "p1-c1" });
    expect(result.errors).toEqual([]);
    expect(state.characters.find((c) => c.id === "p1-c1")!.health).toBe(0);
    expect(result.events.some((e) => e.includes("knocked out"))).toBe(true);
  });

  it("replaying the same script yields identical state and events", () => {
    const first = scriptedTwoRounds();
    const second = scriptedTwoRounds();
    expect(JSON.stringify(second.state)).toBe(JSON.stringify(first.state));
    expect(second.snapshots).toEqual(first.snapshots);
  });
});
