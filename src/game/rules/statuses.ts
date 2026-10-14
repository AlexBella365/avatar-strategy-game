// Status registry + application/removal. Spec §11.
// MVP statuses do not stack; reapplication refreshes duration.
import { nextId } from "../state";
import type { CharacterState, GameState, StatusId } from "../types";

export const STATUS_IDS: StatusId[] = ["OffBalance", "Exposed", "Bound", "Exhausted"];

export function getCharacterOrThrow(state: GameState, id: string): CharacterState {
  const c = state.characters.find((ch) => ch.id === id);
  if (!c) throw new Error(`Unknown character: ${id}`);
  return c;
}

export function hasStatus(c: CharacterState, statusId: StatusId): boolean {
  return c.statuses.some((s) => s.statusId === statusId);
}

/** Apply a status (refresh if present). Returns a log event. */
export function applyStatus(
  state: GameState,
  characterId: string,
  statusId: StatusId,
  duration: number,
): string {
  const c = getCharacterOrThrow(state, characterId);
  const existing = c.statuses.find((s) => s.statusId === statusId);
  if (existing) {
    existing.remainingRounds = duration;
    return `${c.definitionId} refreshes ${statusId} (${duration}).`;
  }
  c.statuses.push({ id: nextId("status"), statusId, remainingRounds: duration });
  return `${c.definitionId} gains ${statusId} (${duration}).`;
}

/** Remove all instances of a status. Returns a log event, or "" if absent. */
export function removeStatus(
  state: GameState,
  characterId: string,
  statusId: StatusId,
): string {
  const c = getCharacterOrThrow(state, characterId);
  const before = c.statuses.length;
  c.statuses = c.statuses.filter((s) => s.statusId !== statusId);
  return c.statuses.length < before ? `${c.definitionId} loses ${statusId}.` : "";
}

/** Decrement durations; drop expired. Called by the round loop (step 5). */
export function tickStatusesEndOfRound(state: GameState): string[] {
  const events: string[] = [];
  for (const c of state.characters) {
    if (c.health <= 0) continue;
    for (const s of c.statuses) s.remainingRounds -= 1;
    const expired = c.statuses.filter((s) => s.remainingRounds <= 0);
    c.statuses = c.statuses.filter((s) => s.remainingRounds > 0);
    for (const s of expired) events.push(`${c.definitionId}'s ${s.statusId} expires.`);
  }
  return events;
}
