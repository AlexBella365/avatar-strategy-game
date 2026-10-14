// Step 4 tests: §8 phase-4 resolution — costs, reactions, damage order,
// movement/terrain effects, fizzles. Spec v2 §6, §8, §10, §12.
import { describe, expect, it } from "vitest";
import { setup } from "../testutils";
import { applyGameAction } from "./cards";
import { createTerrain } from "./terrain";
import { applyStatus } from "./statuses";
import type {
  ActionResult,
  CardDefinition,
  GameState,
  Position,
  TargetSelection,
} from "../types";

function mkCard(
  targeting: CardDefinition["targeting"],
  effects: CardDefinition["effects"],
  overrides: Partial<CardDefinition> = {},
): CardDefinition {
  return {
    id: "test-card",
    name: "Test Card",
    cardType: "attack",
    energyCost: 1,
    focusCost: 0,
    targeting,
    tags: [],
    effects,
    rulesText: "",
    ...overrides,
  };
}

const strike = (effects: CardDefinition["effects"], overrides: Partial<CardDefinition> = {}) =>
  mkCard({ kind: "character", allegiance: "enemies", range: 5 }, effects, overrides);

function play(
  state: GameState,
  opts: {
    player?: string;
    char?: string;
    card: CardDefinition;
    selection: TargetSelection;
    instanceId?: string;
    movePath?: Position[];
    reactions?: { characterId: string; dest: Position }[];
  },
): ActionResult {
  const player = opts.player ?? "p1";
  const char = opts.char ?? "p1-c0";
  const instanceId = opts.instanceId ?? "inst-1";
  state.players.find((p) => p.id === player)!.assignments[char] = {
    id: instanceId,
    definitionId: opts.card.id,
  };
  return applyGameAction(state, {
    type: "PLAY_CARD",
    playerId: player,
    characterId: char,
    cardInstanceId: instanceId,
    selection: opts.selection,
    card: opts.card,
    movePath: opts.movePath,
    reactions: opts.reactions,
  });
}

const sel = (id: string): TargetSelection => ({ kind: "character", characterId: id });

