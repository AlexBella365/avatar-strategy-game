// Step 5 tests: Resonance buildup + Avatar State activation (§12A.9).
import { describe, expect, it } from "vitest";
import { setup } from "../testutils";
import { applyGameAction } from "./cards";
import { endRound } from "./turns";
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
    id: "avatar-test-card",
    name: "Avatar Test Card",
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

function play(
  state: GameState,
  opts: {
    player?: string;
    char?: string;
    card: CardDefinition;
    selection: TargetSelection;
    instanceId?: string;
  },
): ActionResult {
  const player = opts.player ?? "p1";
  const char = opts.char ?? "p1-c0";
  const instanceId = opts.instanceId ?? `inst-${Math.random()}`;
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
  });
}

const sel = (id: string): TargetSelection => ({ kind: "character", characterId: id });
const resonanceOf = (state: GameState, id = "p1-c0") =>
  state.characters.find((c) => c.id === id)!.avatarState!.resonance;

const damaging = (element: NonNullable<CardDefinition["element"]>, amount = 1) =>
  mkCard({ kind: "character", allegiance: "enemies", range: 5 }, [{ type: "damage", amount }], {
    id: `hit-${element}`,
    element,
  });

describe("resonance buildup", () => {
  it("non-Avatar characters cannot gain Resonance", () => {
    const state = setup();
    state.players[0].energy = 9;
    const result = play(state, {
      char: "p1-c1",
      card: damaging("water"),
      selection: sel("p2-c1"),
    });
    expect(result.errors).toEqual([]);
    expect(state.characters.find((c) => c.id === "p1-c1")!.avatarState).toBeUndefined();
    expect(result.state.roundEventLog.filter((e) => e.startsWith("resonance:")).length).toBe(0);
  });

  it("distinct elements build Resonance, capped at 2 per round", () => {
    const state = setup();
    state.players[0].energy = 9;
    let s = play(state, { card: damaging("air"), selection: sel("p2-c0") }).state;
    expect(resonanceOf(s)).toBe(1);
    s = play(s, { card: damaging("water"), selection: sel("p2-c0"), instanceId: "w" }).state;
    expect(resonanceOf(s)).toBe(2);
    s = play(s, { card: damaging("air"), selection: sel("p2-c0"), instanceId: "a2" }).state;
    expect(resonanceOf(s)).toBe(2); // repeated element: no gain
    s = play(s, { card: damaging("earth"), selection: sel("p2-c0"), instanceId: "e" }).state;
    expect(resonanceOf(s)).toBe(2); // round cap: no gain
  });

  it("Resonance cannot exceed the threshold and pauses while active", () => {
    const state = setup();
    state.players[0].energy = 9;
    const aang = state.characters.find((c) => c.id === "p1-c0")!;
    aang.avatarState!.resonance = 5;
    const s = play(state, { card: damaging("air"), selection: sel("p2-c0") }).state;
    expect(resonanceOf(s)).toBe(6);
    const s2 = play(s, { card: damaging("water"), selection: sel("p2-c0"), instanceId: "w" }).state;
    expect(resonanceOf(s2)).toBe(6);
    s2.characters.find((c) => c.id === "p1-c0")!.avatarState!.active = true;
    const s3 = play(s2, { card: damaging("fire"), selection: sel("p2-c0"), instanceId: "f" }).state;
    expect(resonanceOf(s3)).toBe(6); // suppressed while active
  });

  it("protective instinct credits ally defense once per round (not self)", () => {
    const state = setup();
    state.players[0].energy = 9;
    const defense = mkCard(
      { kind: "character", allegiance: "allies", range: 5 },
      [{ type: "shield", amount: 2 }],
      { id: "guard2", cardType: "defense", element: "water" },
    );
    let s = play(state, {
      card: defense,
      selection: sel("p1-c1"),
      instanceId: "g1",
    }).state;
    expect(resonanceOf(s)).toBe(1);
    s = play(s, { card: defense, selection: sel("p1-c1"), instanceId: "g2" }).state;
    expect(resonanceOf(s)).toBe(1); // once per round
    // shielding self does not count
    s = play(s, { card: defense, selection: sel("p1-c0"), instanceId: "g3" }).state;
    expect(resonanceOf(s)).toBe(1);
  });

  it("spiritual pressure credits 3+ HP lost from one enemy action", () => {
    const state = setup();
    state.characters.find((c) => c.id === "p2-c2")!.position = { x: 5, y: 3 };
    state.players[1].energy = 9;
    const heavy = mkCard(
      { kind: "character", allegiance: "enemies", range: 6 },
      [{ type: "damage", amount: 4 }],
      { id: "heavy" },
    );
    let s = play(state, { player: "p2", char: "p2-c2", card: heavy, selection: sel("p1-c0") }).state;
    expect(resonanceOf(s)).toBe(1);
    s = play(s, { player: "p2", char: "p2-c2", card: heavy, selection: sel("p1-c0"), instanceId: "h2" }).state;
    expect(resonanceOf(s)).toBe(1); // once per round
  });
});

