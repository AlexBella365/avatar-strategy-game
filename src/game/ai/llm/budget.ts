// Hard caps on LLM usage (specs/npc_ai_plan.md §3 B.6). Defaults are
// deliberately small: Track B must never dominate a match's latency or cost,
// and every cap is a kill switchable guardrail.
export interface BudgetOptions {
  /** Max calls in a single match. */
  maxCallsPerMatch?: number;
  /** Max calls in a single round. */
  maxCallsPerRound?: number;
  /** Total tokens (in + out) across the match. */
  tokenCeiling?: number;
}

export const DEFAULT_BUDGET: Required<BudgetOptions> = {
  maxCallsPerMatch: 12,
  maxCallsPerRound: 4,
  tokenCeiling: 20_000,
};

export interface LlmBudget {
  /** Reserves a call; false when any cap is hit (the caller falls back). */
  tryConsume(): boolean;
  /** Records token usage from a completed call. */
  noteTokens(total: number): void;
  /** Reset the per-round counter (call at round start). */
  startRound(round: number): void;
  snapshot(): { calls: number; tokens: number; callsThisRound: number; round: number };
  reset(): void;
}

export function createBudget(opts: BudgetOptions = {}): LlmBudget {
  const cfg = { ...DEFAULT_BUDGET, ...opts };
  let calls = 0;
  let tokens = 0;
  let callsThisRound = 0;
  let round = 0;

  return {
    tryConsume() {
      if (calls >= cfg.maxCallsPerMatch) return false;
      if (callsThisRound >= cfg.maxCallsPerRound) return false;
      if (tokens >= cfg.tokenCeiling) return false;
      calls += 1;
      callsThisRound += 1;
      return true;
    },
    noteTokens(total) {
      if (Number.isFinite(total) && total > 0) tokens += total;
    },
    startRound(next) {
      round = next;
      callsThisRound = 0;
    },
    snapshot: () => ({ calls, tokens, callsThisRound, round }),
    reset() {
      calls = 0;
      tokens = 0;
      callsThisRound = 0;
      round = 0;
    },
  };
}
