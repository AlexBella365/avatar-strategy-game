// Core formula tests: health derivation, aggression, raw damage, evasion.
import { describe, expect, it } from "vitest";
import { aggressionModifier, attackVsEvasion, rawDamage } from "./damage";
import { maxHealthFor } from "../state";

describe("core formulas (health/damage/evasion)", () => {
  it("health formula: 16 + 2*(RES-3), min 10", () => {
    expect(maxHealthFor(3)).toBe(16);
    expect(maxHealthFor(5)).toBe(20);
    expect(maxHealthFor(1)).toBe(12);
  });

  it("aggression modifier clamps to -1..+1", () => {
    expect(aggressionModifier(1)).toBe(-1);
    expect(aggressionModifier(3)).toBe(0);
    expect(aggressionModifier(5)).toBe(1);
  });

  it("raw damage respects scalesWithAggression", () => {
    expect(rawDamage(2, 5, true)).toBe(3);
    expect(rawDamage(2, 5, false)).toBe(2);
  });

  it("evasion: greater evades, tie deals base w/o secondary, greater hits", () => {
    expect(attackVsEvasion(3, 0, 5, 0)).toBe("evaded");
    expect(attackVsEvasion(3, 0, 3, 0)).toBe("tie");
    expect(attackVsEvasion(5, 0, 3, 0)).toBe("hit");
  });
});
