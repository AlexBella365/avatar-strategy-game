// The Track B orchestrator: one object that owns the client transport, budget,
// cache, and journal, and exposes the two *advisory* entry points the policy
// can consume.
//
// Guarantees (specs/npc_ai_plan.md §3 B.0/B.5):
//   * never throws at the caller — every failure is `null` (⇒ Track A argmax)
//   * cached/identical situations cost zero calls
//   * budget caps are enforced before any network call
//   * with `replay: true` the network is never touched (journal only)
import type { GameState } from "../../types";
import type { Scored } from "../types";
import { createBudget, type BudgetOptions, type LlmBudget } from "./budget";
import { createCache, type LlmCache } from "./cache";
import { postChatJSON } from "./client";
import {
  buildChooserMessages,
  parseChooserReply,
  shouldAsk,
  toCandidates,
  type ChooserCandidate,
} from "./chooser";
import { buildDigest } from "./digest";
import { stateHash } from "./hash";
import {
  createJournal,
  journalKey,
  type JournalEntry,
  type JournalMode,
  type LlmJournal,
} from "./journal";
import { buildStrategyMessages, parseStrategyReply, toAdvice } from "./strategy";
import type {
  AdvisorMetrics,
  ChatMessage,
  ChooserAdvice,
  HttpPost,
  LlmConfig,
  StrategyAdvice,
} from "./types";

export interface AdvisorOptions {
  config: LlmConfig;
  /** Injectable HTTP seam (tests). Defaults to real `fetch`. */
  http?: HttpPost;
  budget?: LlmBudget;
  budgetOptions?: BudgetOptions;
  cache?: LlmCache<string>;
  journal?: LlmJournal;
  /** Seed the journal (replay a recorded match). */
  journalSeed?: JournalEntry[];
  /** Master kill switch. `false` ⇒ every consult falls back to Track A. */
  enabled?: boolean;
  /** Replay mode: read the journal only; never touch the network. */
  replay?: boolean;
}

export interface LlmAdvisor {
  readonly enabled: boolean;
  readonly replay: boolean;
  /** Round-level advice, or null to keep the current/archetype weights. */
  strategy(state: GameState, playerId: string): Promise<StrategyAdvice | null>;
  /** Mode-2 pick among `ranked`, or null to keep the Track A argmax. */
  choose<T>(
    state: GameState,
    playerId: string,
    ranked: Scored<T>[],
  ): Promise<ChooserAdvice | null>;
  /** Fingerprint used for cache/journal/staleness. */
  fingerprint(state: GameState, playerId: string): string;
  startRound(round: number): void;
  metrics(): AdvisorMetrics;
  journal(): LlmJournal;
  budget(): LlmBudget;
  reset(): void;
}

/** True when advice resolved for `fingerprint` no longer matches `state`. */
export function isStale(
  fingerprint: string,
  state: GameState,
  playerId: string,
): boolean {
  return stateHash(state, playerId) !== fingerprint;
}

export function createAdvisor(opts: AdvisorOptions): LlmAdvisor {
  const enabled = opts.enabled ?? true;
  const replay = opts.replay ?? false;
  const budget = opts.budget ?? createBudget(opts.budgetOptions);
  const cache = opts.cache ?? createCache<string>();
  const journal = opts.journal ?? createJournal(opts.journalSeed ?? []);

  const counts: AdvisorMetrics = {
    calls: 0,
    failures: 0,
    fallbacks: 0,
    cacheHits: 0,
    budgetDenied: 0,
  };

  async function consult(
    mode: JournalMode,
    state: GameState,
    playerId: string,
    messages: () => ChatMessage[],
  ): Promise<string | null> {
    const fingerprint = stateHash(state, playerId);
    const cacheKey = journalKey(mode, fingerprint);

    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
      counts.cacheHits += 1;
      return cached;
    }
    const recorded = journal.get(fingerprint, mode);
    if (recorded !== undefined) {
      cache.set(cacheKey, recorded);
      counts.cacheHits += 1;
      return recorded;
    }
    if (!enabled || replay) return null;
    if (!budget.tryConsume()) {
      counts.budgetDenied += 1;
      return null;
    }
    try {
      const response = await postChatJSON(opts.config, messages(), { http: opts.http });
      counts.calls += 1;
      budget.noteTokens(response.usage.inputTokens + response.usage.outputTokens);
      journal.record({ key: fingerprint, mode, response: response.text });
      cache.set(cacheKey, response.text);
      return response.text;
    } catch {
      // Network/HTTP/timeout/parse: fall back silently.
      counts.failures += 1;
      return null;
    }
  }

  return {
    enabled,
    replay,

    async strategy(state, playerId) {
      if (state.winnerId !== null || state.isDraw) return null;
      const text = await consult("strategy", state, playerId, () =>
        buildStrategyMessages(buildDigest(state, playerId)),
      );
      if (text === null) {
        counts.fallbacks += 1;
        return null;
      }
      const parsed = parseStrategyReply(text);
      if (!parsed.ok) {
        counts.failures += 1;
        counts.fallbacks += 1;
        return null;
      }
      return toAdvice(parsed.value);
    },

    async choose(state, playerId, ranked) {
      // Cheap confidence gate: only consult when the scorer is unsure.
      if (!shouldAsk(ranked)) return null;
      const candidates = toCandidates(ranked);
      const text = await consult("chooser", state, playerId, () =>
        buildChooserMessages(buildDigest(state, playerId), candidates),
      );
      if (text === null) {
        counts.fallbacks += 1;
        return null;
      }
      const parsed = parseChooserReply(text, candidates.length);
      if (!parsed.ok) {
        counts.failures += 1;
        counts.fallbacks += 1;
        return null;
      }
      return parsed.value;
    },

    fingerprint: (state, playerId) => stateHash(state, playerId),
    startRound: (round) => budget.startRound(round),
    metrics: () => ({ ...counts }),
    journal: () => journal,
    budget: () => budget,
    reset() {
      counts.calls = 0;
      counts.failures = 0;
      counts.fallbacks = 0;
      counts.cacheHits = 0;
      counts.budgetDenied = 0;
      cache.clear();
      journal.clear();
      budget.reset();
    },
  };
}

/** Re-export so callers can build a candidate list for `choose`. */
export type { ChooserCandidate };