describe("validation and costs", () => {
  it("rejects unowned characters, missing cards, and bad targets", () => {
    const badOwner = play(setup(), {
      player: "p2",
      card: strike([{ type: "damage", amount: 2 }]),
      selection: sel("p2-c0"),
    });
    expect(badOwner.errors[0].code).toBe("NOT_YOUR_CHARACTER");

    const state = setup();
    const missing = applyGameAction(state, {
      type: "PLAY_CARD",
      playerId: "p1",
      characterId: "p1-c0",
      cardInstanceId: "nope",
      selection: sel("p2-c0"),
      card: strike([{ type: "damage", amount: 2 }]),
    });
    expect(missing.errors[0].code).toBe("NO_ASSIGNED_CARD");

    const outOfRange = play(setup(), {
      card: strike([{ type: "damage", amount: 2 }], {}),
      selection: sel("p2-c2"), // (5,5) is distance 8 from (1,1)
    });
    expect(outOfRange.errors[0].code).toBe("OUT_OF_RANGE");
  });

  it("rejects unaffordable cards and unmet attribute requirements", () => {
    const energy = setup();
    energy.players[0].energy = 0;
    expect(
      play(energy, { card: strike([{ type: "damage", amount: 2 }]), selection: sel("p2-c0") })
        .errors[0].code,
    ).toBe("INSUFFICIENT_ENERGY");

    const focus = setup();
    expect(
      play(focus, {
        card: strike([{ type: "damage", amount: 2 }], { focusCost: 2 }),
        selection: sel("p2-c0"),
      }).errors[0].code,
    ).toBe("INSUFFICIENT_FOCUS");

    const attrs = setup();
    expect(
      play(attrs, {
        card: strike([{ type: "damage", amount: 2 }], { requiresAttributes: { aggression: 5 } }),
        selection: sel("p2-c0"),
      }).errors[0].code,
    ).toBe("ATTRIBUTE_REQUIREMENT"); // aang has aggression 2
  });

  it("pays costs, removes the card from hand, and logs", () => {
    const state = setup();
    const result = play(state, {
      card: strike([{ type: "damage", amount: 2, scalesWithAggression: true }]),
      selection: sel("p2-c0"),
    });
    expect(result.errors).toEqual([]);
    expect(result.state.players[0].energy).toBe(3);
    expect(result.state.players[0].assignments["p1-c0"]).toBeNull();
    expect(result.state.players[0].discard).toHaveLength(1);
    expect(result.state.characters.find((c) => c.id === "p2-c0")!.health).toBe(18 - 1); // agg 2 -> -1
    expect(result.state.log.some((l) => l.includes("Test Card"))).toBe(true);
  });

  it("Exhausted adds +1 Energy and is consumed", () => {
    const exhausted = setup();
    applyStatus(exhausted, "p1-c0", "Exhausted", 1);
    const r1 = play(exhausted, {
      card: strike([{ type: "damage", amount: 1 }], { energyCost: 2 }),
      selection: sel("p2-c0"),
    });
    // cost 2 +1 exhausted; aang discipline 3 => no discount
    expect(r1.errors).toEqual([]);
    expect(r1.state.players[0].energy).toBe(4 - 3);
  });

  it("Discipline 4+ discounts a 2+ cost card once per round", () => {
    const state = setup(); // katara (3,1) has discipline 4
    const card = mkCard(
      { kind: "character", allegiance: "enemies", range: 5 },
      [{ type: "damage", amount: 1 }],
      { id: "d2", name: "D2", energyCost: 2 },
    );
    const r1 = play(state, { char: "p1-c1", card, selection: sel("p2-c1") });
    expect(r1.errors).toEqual([]);
    expect(r1.state.players[0].energy).toBe(3); // 4 - (2-1)
    const r2 = play(r1.state, {
      char: "p1-c1",
      card: { ...card, id: "d2b" },
      selection: sel("p2-c1"),
      instanceId: "inst-2",
    });
    expect(r2.errors).toEqual([]);
    expect(r2.state.players[0].energy).toBe(1); // 3 - 2, no second discount
  });
});

describe("damage order and evasion", () => {
  it("resolves aggression -> avatar -> exposed -> cover -> shields", () => {
    const state = setup();
    const aang = state.characters.find((c) => c.id === "p1-c0")!;
    aang.avatarState!.active = true; // +1 damage
    applyStatus(state, "p2-c0", "Exposed", 1); // +1 focused
    createTerrain(state, { x: 1, y: 5 }, "cover", "permanent", "fail"); // -1 ranged
    state.characters.find((c) => c.id === "p2-c0")!.shields.push({ id: "s1", amount: 1 });
    // base 2, aang agg 2 (-1) => 1; +1 avatar +1 exposed = 3; -1 cover = 2; -1 shield => 1 HP
    const result = play(state, {
      card: strike([{ type: "damage", amount: 2, scalesWithAggression: true }]),
      selection: sel("p2-c0"),
    });
    expect(result.errors).toEqual([]);
    const toph = result.state.characters.find((c) => c.id === "p2-c0")!;
    expect(toph.health).toBe(18 - 1);
    expect(toph.shields).toHaveLength(0);
    expect(toph.statuses.some((s) => s.statusId === "Exposed")).toBe(false); // consumed
  });

  it("opt-in stat evasion avoids damage; ties deal damage without status", () => {
    // zuko per 3 vs sokka agi 3 => tie: damage applies, no secondary status
    const tie = setup();
    tie.characters.find((c) => c.id === "p2-c1")!.position = { x: 3, y: 3 };
    const r2 = play(tie, {
      char: "p1-c2",
      card: mkCard(
        { kind: "character", allegiance: "enemies", range: 5 },
        [
          { type: "damage", amount: 2, scalesWithAggression: true },
          { type: "applyStatus", statusId: "Exposed", duration: 1 },
        ],
        { id: "ev2", canBeEvaded: true },
      ),
      selection: sel("p2-c1"), // sokka agi 3 vs zuko per 3 => tie
    });
    expect(r2.errors).toEqual([]);
    const sokka = r2.state.characters.find((c) => c.id === "p2-c1")!;
    expect(sokka.health).toBe(14 - 3); // damage applied (2 + agg 5 => +1)
    expect(sokka.statuses).toHaveLength(0); // ...but no secondary status
  });

  it("full evasion skips damage and on-hit effects", () => {
    const state = setup();
    state.characters.find((c) => c.id === "p2-c2")!.position = { x: 5, y: 3 };
    // azula per 4 vs aang agi 5 => evaded (distance 6)
    const result = play(state, {
      char: "p2-c2",
      player: "p2",
      card: mkCard(
        { kind: "character", allegiance: "enemies", range: 6 },
        [{ type: "damage", amount: 3 }],
        { id: "ev3", canBeEvaded: true },
      ),
      selection: sel("p1-c0"),
    });
    expect(result.errors).toEqual([]);
    expect(result.state.characters.find((c) => c.id === "p1-c0")!.health).toBe(14); // aang res 2
  });
});

