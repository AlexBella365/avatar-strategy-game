// Track A ring buffer of recent NPC decisions, feeding the debug overlay
// ("why did the NPC do that?"). Append-only; capped; no engine coupling.
import type { DecisionTrace } from "./types";

const CAP = 200;
const buffer: DecisionTrace[] = [];

export function recordDecision(trace: DecisionTrace): void {
  buffer.push(trace);
  if (buffer.length > CAP) buffer.shift();
}

/** Most-recent-last copy of the retained decisions. */
export function recentDecisions(): DecisionTrace[] {
  return [...buffer];
}

export function clearDecisions(): void {
  buffer.length = 0;
}
