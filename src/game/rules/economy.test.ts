// v0.3 tests: chi bank, assign/scrap, restrictions, slots, gear, decks.
// Amendment §§Turn structure/Card data/Balance config + §Engine/tests required.
import { describe, expect, it } from "vitest";
import { setup } from "../testutils";
import { applyGameAction } from "./cards";
import { drawCards, endRound } from "./turns";
import { movementAllowance } from "./movement";
import { CARD_DEFINITIONS, getCardDefinition, validateCardDefinitions } from "../content/cards";
import { CHARACTERS } from "../content/characters";
import { CARD_ECONOMY, ECONOMY_TUNING, STARTER_DECK_IDS, restrictionSatisfied } from "../content/economy";
import type { CardDefinition, GameState } from "../types";

function realCard(id: string): CardDefinition {
  const card = getCardDefinition(id);
  if (!card) throw new Error(`missing card ${id}`);
  return card;
}

function draw(state: GameState, playerId = "p1"): void {
  for (const event of drawCards(state, playerId, ECONOMY_TUNING.drawPerRound)) {
    void event;
  }
}

function assign(state: GameState, playerId: string, charId: string, instanceId: string) {
  return applyGameAction(state, { type: "ASSIGN_CARD", playerId, characterId: charId, cardInstanceId: instanceId });
}

function handIds(state: GameState, playerId = "p1"): string[] {
  return state.players.find((p) => p.id === playerId)!.teamHand.map((c) => c.id);
}

