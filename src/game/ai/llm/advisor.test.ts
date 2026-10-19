import { describe, expect, it, vi } from "vitest";
import { cloneState } from "../../state";
import { setup } from "../../testutils";
import { createAdvisor, isStale } from "./advisor";
import { createJournal } from "./journal";
import { stateHash } from "./hash";
import type { HttpPost, LlmConfig } from "./types";

const config: LlmConfig = {
  baseUrl: "http://localhost:11434",
  model: "test",
  wire: "ollama",
  timeoutMs: 500,
  temperature: 0.2,
  maxTokens: 100,
};

function fakeHttp(content: string) {
  let calls = 0;
  const http: HttpPost = async (_url, _init) => {
    calls += 1;
    return { status: 200, body: { message: { content } } };
  };
  return { http, calls: () => calls };
}

const throwingHttp: HttpPost = async () => {
  throw new Error("network down");
};

function ranked(scores: number[]) {
  return scores.map((score, i) => ({
    value: i,
    score,
    components: { damage: score },
    label: `option ${i}`,
  }));
}

describe("advisor.strategy (Mode 1)", () => {
  it("returns resolved advice and records a call", async () => {
    const { http, calls } = fakeHttp('{"stance":"aggressive","riskTolerance":0.9}');
    const advisor = createAdvisor({ config, http });
    const advice = await advisor.strategy(setup(), "p1");
    expect(advice?.stance).toBe("aggressive");
    expect(advice?.deltas.damage).toBeGreaterThan(0);
    expect(calls()).toBe(1);
    expect(advisor.metrics()).toMatchObject({ calls: 1, failures: 0, fallbacks: 0 });
  });

  it("serves repeated identical situations from cache (zero extra calls)", async () => {
    const { http, calls } = fakeHttp('{"stance":"cautious"}');
    const advisor = createAdvisor({ config, http });
    const state = setup();
    await advisor.strategy(state, "p1");
    await advisor.strategy(state, "p1");
    expect(calls()).toBe(1);
    expect(advisor.metrics().cacheHits).toBe(1);
  });

  it("falls back to null on invalid JSON", async () => {
    const { http } = fakeHttp("I shall attack!");
    const advisor = createAdvisor({ config, http });
    expect(await advisor.strategy(setup(), "p1")).toBeNull();
    expect(advisor.metrics()).toMatchObject({ failures: 1, fallbacks: 1 });
  });

  it("falls back to null on a network error", async () => {
    const advisor = createAdvisor({ config, http: throwingHttp });
    expect(await advisor.strategy(setup(), "p1")).toBeNull();
    expect(advisor.metrics().failures).toBe(1);
  });

  it("makes no call when disabled", async () => {
    const { http, calls } = fakeHttp('{"stance":"aggressive"}');
    const advisor = createAdvisor({ config, http, enabled: false });
    expect(await advisor.strategy(setup(), "p1")).toBeNull();
    expect(calls()).toBe(0);
  });

  it("enforces the per-match call cap", async () => {
    const { http, calls } = fakeHttp('{"stance":"aggressive"}');
    const advisor = createAdvisor({ config, http, budgetOptions: { maxCallsPerMatch: 1 } });
    await advisor.strategy(setup(), "p1");
    const other = cloneState(setup());
    other.round += 1; // different fingerprint
    expect(await advisor.strategy(other, "p1")).toBeNull();
    expect(calls()).toBe(1);
    expect(advisor.metrics().budgetDenied).toBe(1);
  });

  it("replays from the journal with the network off", async () => {
    const state = setup();
    const journal = createJournal([
      { key: stateHash(state, "p1"), mode: "strategy", response: '{"stance":"turtle"}' },
    ]);
    const advisor = createAdvisor({ config, http: throwingHttp, replay: true, journal });
    const advice = await advisor.strategy(state, "p1");
    expect(advice?.stance).toBe("turtle");
    expect(advisor.metrics()).toMatchObject({ calls: 0, cacheHits: 1 });
  });
});

describe("advisor.choose (Mode 2)", () => {
  it("returns a validated pick when the scorer is unsure", async () => {
    const { http, calls } = fakeHttp('{"choiceId":1,"rationale":"flank"}');
    const advisor = createAdvisor({ config, http });
    const advice = await advisor.choose(setup(), "p1", ranked([1.0, 0.99, 0.98]));
    expect(advice).toEqual({ choiceId: 1, rationale: "flank" });
    expect(calls()).toBe(1);
  });

  it("does not ask when the top-2 gap is wide", async () => {
    const { http, calls } = fakeHttp('{"choiceId":0}');
    const advisor = createAdvisor({ config, http });
    expect(await advisor.choose(setup(), "p1", ranked([1.0, 0.4]))).toBeNull();
    expect(calls()).toBe(0);
  });

  it("falls back when the model picks an out-of-range id", async () => {
    const { http } = fakeHttp('{"choiceId":9}');
    const advisor = createAdvisor({ config, http });
    expect(await advisor.choose(setup(), "p1", ranked([1.0, 0.99]))).toBeNull();
    expect(advisor.metrics().failures).toBe(1);
  });
});

describe("staleness + metrics", () => {
  it("isStale detects a changed state", () => {
    const state = setup();
    const fingerprint = stateHash(state, "p1");
    expect(isStale(fingerprint, state, "p1")).toBe(false);
    const moved = cloneState(state);
    moved.round += 1;
    expect(isStale(fingerprint, moved, "p1")).toBe(true);
  });

  it("exposes the shared journal and a resettable metric snapshot", async () => {
    const { http } = fakeHttp('{"stance":"standard"}');
    const advisor = createAdvisor({ config, http });
    await advisor.strategy(setup(), "p1");
    expect(advisor.journal().size).toBe(1);
    advisor.reset();
    expect(advisor.metrics().calls).toBe(0);
    expect(advisor.journal().size).toBe(0);
  });

  it("never throws when the http seam rejects asynchronously", async () => {
    const advisor = createAdvisor({
      config,
      http: vi.fn(async () => {
        throw new Error("async boom");
      }) as unknown as HttpPost,
    });
    await expect(advisor.strategy(setup(), "p1")).resolves.toBeNull();
  });
});
