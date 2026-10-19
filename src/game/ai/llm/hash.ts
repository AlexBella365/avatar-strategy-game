// Deterministic hashing for the LLM layer. Used for two things only:
//   * cache keys (identical situation ⇒ zero calls; specs/npc_ai_plan.md §3 B.4)
//   * staleness checks + journal keys (a response is applied only if the state
//     it was requested for is still current; §3 B.5)
import type { GameState } from "../../types";

/** Deterministic JSON: object keys sorted, so equal states hash equal. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/** FNV-1a (32-bit) as 8 hex chars: cheap and stable across runs/engines. */
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Fingerprint of the *whole* state for a given side. Hashing everything (not
 * just the visible digest) is deliberate: it is the strictest possible
 * staleness test, and the hash is never sent to the model.
 */
export function stateHash(state: GameState, playerId: string): string {
  return hashString(`${playerId}|${stableStringify(state)}`);
}