describe("starter content validation", () => {
  it("all cards have complete data and economy entries; deck matches", () => {
    expect(validateCardDefinitions()).toEqual([]);
    expect(new Set(Object.keys(CARD_ECONOMY))).toEqual(new Set(Object.keys(CARD_DEFINITIONS)));
    for (const id of STARTER_DECK_IDS) {
      expect(getCardDefinition(id), id).toBeDefined();
    }
  });

  it("universal cards fit everyone; each hero has options", () => {
    const team = CHARACTERS.map((d) => ({
      definitionId: d.id,
      element: d.element,
      role: d.role,
    }));
    for (const id of ["travel-rations", "smoke-bomb", "dust-toss"]) {
      const card = getCardDefinition(id)!;
      expect(card.economy?.restrictions).toEqual([]);
      for (const char of team) {
        expect(
          (card.economy?.restrictions ?? []).every((r) => restrictionSatisfied(char, r)),
          `${id} should fit ${char.definitionId}`,
        ).toBe(true);
      }
    }
    // everyone (incl. nonbender sokka) has at least 3 playable cards
    for (const char of team) {
      const playable = Object.values(CARD_DEFINITIONS).filter((card) =>
        (card.economy?.restrictions ?? []).every((r) => restrictionSatisfied(char, r)),
      );
      expect(playable.length, char.definitionId).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("restrictions", () => {
  it("unique/element/alignment gates, banking always legal", () => {
    const aang = { definitionId: "aang", element: "avatar", role: "hero" };
    const sokka = { definitionId: "sokka", element: "nonbender", role: "hero" };
    const zuko = { definitionId: "zuko", element: "fire", role: "villain" };
    expect(restrictionSatisfied(aang, { type: "unique", characterId: "aang" })).toBe(true);
    expect(restrictionSatisfied(sokka, { type: "unique", characterId: "aang" })).toBe(false);
    expect(restrictionSatisfied(aang, { type: "element", elements: ["water", "avatar"] })).toBe(true);
    expect(restrictionSatisfied(zuko, { type: "element", elements: ["water", "avatar"] })).toBe(false);
    expect(restrictionSatisfied(aang, { type: "alignment", alignment: "hero" })).toBe(true);
    expect(restrictionSatisfied(zuko, { type: "alignment", alignment: "hero" })).toBe(false);
    expect(
      restrictionSatisfied({ definitionId: "x", element: "air", role: "neutral" }, { type: "alignment", alignment: "hero" }),
    ).toBe(false);
  });

  it("assign rejects misfitted cards", () => {
    const state = setup();
    draw(state);
    // force a glider into hand and try to assign it to katara (unique aang)
    const player = state.players[0];
    player.teamHand.push({ id: "g1", definitionId: "aang-glider" });
    const result = assign(state, "p1", "p1-c1", "g1");
    expect(result.errors[0].code).toBe("RESTRICTION_MISMATCH");
    expect(result.state.players[0].teamHand.some((c) => c.id === "g1")).toBe(true);
  });
});

describe("draw, assign, scrap, bank", () => {
  it("draws 5 deterministically; same seed, same order", () => {
    const a = setup();
    const b = setup();
    draw(a);
    draw(b);
    expect(handIds(a)).toHaveLength(5);
    expect(handIds(a)).toEqual(handIds(b));
    expect(a.players[0].deck).toHaveLength(STARTER_DECK_IDS.length - 5);
  });

  it("play-or-scrap reveal: scrap banks chi secretly, play spends chi", () => {
    const state = setup();
    state.players[0].teamHand.push({ id: "ab", definitionId: "air-blast" }); // fits aang
    const r1 = assign(state, "p1", "p1-c0", "ab");
    expect(r1.errors).toEqual([]);
    const chiBefore = r1.state.players[0].chi;
    const scrap = applyGameAction(r1.state, { type: "SCRAP_ASSIGNED", playerId: "p1", characterId: "p1-c0" });
    expect(scrap.errors).toEqual([]);
    expect(scrap.state.players[0].chi - chiBefore).toBe(CARD_ECONOMY["air-blast"].value);
    expect(scrap.events.join().toLowerCase()).not.toContain("air blast");
  });

  it("chi costs are paid after Energy/Focus; bank never goes negative", () => {
    // rising-flame is fire-only: assign itself rejects aang (checked at assign)
    const s0 = setup();
    s0.players[0].teamHand.push({ id: "rf", definitionId: "rising-flame" });
    expect(assign(s0, "p1", "p1-c0", "rf").errors[0].code).toBe("RESTRICTION_MISMATCH");
    // ...while zuko fits but starts with an empty bank
    const s2 = setup();
    s2.players[0].teamHand.push({ id: "rf", definitionId: "rising-flame" });
    s2.characters.find((c) => c.id === "p2-c2")!.position = { x: 5, y: 4 }; // in range after the move
    const assigned = assign(s2, "p1", "p1-c2", "rf");
    expect(assigned.errors).toEqual([]);
    // close in: zuko (5,0) -> (5,1), azula (5,4) now in range 3
    const moved = applyGameAction(assigned.state, {
      type: "MOVE",
      playerId: "p1",
      characterId: "p1-c2",
      to: { x: 5, y: 1 },
    });
    expect(moved.errors).toEqual([]);
    const noChi = applyGameAction(moved.state, {
      type: "PLAY_CARD",
      playerId: "p1",
      characterId: "p1-c2",
      cardInstanceId: "rf",
      selection: { kind: "character", characterId: "p2-c2" },
      card: realCard("rising-flame"),
    });
    expect(noChi.errors[0].code).toBe("INSUFFICIENT_CHI");
    expect(noChi.state.players[0].chi).toBe(0);
  });

  it("pass auto-scraps the assignment; endRound auto-banks leftovers", () => {
    const state = setup();
    draw(state);
    state.players[0].teamHand.push({ id: "ab", definitionId: "air-blast" }); // fits aang
    const assigned = assign(state, "p1", "p1-c0", "ab");
    expect(assigned.errors).toEqual([]);
    const chiBefore = assigned.state.players[0].chi;
    const passed = applyGameAction(assigned.state, { type: "PASS_ACTIVATION", playerId: "p1", characterId: "p1-c0" });
    expect(passed.errors).toEqual([]);
    expect(passed.state.players[0].chi).toBeGreaterThan(chiBefore);
    expect(passed.state.players[0].assignments["p1-c0"]).toBeNull();
    // endRound banks remaining team hand, then draws the next round's hand
    const leftovers = passed.state.players[0].teamHand.length;
    const chiMid = passed.state.players[0].chi;
    endRound(passed.state);
    if (leftovers > 0) expect(passed.state.players[0].chi).toBeGreaterThan(chiMid);
    expect(passed.state.players[0].teamHand.length).toBeGreaterThan(0);
  });
});

describe("gear slots and bonuses", () => {
  function gliderPlay(state: GameState) {
    state.players[0].teamHand.push({ id: "g", definitionId: "aang-glider" });
    state.players[0].chi = 5;
    const assigned = assign(state, "p1", "p1-c0", "g");
    expect(assigned.errors).toEqual([]);
    return applyGameAction(assigned.state, {
      type: "PLAY_CARD",
      playerId: "p1",
      characterId: "p1-c0",
      cardInstanceId: "g",
      selection: { kind: "automatic" },
      card: realCard("aang-glider"),
    });
  }

  it("gear equips, persists across rounds, and grants +1 movement", () => {
    const state = setup();
    const result = gliderPlay(state);
    expect(result.errors).toEqual([]);
    const aang = result.state.characters.find((c) => c.id === "p1-c0")!;
    expect(aang.equippedGear).toHaveLength(1);
    // movement allowance 1 + 1 glider
    expect(movementAllowance(result.state, "p1-c0")).toBe(2);
    endRound(result.state);
    expect(
      result.state.characters.find((c) => c.id === "p1-c0")!.equippedGear,
    ).toHaveLength(1);
  });

  it("gear cap enforces replacement; replaced bonus drops immediately", () => {
    const state = setup();
    state.players[0].chi = 9;
    // equip two glider copies via direct setup (cap is 2)
    const aang = state.characters.find((c) => c.id === "p1-c0")!;
    aang.equippedGear.push(
      { id: "g1", definitionId: "aang-glider" },
      { id: "g2", definitionId: "aang-glider" },
    );
    state.players[0].teamHand.push({ id: "g3", definitionId: "aang-glider" });
    const assigned = assign(state, "p1", "p1-c0", "g3");
    expect(assigned.errors).toEqual([]);
    const full = applyGameAction(assigned.state, {
      type: "PLAY_CARD",
      playerId: "p1",
      characterId: "p1-c0",
      cardInstanceId: "g3",
      selection: { kind: "automatic" },
      card: realCard("aang-glider"),
    });
    expect(full.errors[0].code).toBe("SLOT_FULL");
    const replaced = applyGameAction(assigned.state, {
      type: "PLAY_CARD",
      playerId: "p1",
      characterId: "p1-c0",
      cardInstanceId: "g3",
      selection: { kind: "automatic" },
      card: realCard("aang-glider"),
      replaceGearInstanceId: "g1",
    });
    expect(replaced.errors).toEqual([]);
    const gear = replaced.state.characters.find((c) => c.id === "p1-c0")!.equippedGear;
    expect(gear.map((g) => g.id).sort()).toEqual(["g2", "g3"]);
    expect(replaced.events.some((e) => e.includes("bonus lost"))).toBe(true);
  });
});
