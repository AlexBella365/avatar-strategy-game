// Step 5 tests: end-of-round flow, refresh, activation helpers.
// Spec v2 §3, §8 phase 5, §12A.5.
import { describe, expect, it } from "vitest";
import { setup } from "../testutils";
import { dealDamage } from "./damage";
import { canActivate, endRound, pendingActivations } from "./turns";

describe("endRound", () => {
  it("refreshes energy/flags, clears momentum, flips initiative", () => {
    const state = setup();
    state.players[0].energy = 0;
    const aang = state.characters.find((c) => c.id === "p1-c0")!;
    aang.activatedThisRound = true;
    aang.reactionUsedThisRound = true;
    aang.movementSpent = 2;
    aang.momentum = 1;
    aang.passiveUsesThisRound["disciplineDiscount"] = 1;
    aang.techniqueBlockedThisActivation = true;
    const events = endRound(state);
    expect(state.round).toBe(2);
    expect(state.players[0].energy).toBe(4);
    expect(aang.activatedThisRound).toBe(false);
    expect(aang.reactionUsedThisRound).toBe(false);
    expect(aang.movementSpent).toBe(0);
    expect(aang.momentum).toBe(0);
    expect(aang.passiveUsesThisRound).toEqual({});
    expect(aang.techniqueBlockedThisActivation).toBe(false);
    expect(state.initiativePlayerId).toBe("p2");
    expect(events.some((e) => e.includes("Round 2 begins"))).toBe(true);
  });

  it("does not advance once the match is over", () => {
    const state = setup();
    for (const id of ["p2-c0", "p2-c1", "p2-c2"]) dealDamage(state, id, 999, "test");
    expect(state.winnerId).toBe("p1");
    endRound(state);
    expect(state.round).toBe(1);
  });

  it("applies the round-limit tiebreaker instead of advancing", () => {
    const state = setup();
    state.round = state.maxRounds;
    dealDamage(state, "p2-c0", 999, "test");
    endRound(state);
    expect(state.winnerId).toBe("p1");
    expect(state.round).toBe(state.maxRounds);
  });

  it("removes untilNextRound shields and keeps untilConsumed ones", () => {
    const state = setup();
    const aang = state.characters.find((c) => c.id === "p1-c0")!;
    aang.shields.push({ id: "a", amount: 1, duration: "untilNextRound" });
    aang.shields.push({ id: "b", amount: 2, duration: "untilConsumed" });
    aang.shields.push({ id: "c", amount: 3 });
    endRound(state);
    expect(aang.shields.map((s) => s.id)).toEqual(["b", "c"]);
  });

  it("counts Avatar State duration down and ends it at zero", () => {
    const state = setup();
    const aang = state.characters.find((c) => c.id === "p1-c0")!;
    aang.avatarState!.active = true;
    aang.avatarState!.roundsRemaining = 2;
    endRound(state);
    expect(aang.avatarState!.active).toBe(true);
    expect(aang.avatarState!.roundsRemaining).toBe(1);
    const events = endRound(state);
    expect(aang.avatarState!.active).toBe(false);
    expect(events.some((e) => e.includes("Avatar State ends"))).toBe(true);
  });
});

describe("activation helpers", () => {
  it("pendingActivations lists living unactivated characters", () => {
    const state = setup();
    expect(pendingActivations(state)).toHaveLength(6);
    state.characters.find((c) => c.id === "p1-c0")!.activatedThisRound = true;
    state.characters.find((c) => c.id === "p2-c0")!.health = 0;
    expect(pendingActivations(state)).toHaveLength(4);
  });

  it("canActivate respects life, activation, and match end", () => {
    const state = setup();
    expect(canActivate(state, "p1-c0")).toBe(true);
    state.characters.find((c) => c.id === "p1-c0")!.activatedThisRound = true;
    expect(canActivate(state, "p1-c0")).toBe(false);
    expect(canActivate(state, "nope")).toBe(false);
    state.winnerId = "p1";
    expect(canActivate(state, "p1-c1")).toBe(false);
  });
});
