// App-facing Track B controller.
//
// Everything the UI needs lives here so the LLM layer stays removable: deleting
// `src/game/ai/llm/` plus the two references in App.tsx is the entire cleanup.
//
// Mode 1 only (round-level stance). The call is fire-and-forget: the AI never
// waits on the network, it proceeds immediately with Track A and upgrades to
// the advice on a later tick (specs/npc_ai_plan.md §3 B.5).
import type { GameState } from "../../types";
import type { Weights } from "../types";
import { createAdvisor } from "./advisor";
import { llmActive, llmConfigFromEnv, type EnvLike } from "./index";
import type { AdvisorMetrics, HttpPost, StrategyAdvice } from "./types";

export type { EnvLike };

export interface StrategyController {
  /**
   * Weight deltas to merge for `side` this round (Track A seam), or undefined
   * to run pure Track A. Kicks off the request on first ask for the round.
   */
  adviceFor(state: GameState, side: string): Partial<Weights> | undefined;
  /** Short status line for the UI, or null before the first response. */
  status(): string | null;
  metrics(): AdvisorMetrics;
}

export interface StrategyControllerOptions {
  env: EnvLike;
  /** Called when new advice/status arrives so the caller can re-render. */
  onChange: () => void;
  /** Injectable HTTP seam (tests). Defaults to real `fetch`. */
  http?: HttpPost;
}

/** Returns null when Track B is disabled/unsupported (the default). */
export function createStrategyController(
  opts: StrategyControllerOptions,
): StrategyController | null {
  if (!llmActive(opts.env)) return null;

  const advisor = createAdvisor({ config: llmConfigFromEnv(opts.env), http: opts.http });
  const advice = new Map<string, StrategyAdvice>();
  const pending = new Set<string>();
  let currentRound = -1;
  let status: string | null = null;

  return {
    adviceFor(state, side) {
      if (state.round !== currentRound) {
        currentRound = state.round;
        advisor.startRound(state.round);
      }
      const key = `${side}:${state.round}`;
      const existing = advice.get(key);
      if (existing) return existing.deltas;

      if (!pending.has(key)) {
        pending.add(key);
        const requestRound = state.round;
        void advisor.strategy(state, side).then((result) => {
          pending.delete(key);
          // Drop late responses for a round that has since advanced.
          if (requestRound !== currentRound) return;
          if (!result) {
            status = "unavailable — Track A";
          } else {
            advice.set(key, result);
            status = `${result.stance}${result.notes ? ` — ${result.notes}` : ""}`;
          }
          opts.onChange();
        });
      }
      return undefined;
    },
    status: () => status,
    metrics: () => advisor.metrics(),
  };
}
