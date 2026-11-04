import { describe, expect, it } from "vitest";
import { createBudget } from "./budget";
import { createCache } from "./cache";

describe("createBudget", () => {
  it("enforces the per-match cap", () => {
    const b = createBudget({ maxCallsPerMatch: 2, maxCallsPerRound: 99, tokenCeiling: 1e9 });
    expect(b.tryConsume()).toBe(true);
    expect(b.tryConsume()).toBe(true);
    expect(b.tryConsume()).toBe(false);
    expect(b.snapshot().calls).toBe(2);
  });

  it("enforces the per-round cap and resets each round", () => {
    const b = createBudget({ maxCallsPerMatch: 99, maxCallsPerRound: 1, tokenCeiling: 1e9 });
    expect(b.tryConsume()).toBe(true);
    expect(b.tryConsume()).toBe(false);
    b.startRound(2);
    expect(b.tryConsume()).toBe(true);
  });

  it("enforces the token ceiling", () => {
    const b = createBudget({ tokenCeiling: 100 });
    b.noteTokens(100);
    expect(b.tryConsume()).toBe(false);
    expect(b.snapshot().tokens).toBe(100);
  });

  it("ignores non-positive token reports", () => {
    const b = createBudget();
    b.noteTokens(0);
    b.noteTokens(-5);
    b.noteTokens(NaN);
    expect(b.snapshot().tokens).toBe(0);
  });
});

describe("createCache", () => {
  it("stores, refreshes, and evicts beyond capacity", () => {
    const c = createCache<number>(2);
    c.set("a", 1);
    c.set("b", 2);
    expect(c.get("a")).toBe(1);
    c.set("c", 3); // evicts "b" (least recently used)
    expect(c.size).toBe(2);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    expect(c.get("c")).toBe(3);
  });
});
