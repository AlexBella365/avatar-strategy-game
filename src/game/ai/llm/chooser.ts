// Mode 2 — top-k action chooser (specs/npc_ai_plan.md §3 B.2).
//
// Track A scores every candidate; when the top two are close (the utility
// scorer is *not* confident) we may ask the model to pick among the top k by
// index. The choice is validated against the offered set: anything else is an
// argmax fallback. The rationale is pure flavor text for the debug overlay.
//
// Cheap gate: when the top-2 gap is wide we never call the model at all.
import type { Scored } from "../types";
import { fail, ok, parseJsonObject, vFinite, vObject, vOptional, vString, type Parsed } from "./json";
import type { ChatMessage, ChooserAdvice } from "./types";

/** Ask only when top-2 gap ≤ this fraction of the best score. */
export const CONFIDENCE_GAP = 0.12;

/** How many ranked candidates are serialized for the model. */
export const TOP_K = 5;

export interface ChooserCandidate {
  id: number;
  label: string;
  scores: Record<string, number>;
}

/** Gap between the best and second-best score (Infinity when < 2 candidates). */
export function topTwoGap(ranked: { score: number }[]): number {
  if (ranked.length < 2) return Infinity;
  return ranked[0].score - ranked[1].score;
}

/** Should the model be consulted for this decision? */
export function shouldAsk(
  ranked: { score: number }[],
  gap = CONFIDENCE_GAP,
): boolean {
  if (ranked.length < 2) return false;
  const best = Math.max(0.5, Math.abs(ranked[0].score));
  return topTwoGap(ranked) <= gap * best;
}

function roundScores(components: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(components)) out[k] = Math.round(v * 100) / 100;
  return out;
}

/** Serialize the top-k scored candidates as stable, model-friendly data. */
export function toCandidates<T>(ranked: Scored<T>[], k = TOP_K): ChooserCandidate[] {
  return ranked.slice(0, k).map((s, index) => ({
    id: index,
    label: s.label,
    scores: roundScores(s.components),
  }));
}

export const CHOOSER_SYSTEM = [
  "You are choosing one action in a small grid combat game.",
  "You may only pick one of the offered options by id. The engine validates legality.",
  'Reply with ONLY compact JSON, no prose or markdown, exactly:',
  '{"choiceId":0,"rationale":"<12 words max>"}',
].join(" ");

export function buildChooserMessages(
  digest: string,
  candidates: ChooserCandidate[],
): ChatMessage[] {
  const options = candidates
    .map((c) => `${c.id}. ${c.label}  scores=${JSON.stringify(c.scores)}`)
    .join("\n");
  return [
    { role: "system", content: CHOOSER_SYSTEM },
    {
      role: "user",
      content: `${digest}\n\nOptions:\n${options}\n\nPick the best option id.`,
    },
  ];
}

const CHOOSER_SHAPE = vObject<{ choiceId: number; rationale?: string }>({
  choiceId: vFinite(0, 1e9),
  rationale: vOptional(vString()),
});

/** Validate a reply against the offered count; out-of-range ⇒ failure. */
export function parseChooserReply(text: string, count: number): Parsed<ChooserAdvice> {
  const json = parseJsonObject(text);
  if (!json.ok) return json;
  const parsed = CHOOSER_SHAPE(json.value);
  if (!parsed.ok) return parsed;
  const id = Math.trunc(parsed.value.choiceId);
  if (count <= 0 || id < 0 || id >= count) {
    return fail(`choiceId ${id} out of range 0..${count - 1}`);
  }
  return ok({ choiceId: id, rationale: parsed.value.rationale ?? "" });
}