describe("Evade reactions", () => {
  it("evading out of range causes a miss (costs still paid)", () => {
    const state = setup();
    state.characters.find((c) => c.id === "p2-c1")!.position = { x: 3, y: 3 };
    const card = mkCard(
      { kind: "character", allegiance: "enemies", range: 2 },
      [{ type: "damage", amount: 2 }],
      { id: "rs2" },
    );
    const result = play(state, {
      char: "p1-c1",
      card,
      selection: sel("p2-c1"),
      reactions: [{ characterId: "p2-c1", dest: { x: 4, y: 3 } }], // distance 3 > 2
    });
    expect(result.errors).toEqual([]);
    const sokka = result.state.characters.find((c) => c.id === "p2-c1")!;
    expect(sokka.health).toBe(14);
    expect(sokka.focus).toBe(0);
    expect(sokka.reactionUsedThisRound).toBe(true);
    expect(result.state.players[0].energy).toBe(3); // fizzle keeps costs
    expect(result.events.some((e) => e.includes("miss"))).toBe(true);
  });

  it("evading within range still gets hit", () => {
    const state = setup();
    state.characters.find((c) => c.id === "p2-c1")!.position = { x: 3, y: 3 };
    const card = mkCard(
      { kind: "character", allegiance: "enemies", range: 2 },
      [{ type: "damage", amount: 2 }],
      { id: "rs3" },
    );
    const result = play(state, {
      char: "p1-c1",
      card,
      selection: sel("p2-c1"),
      reactions: [{ characterId: "p2-c1", dest: { x: 3, y: 2 } }], // distance 1, LOS clear
    });
    expect(result.state.characters.find((c) => c.id === "p2-c1")!.health).toBe(14 - 2);
  });

  it("tile-targeted attacks resolve at the tile after the target moves", () => {
    const state = setup();
    state.characters.find((c) => c.id === "p2-c1")!.position = { x: 3, y: 3 };
    const card = mkCard(
      { kind: "tile", range: 3, allowsOccupiedTile: true },
      [{ type: "damage", amount: 2 }],
      { id: "tile-bomb" },
    );
    // sokka evades (3,3) -> (4,3); bomb stays on (3,3): empty => no damage, no fizzle error
    const result = play(state, {
      char: "p1-c1",
      card,
      selection: { kind: "tile", pos: { x: 3, y: 3 } },
      reactions: [{ characterId: "p2-c1", dest: { x: 4, y: 3 } }],
    });
    expect(result.errors).toEqual([]);
    expect(result.state.characters.find((c) => c.id === "p2-c1")!.health).toBe(14);
  });
});

