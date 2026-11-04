// Track B barrel + environment configuration. Import from here in app code;
// nothing outside this directory may depend on the LLM layer (deleting the
// folder must leave Track A intact; specs/npc_ai_plan.md §3).
export * from "./types";
export * from "./json";
export * from "./hash";
export * from "./client";
export * from "./budget";
export * from "./cache";
export * from "./journal";
export * from "./digest";
export * from "./strategy";
export * from "./chooser";
export * from "./advisor";

import type { LlmConfig, LlmWire } from "./types";

export type EnvLike = Record<string, string | undefined>;

function truthy(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

function numeric(value: string | undefined, fallback: number): number {
  const n = value === undefined ? NaN : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function pickWire(value: string | undefined, baseUrl: string): LlmWire {
  if (value === "openai" || value === "ollama") return value;
  // Auto: a local endpoint is almost certainly Ollama.
  return /(localhost|127\.0\.0\.1|:11434)/.test(baseUrl) ? "ollama" : "openai";
}

/** Feature flag: Track B is off unless explicitly enabled. */
export function llmEnabledFromEnv(env: EnvLike = {}): boolean {
  return truthy(env.VITE_AI_LLM);
}

/** True when the runtime can actually make a request (guards older runtimes). */
export function llmRuntimeReady(): boolean {
  return typeof fetch === "function";
}

/** Convenience: enabled *and* runnable. The only check the UI needs. */
export function llmActive(env: EnvLike = {}): boolean {
  return llmEnabledFromEnv(env) && llmRuntimeReady();
}

/**
 * Build an `LlmConfig` from env. Defaults target a local Ollama server so the
 * whole thing works offline with zero cost.
 *
 *   VITE_AI_LLM=1                      enable Track B (default: off)
 *   VITE_LLM_BASE_URL                  default http://localhost:11434
 *   VITE_LLM_MODEL                     default qwen3.5:0.8b
 *   VITE_LLM_WIRE=openai|ollama        default: auto (local ⇒ ollama)
 *   VITE_LLM_KEY                       bearer token for hosted endpoints
 *   VITE_LLM_TIMEOUT_MS                default 2500 (hard UI deadline)
 *   VITE_LLM_TEMPERATURE               default 0.2
 *   VITE_LLM_MAX_TOKENS                default 200
 */
export function llmConfigFromEnv(env: EnvLike = {}): LlmConfig {
  const baseUrl = env.VITE_LLM_BASE_URL ?? "http://localhost:11434";
  return {
    baseUrl,
    model: env.VITE_LLM_MODEL ?? "qwen3.5:0.8b",
    apiKey: env.VITE_LLM_KEY,
    wire: pickWire(env.VITE_LLM_WIRE, baseUrl),
    timeoutMs: numeric(env.VITE_LLM_TIMEOUT_MS, 2500),
    temperature: numeric(env.VITE_LLM_TEMPERATURE, 0.2),
    maxTokens: numeric(env.VITE_LLM_MAX_TOKENS, 200),
  };
}
