import { describe, expect, it } from "vitest";
import { BASE_WEIGHTS } from "../personalities";
import {
  applyStrategy,
  DELTA_CLAMP,
  parseStrategyReply,
  resolveStrategy,
  STANCE_DELTAS,
  toAdvice,
} from "./strategy";

describe("parseStrategyReply", () => {
  it("accepts a valid reply", () => {
    const r = parseStrategyReply('{"stance":"aggressive","riskTolerance":0.8,"notes":"rush"}');
    expect(r.ok && r.value.stance).toBe("aggressive");
    expect(r.ok && r.value.riskTolerance).toBe(0.8);
  });

  it("rejects an unknown stance", () => {
    expect(parseStrategyReply('{"stance":"reckless"}').ok).toBe(false);
  });

  it("rejects non-JSON", () => {
    expect(parseStrategyReply("I think you should attack").ok).toBe(false);
  });
});

describe("toAdvice / resolveStrategy", () => {
  it("clamps every delta to +/- DELTA_CLAMP", () => {
    const advice = resolveStrategy('{"stance":"turtle","riskTolerance":0}');
    for (const v of Object.values(advice.deltas)) {
      expect(Math.abs(v as number)).toBeLessThanOrEqual(DELTA_CLAMP + 1e-9);
    }
  });

  it("defaults riskTolerance to 0.5", () => {
    expect(toAdvice({ stance: "standard" }).riskTolerance).toBe(0.5);
  });

  it("risk nudges damage up and safety down", () => {
    const low = toAdvice({ stance: "standard", riskTolerance: 0 });
    const high = toAdvice({ stance: "standard", riskTolerance: 1 });
    expect(high.deltas.damage ?? 0).toBeGreaterThan(low.deltas.damage ?? 0);
    expect(high.deltas.safety ?? 0).toBeLessThan(low.deltas.safety ?? 0);
  });

  it("stance deltas are ordered aggressive > standard > turtle on damage", () => {
    expect(STANCE_DELTAS.aggressive.damage ?? 0).toBeGreaterThan(STANCE_DELTAS.standard.damage ?? 0);
    expect(STANCE_DELTAS.standard.damage ?? 0).toBeGreaterThan(STANCE_DELTAS.turtle.damage ?? 0);
  });
});

describe("applyStrategy", () => {
  it("returns the base unchanged without advice", () => {
    expect(applyStrategy(BASE_WEIGHTS, undefined)).toEqual(BASE_WEIGHTS);
  });

  it("merges deltas and never produces negative weights", () => {
    const out = applyStrategy({ ...BASE_WEIGHTS, damage: 0.1 }, toAdvice({ stance: "turtle" }));
    expect(out.damage).toBe(0);
    expect(out.safety).toBeGreaterThan(BASE_WEIGHTS.safety);
  });
});