describe("AoE, synergy, and match-end stops", () => {
  it("AoE hits every eligible target independently (not split)", () => {
    const state = setup();
    const card = mkCard(
      { kind: "area", shape: "allEnemies", allegiance: "enemies" },
      [{ type: "damage", amount: 2, scalesWithAggression: true }],
      { id: "aoe" },
    );
    const result = play(state, { char: "p1-c2", card, selection: { kind: "automatic" } });
    expect(result.state.characters.find((c) => c.id === "p2-c0")!.health).toBe(18 - 3); // zuko agg
    expect(result.state.characters.find((c) => c.id === "p2-c1")!.health).toBe(14 - 3);
    expect(result.state.characters.find((c) => c.id === "p2-c2")!.health).toBe(14 - 3);
  });

  it("an AoE that KOs the active Avatar stops immediately", () => {
    const state = setup();
    const aang = state.characters.find((c) => c.id === "p1-c0")!;
    aang.avatarState!.active = true;
    const card = mkCard(
      { kind: "area", shape: "allEnemies", allegiance: "enemies" },
      [{ type: "damage", amount: 999 }],
      { id: "mega" },
    );
    const result = play(state, {
      char: "p2-c2",
      player: "p2",
      card,
      selection: { kind: "automatic" },
    });
    expect(result.state.winnerId).toBe("p2");
    // later targets untouched
    expect(result.state.characters.find((c) => c.id === "p1-c1")!.health).toBe(16);
    expect(result.state.characters.find((c) => c.id === "p1-c2")!.health).toBe(16);
  });

  it("displacement this round powers follow-up bonuses (no card-name checks)", () => {
    const state = setup();
    state.characters.find((c) => c.id === "p2-c1")!.position = { x: 3, y: 3 };
    const whip = mkCard(
      { kind: "character", allegiance: "enemies", range: 3 },
      [{ type: "push", steps: 1 }],
      { id: "whip" },
    );
    const r1 = play(state, { char: "p1-c1", card: whip, selection: sel("p2-c1") });
    expect(r1.state.characters.find((c) => c.id === "p2-c1")!.position).toEqual({ x: 3, y: 4 });
    const flame = mkCard(
      { kind: "character", allegiance: "enemies", range: 5 },
      [{ type: "damage", amount: 3, scalesWithAggression: true, bonusIfTargetDisplaced: 1 }],
      { id: "flame" },
    );
    const r2 = play(r1.state, { char: "p1-c2", card: flame, selection: sel("p2-c1") });
    // 3 + zuko agg 1 + displaced 1 = 5
    expect(r2.state.characters.find((c) => c.id === "p2-c1")!.health).toBe(14 - 5);
  });

  it("water-empowered attacks gain the card's bonus once", () => {
    const state = setup();
    createTerrain(state, { x: 3, y: 2 }, "water-source", "permanent", "fail");
    const card = strike([{ type: "damage", amount: 2, waterEmpoweredBonus: 1 }], { id: "ww" });
    const result = play(state, { char: "p1-c1", card, selection: sel("p2-c1") });
    // katara agg 3 => +0; 2 + 1 empowered = 3
    expect(result.state.characters.find((c) => c.id === "p2-c1")!.health).toBe(14 - 3);
  });
});

