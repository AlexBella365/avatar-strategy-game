// Heal-over-time tests: delayed healing ticks at round end, expires, clamps to
// maxHealth, and clears on KO. Guards the "healing is slower and weaker than
// damage" balance intent (Water Recovery / Travel Rations carry half their
// value as a delayed pool).
import { describe, expect, it } from "vitest";
import { setup } from "../testutils";
import { applyGameAction } from "./cards";
import { dealDamage } from "./damage";
import { endRound } from "./turns";
import { CARD_DEFINITIONS } from "../content/cards";
import type { CardDefinition, GameState, TargetSelection } from "../types";

function mkCard(
  effects: CardDefinition["effects"],
  overrides: Partial<CardDefinition> = {},
): CardDefinition {
  return {
    id: "test-heal",
    name: "Test Heal",
    cardType: "support",
    energyCost: 1,
    focusCost: 0,
    targeting: { kind: "character", allegiance: "allies", range: 3 },
    tags: [],
    effects,
    rulesText: "",
    ...overrides,
  };
}

function play(
  state: GameState,
  card: CardDefinition,
  selection: TargetSelection,
  char = "p1-c1",
): GameState {
  state.players.find((p) => p.id === "p1")!.assignments[char] = {
    id: "inst-heal",
    definitionId: card.id,
  };
  const result = applyGameAction(state, {
    type: "PLAY_CARD",
    playerId: "p1",
    characterId: char,
    cardInstanceId: "inst-heal",
    selection,
    card,
    reactions: [],
  });
  expect(result.errors).toEqual([]);
  return result.state;
}

const char = (state: GameState, id: string) => state.characters.find((c) => c.id === id)!;

describe("heal over time", () => {
  it("applies the immediate portion now and schedules the rest", () => {
    const state = setup();
    char(state, "p1-c2").health = 8;
    const next = play(
      state,
      mkCard([
        { type: "heal", amount: 1 },
        { type: "healOverTime", amount: 2, rounds: 2 },
      ]),
      { kind: "character", characterId: "p1-c2" },
    );
    const zuko = char(next, "p1-c2");
    expect(zuko.health).toBe(9); // only the instant point landed
    expect(zuko.regeneration).toHaveLength(1);
    expect(zuko.regeneration[0]).toMatchObject({ amount: 2, remainingRounds: 2 });
  });

  it("ticks at round end and expires after its rounds", () => {
    const state = setup();
    char(state, "p1-c2").health = 8;
    let next = play(
      state,
      mkCard([{ type: "healOverTime", amount: 1, rounds: 2 }]),
      { kind: "character", characterId: "p1-c2" },
    );
    expect(char(next, "p1-c2").health).toBe(8); // nothing immediate

    endRound(next);
    expect(char(next, "p1-c2").health).toBe(9);
    expect(char(next, "p1-c2").regeneration[0].remainingRounds).toBe(1);

    endRound(next);
    expect(char(next, "p1-c2").health).toBe(10);
    expect(char(next, "p1-c2").regeneration).toHaveLength(0);

    endRound(next);
    expect(char(next, "p1-c2").health).toBe(10); // no further healing
  });

  it("clamps regeneration to maxHealth", () => {
    const state = setup();
    const zuko = char(state, "p1-c2");
    zuko.health = zuko.maxHealth - 1;
    const next = play(
      state,
      mkCard([{ type: "healOverTime", amount: 5, rounds: 1 }]),
      { kind: "character", characterId: "p1-c2" },
    );
    endRound(next);
    expect(char(next, "p1-c2").health).toBe(zuko.maxHealth);
  });

  it("clears pending regeneration when a character is knocked out", () => {
    const state = setup();
    const next = play(
      state,
      mkCard([{ type: "healOverTime", amount: 2, rounds: 2 }]),
      { kind: "character", characterId: "p1-c2" },
    );
    expect(char(next, "p1-c2").regeneration).toHaveLength(1);
    dealDamage(next, "p1-c2", 999, "test");
    endRound(next);
    expect(char(next, "p1-c2").regeneration).toHaveLength(0);
  });
});

describe("heal cards are slower and weaker than damage", () => {
  it("Water Recovery splits its reduced total into instant + delayed", () => {
    const effects = CARD_DEFINITIONS["water-recovery"].effects;
    const instant = effects.find((e) => e.type === "heal");
    const overTime = effects.find((e) => e.type === "healOverTime");
    expect(instant).toMatchObject({ type: "heal", amount: 1 });
    expect(overTime).toMatchObject({ type: "healOverTime", amount: 1, rounds: 1 });
    const total = 1 + 1; // was 3 at once
    expect(total).toBeLessThan(3);
  });

  it("Travel Rations is split too", () => {
    const effects = CARD_DEFINITIONS["travel-rations"].effects;
    expect(effects.some((e) => e.type === "healOverTime")).toBe(true);
  });
});

describe("instant spike heals", () => {
  it("Miraculous Balm heals an adjacent ally 4 immediately", () => {
    const state = setup();
    char(state, "p1-c1").health = 8;
    char(state, "p1-c1").position = { x: 2, y: 0 }; // adjacent to p1-c0 at (1,0)
    state.players.find((p) => p.id === "p1")!.chi = 5;
    const next = play(
      state,
      CARD_DEFINITIONS["miraculous-balm"],
      { kind: "character", characterId: "p1-c1" },
      "p1-c0",
    );
    const healed = char(next, "p1-c1");
    expect(healed.health).toBe(12);
    expect(healed.regeneration).toHaveLength(0); // instant, no delayed pool
  });

  it("Healing Waters heals 3 instantly and is water-locked", () => {
    const state = setup();
    char(state, "p1-c1").health = 8;
    state.players.find((p) => p.id === "p1")!.chi = 5;
    const next = play(
      state,
      CARD_DEFINITIONS["healing-waters"],
      { kind: "character", characterId: "p1-c1" },
      "p1-c0", // Aang (avatar) fits the water restriction
    );
    expect(char(next, "p1-c1").health).toBe(11);
    expect(char(next, "p1-c1").regeneration).toHaveLength(0);
    expect(CARD_DEFINITIONS["healing-waters"].economy?.restrictions).toEqual([
      { type: "element", elements: ["water", "avatar"] },
    ]);
  });

  it("Second Wind heals self 2 and grants 1 Focus", () => {
    const state = setup();
    char(state, "p1-c2").health = 8;
    const next = play(
      state,
      CARD_DEFINITIONS["second-wind"],
      { kind: "automatic" },
      "p1-c2",
    );
    const self = char(next, "p1-c2");
    expect(self.health).toBe(10);
    expect(self.focus).toBe(2);
    expect(self.regeneration).toHaveLength(0);
  });
});