describe("activation", () => {
  function ready(): GameState {
    const state = setup();
    const aang = state.characters.find((c) => c.id === "p1-c0")!;
    aang.avatarState!.resonance = 6;
    aang.focus = 2;
    return state;
  }

  function activate(state: GameState) {
    return applyGameAction(state, {
      type: "ACTIVATE_AVATAR_STATE",
      playerId: "p1",
      characterId: "p1-c0",
    });
  }

  it("rejects non-Avatars, low resonance, low focus, and repeats", () => {
    expect(
      applyGameAction(setup(), {
        type: "ACTIVATE_AVATAR_STATE",
        playerId: "p1",
        characterId: "p1-c1",
      }).errors[0].code,
    ).toBe("NOT_AVATAR_CAPABLE");

    const unready = ready();
    unready.characters.find((c) => c.id === "p1-c0")!.avatarState!.resonance = 5;
    expect(activate(unready).errors[0].code).toBe("RESONANCE_NOT_READY");

    const poor = ready();
    poor.characters.find((c) => c.id === "p1-c0")!.focus = 1;
    expect(activate(poor).errors[0].code).toBe("INSUFFICIENT_FOCUS");

    const used = ready();
    used.characters.find((c) => c.id === "p1-c0")!.activatedThisRound = true;
    expect(activate(used).errors[0].code).toBe("ALREADY_ACTIVATED");
  });

  it("spends Focus, resets Resonance, blocks the technique, warns of risk", () => {
    const result = activate(ready());
    expect(result.errors).toEqual([]);
    const aang = result.state.characters.find((c) => c.id === "p1-c0")!;
    expect(aang.focus).toBe(0);
    expect(aang.avatarState!.active).toBe(true);
    expect(aang.avatarState!.roundsRemaining).toBe(2);
    expect(aang.avatarState!.resonance).toBe(0);
    expect(aang.avatarState!.activatedThisMatch).toBe(true);
    expect(aang.techniqueBlockedThisActivation).toBe(true);
    expect(result.events.some((e) => e.includes("immediately loses"))).toBe(true);

    const blocked = play(result.state, {
      card: damaging("air"),
      selection: sel("p2-c0"),
    });
    expect(blocked.errors[0].code).toBe("TECHNIQUE_SPENT");

    const moved = applyGameAction(result.state, {
      type: "MOVE",
      playerId: "p1",
      characterId: "p1-c0",
      to: { x: 1, y: 2 } as Position,
    });
    expect(moved.errors).toEqual([]); // movement still allowed
  });

  it("cannot activate twice; duration counts down across rounds", () => {
    let s = activate(ready()).state;
    expect(activate(s).errors[0].code).toBe("ALREADY_USED");
    endRound(s);
    expect(s.characters.find((c) => c.id === "p1-c0")!.avatarState!.roundsRemaining).toBe(1);
  });

  it("a shield that prevents the knockout prevents the instant loss", () => {
    const state = setup();
    state.characters.find((c) => c.id === "p2-c2")!.position = { x: 5, y: 3 };
    const aang = state.characters.find((c) => c.id === "p1-c0")!;
    aang.avatarState!.active = true;
    aang.shields.push({ id: "big", amount: 999, duration: "untilConsumed" });
    state.players[1].energy = 9;
    const heavy = mkCard(
      { kind: "character", allegiance: "enemies", range: 6 },
      [{ type: "damage", amount: 999 }],
      { id: "exec" },
    );
    const result = play(state, {
      player: "p2",
      char: "p2-c2",
      card: heavy,
      selection: sel("p1-c0"),
    });
    expect(result.errors).toEqual([]);
    expect(aang.health).toBeGreaterThan(0);
    expect(result.state.winnerId).toBeNull();
  });
});
