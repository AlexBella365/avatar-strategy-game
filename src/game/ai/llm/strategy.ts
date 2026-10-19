// Mode 1 — round-level strategy advisor (specs/npc_ai_plan.md §3 B.1).
//
// One call per round per LLM-controlled side at most. The model returns a
// stance + risk tolerance; we turn that into *clamped* weight deltas that are
// merged onto the Track A personality vector. Failure ⇒ no advice, and the
// caller keeps its previous stance / the default.
import { parseJsonObject, vEnum, vFinite, vObject, vOptional, vString, type Parsed } from "./json";
import { LlmError, STANCES } from "./types";
import type { ChatMessage, Stance, StrategyAdvice, StrategyReply } from "./types";
import type { Weights } from "../types";

/** Maximum magnitude of any single weight delta the LLM may request. */
export const DELTA_CLAMP = 0.3;

/** Per-stance weight deltas (merged onto the resolved personality vector). */
export const STANCE_DELTAS: Record<Stance, Partial<Weights>> = {
  aggressive: {
    damage: 0.25,
    kill: 0.2,
    positioning: 0.1,
    focusFire: 0.15,
    safety: -0.2,
    survival: -0.2,
    cover: -0.15,
  },
  standard: {},
  cautious: {
    damage: -0.15,
    safety: 0.15,
    cover: 0.15,
    survival: 0.2,
    economy: 0.1,
    positioning: -0.05,
  },
  turtle: {
    damage: -0.25,
    safety: 0.25,
    cover: 0.25,
    survival: 0.3,
    support: 0.15,
    positioning: -0.2,
  },
};

export const STRATEGY_SYSTEM = [
  "You are a tactical advisor for a small grid combat game.",
  "You only advise; the game engine decides what is legal.",
  'Reply with ONLY compact JSON, no prose or markdown, exactly:',
  '{"stance":"aggressive|standard|cautious|turtle","focusTarget":"<enemy id or omit>","riskTolerance":0.0,"notes":"<8 words max>"}',
  "aggressive = press damage; cautious = protect HP; turtle = hold position and heal.",
].join(" ");

export function buildStrategyMessages(digest: string): ChatMessage[] {
  return [
    { role: "system", content: STRATEGY_SYSTEM },
    { role: "user", content: `${digest}\n\nChoose a stance for this round.` },
  ];
}

const STRATEGY_SHAPE = vObject<{
  stance: Stance;
  focusTarget?: string;
  riskTolerance?: number;
  notes?: string;
}>({
  stance: vEnum(STANCES),
  focusTarget: vOptional(vString()),
  riskTolerance: vOptional(vFinite(0, 1)),
  notes: vOptional(vString()),
});

/** Validate raw model text into a `StrategyReply` (never throws). */
export function parseStrategyReply(text: string): Parsed<StrategyReply> {
  const json = parseJsonObject(text);
  if (!json.ok) return json;
  return STRATEGY_SHAPE(json.value);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function mergeDeltas(...parts: Partial<Weights>[]): Partial<Weights> {
  const out: Partial<Weights> = {};
  for (const part of parts) {
    for (const [k, v] of Object.entries(part) as [keyof Weights, number][]) {
      if (typeof v !== "number") continue;
      const next = clamp((out[k] ?? 0) + v, -DELTA_CLAMP, DELTA_CLAMP);
      out[k] = next;
    }
  }
  return out;
}

/**
 * Resolve a validated reply into clamped weight deltas. `riskTolerance` (0..1,
 * default 0.5) nudges the stance: higher risk trades safety for damage.
 */
export function toAdvice(reply: StrategyReply): StrategyAdvice {
  const risk = clamp(reply.riskTolerance ?? 0.5, 0, 1);
  const r = (risk - 0.5) * 2; // -1..1
  const riskDelta: Partial<Weights> = {
    damage: 0.15 * r,
    positioning: 0.1 * r,
    safety: -0.15 * r,
    survival: -0.1 * r,
  };
  return {
    stance: reply.stance,
    focusTarget: reply.focusTarget?.trim() || undefined,
    riskTolerance: risk,
    notes: reply.notes?.trim() || undefined,
    deltas: mergeDeltas(STANCE_DELTAS[reply.stance], riskDelta),
  };
}

/** Parse + resolve in one step; throws only on a malformed reply. */
export function resolveStrategy(text: string): StrategyAdvice {
  const parsed = parseStrategyReply(text);
  if (!parsed.ok) throw new LlmError("schema", parsed.error);
  return toAdvice(parsed.value);
}

/** Merge advice deltas onto a base weight vector; weights never go negative. */
export function applyStrategy(base: Weights, advice: StrategyAdvice | undefined): Weights {
  if (!advice) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(advice.deltas) as [keyof Weights, number][]) {
    if (typeof v === "number") out[k] = Math.max(0, base[k] + v);
  }
  return out;
}