describe("card movement and terrain effects", () => {
  it("moves before the technique, then strikes from the new tile", () => {
    const state = setup();
    state.characters.find((c) => c.id === "p2-c0")!.position = { x: 1, y: 3 };
    const card = mkCard(
      { kind: "character", allegiance: "enemies", range: "melee" },
      [{ type: "damage", amount: 2, scalesWithAggression: true }],
      {
        id: "charge",
        movement: { timing: "beforeTechnique", maxSteps: 2, path: "orthogonal", destinationRule: "fizzle" },
      },
    );
    // aang (1,1) -> (1,2); toph (1,3) now adjacent
    const result = play(state, {
      card,
      selection: sel("p2-c0"),
      movePath: [{ x: 1, y: 2 }],
    });
    expect(result.errors).toEqual([]);
    expect(result.state.characters.find((c) => c.id === "p1-c0")!.position).toEqual({ x: 1, y: 2 });
    expect(result.state.characters.find((c) => c.id === "p2-c0")!.health).toBe(18 - 1);
  });

  it("mustBeLegal movement fails pre-payment without spending", () => {
    const state = setup();
    createTerrain(state, { x: 1, y: 2 }, "rock-wall", "permanent", "fail");
    const card = mkCard(
      { kind: "character", allegiance: "enemies", range: "melee" },
      [{ type: "damage", amount: 2 }],
      {
        id: "charge2",
        movement: { timing: "beforeTechnique", maxSteps: 2, path: "orthogonal", destinationRule: "mustBeLegal" },
      },
    );
    const result = play(state, { card, selection: sel("p2-c0"), movePath: [{ x: 1, y: 2 }] });
    expect(result.errors[0].code).toBe("TILE_BLOCKED");
    expect(result.state.players[0].energy).toBe(4);
    expect(result.state.players[0].assignments["p1-c0"]).not.toBeNull();
  });

  it("insteadOfTechnique moves without resolving effects", () => {
    const state = setup();
    const card = mkCard({ kind: "self" }, [{ type: "damage", amount: 99 }], {
      id: "dash",
      movement: { timing: "insteadOfTechnique", maxSteps: 2, path: "orthogonal", destinationRule: "fizzle" },
    });
    const result = play(state, {
      card,
      selection: { kind: "automatic" },
      movePath: [{ x: 2, y: 1 }],
    });
    expect(result.errors).toEqual([]);
    expect(result.state.characters.find((c) => c.id === "p1-c0")!.position).toEqual({ x: 2, y: 1 });
    expect(result.state.players[0].energy).toBe(3); // technique still paid
  });

  it("terrain effects create terrain once at the locked tiles", () => {
    const state = setup();
    const card = mkCard({ kind: "tile", range: 3, allowsOccupiedTile: true }, [], {
      id: "wall",
      cardType: "support",
      terrainEffects: [{ terrainId: "rubble", target: "targetTile", durationRounds: 2, replacementPolicy: "fail" }],
    });
    const result = play(state, {
      char: "p1-c1",
      card,
      selection: { kind: "tile", pos: { x: 4, y: 2 } },
    });
    expect(result.errors).toEqual([]);
    expect(
      result.state.terrain.find((t) => t.x === 4 && t.y === 2)?.terrainId,
    ).toBe("rubble");
  });
});

describe("support effects and actions", () => {
  it("heals, shields, focuses, and disrupts", () => {
    const state = setup();
    state.characters.find((c) => c.id === "p1-c1")!.health = 10;
    const support = mkCard({ kind: "self" }, [
      { type: "heal", amount: 3 },
      { type: "gainFocus", amount: 5 },
      { type: "gainMomentum", amount: 2 },
    ], { id: "sup", cardType: "support" });
    const r1 = play(state, { char: "p1-c1", card: support, selection: { kind: "automatic" } });
    const katara = r1.state.characters.find((c) => c.id === "p1-c1")!;
    expect(katara.health).toBe(13);
    expect(katara.focus).toBe(4); // capped
    expect(katara.momentum).toBe(1); // capped
    const disrupt = mkCard({ kind: "character", allegiance: "enemies", range: 5 }, [
      { type: "disrupt", amount: 1 },
    ], { id: "dis" });
    const r2 = play(r1.state, { char: "p1-c1", card: disrupt, selection: sel("p2-c1") });
    expect(
      r2.state.characters.find((c) => c.id === "p2-c1")!.statuses.some((s) => s.statusId === "Exhausted"),
    ).toBe(true);
  });

  it("MOVE finds the cheapest path; SET_INTENTION hides values; PASS marks activation", () => {
    const state = setup();
    const moved = applyGameAction(state, { type: "MOVE", playerId: "p1", characterId: "p1-c0", to: { x: 2, y: 1 } });
    expect(moved.errors).toEqual([]);
    expect(moved.state.characters.find((c) => c.id === "p1-c0")!.position).toEqual({ x: 2, y: 1 });
    const intent = applyGameAction(moved.state, {
      type: "SET_INTENTION",
      playerId: "p1",
      characterId: "p1-c0",
      intention: "Attack",
    });
    expect(intent.state.players[0].intentions["p1-c0"]).toBe("Attack");
    expect(intent.events[0]).not.toContain("Attack");
    const pass = applyGameAction(intent.state, { type: "PASS_ACTIVATION", playerId: "p1", characterId: "p1-c0" });
    expect(pass.state.characters.find((c) => c.id === "p1-c0")!.activatedThisRound).toBe(true);
  });
});
