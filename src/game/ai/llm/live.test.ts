// OPT-IN live probe against a local Ollama server. Never runs in CI:
//
//   LLM_LIVE=1 LLM_MODELS=qwen3.5:0.8b,bonsai-2:latest \
//     npx vitest run src/game/ai/llm/live.test.ts
//
// Missing models are skipped, not failed ("try them all, skip if fails").
// This is the only Track B test that may touch the network.
import { beforeAll, describe, expect, it } from "vitest";
import { setup } from "../../testutils";
import { createAdvisor } from "./advisor";
import type { LlmConfig } from "./types";

const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env ?? {};

const LIVE = env.LLM_LIVE === "1";
const BASE = env.LLM_BASE_URL ?? "http://localhost:11434";
const MODELS = (env.LLM_MODELS ?? "qwen3.5:0.8b,bonsai-2:latest")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

describe.skipIf(!LIVE)("live Ollama (opt-in: LLM_LIVE=1)", () => {
  let available: string[] = [];

  beforeAll(async () => {
    try {
      const res = await fetch(`${BASE}/api/tags`);
      const body = (await res.json()) as { models?: { name: string }[] };
      available = (body.models ?? []).map((m) => m.name);
    } catch {
      available = [];
    }
  });

  for (const model of MODELS) {
    it(
      `Mode 1 strategy against ${model}`,
      async () => {
        if (!available.includes(model)) {
          console.warn(`[live] skip ${model}: not pulled`);
          return;
        }
        const config: LlmConfig = {
          baseUrl: BASE,
          model,
          wire: "ollama",
          timeoutMs: 30_000,
          temperature: 0.2,
          maxTokens: 200,
        };
        const advisor = createAdvisor({ config });
        const advice = await advisor.strategy(setup(), "p1");
        console.log(`[live] ${model}`, JSON.stringify(advisor.metrics()), advice);
        if (advice === null) {
          // "Try them all, skip if it fails": record and move on.
          console.warn(`[live] ${model}: no advice (metrics above)`);
          return;
        }
        expect(["aggressive", "standard", "cautious", "turtle"]).toContain(
          advice.stance,
        );
      },
      60_000,
    );
  }
});
