// Track B (optional LLM layer) shared types.
//
// Governing principle (specs/npc_ai_plan.md §3 B.0): the LLM *advises* the
// Track A utility policy. Every output is either a modifier to weights or a
// choice within the already-legal candidate set; invalid, late, or missing
// output falls back to Track A argmax. Deleting this directory must leave
// Track A fully functional.
import type { Weights } from "../types";

/** Wire format. `ollama` uses the native /api/chat (see client.ts for why). */
export type LlmWire = "openai" | "ollama";

export interface LlmConfig {
  /** Base URL *without* the method path, e.g. http://localhost:11434 or https://api.openai.com/v1 */
  baseUrl: string;
  model: string;
  apiKey?: string;
  wire: LlmWire;
  timeoutMs: number;
  temperature: number;
  maxTokens: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmResponse {
  text: string;
  usage: LlmUsage;
  latencyMs: number;
}

export interface HttpRequestInit {
  method: "POST";
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

/**
 * Injectable HTTP seam. The real implementation wraps `fetch`; tests pass a
 * fake so **no test ever hits the network** (specs/npc_ai_plan.md §3 B.4/B.7).
 */
export type HttpPost = (
  url: string,
  init: HttpRequestInit,
) => Promise<{ status: number; body: unknown }>;

export type LlmErrorKind =
  | "network"
  | "http"
  | "timeout"
  | "parse"
  | "schema"
  | "disabled"
  | "budget";

export class LlmError extends Error {
  readonly kind: LlmErrorKind;
  constructor(kind: LlmErrorKind, message: string) {
    super(message);
    this.name = "LlmError";
    this.kind = kind;
  }
}

/** Round-level stance (Mode 1). */
export type Stance = "aggressive" | "standard" | "cautious" | "turtle";
export const STANCES: readonly Stance[] = [
  "aggressive",
  "standard",
  "cautious",
  "turtle",
];

/** Raw Mode-1 model output, before it is turned into weight deltas. */
export interface StrategyReply {
  stance: Stance;
  focusTarget?: string;
  riskTolerance?: number;
  notes?: string;
}

/** Resolved Mode-1 advice: clamped weight deltas plus display strings. */
export interface StrategyAdvice {
  stance: Stance;
  focusTarget?: string;
  riskTolerance: number;
  notes?: string;
  deltas: Partial<Weights>;
}

/** Mode-2 model output: a pick within the offered candidate set. */
export interface ChooserAdvice {
  choiceId: number;
  rationale: string;
}

/** Observability counters for the debug overlay / tests. */
export interface AdvisorMetrics {
  calls: number;
  failures: number;
  fallbacks: number;
  cacheHits: number;
  budgetDenied: number;
}
