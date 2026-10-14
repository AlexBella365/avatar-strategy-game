// Avatar State: Resonance buildup + activation. Spec §12A.
// Generic over Avatar-capable definitions; only Aang in the MVP roster.
// Per-round caps ride on roundEventLog so no extra state is needed.
import { CHARACTERS } from "../content/characters";
import type { ActionError, GameState } from "../types";

export const RESONANCE_PER_ROUND_CAP = 2;

function avatarDefOf(characterDefinitionId: string) {
  return CHARACTERS.find((d) => d.id === characterDefinitionId)?.avatarState;
}

/**
 * Award 1 Resonance. Returns the log message, or null when no gain applies.
 * Enforces: Avatar-capable only, suppressed while active, threshold cap,
 * max 2 gains per round. Callers append the message to their event stream.
 */
export function gainResonance(
  state: GameState,
  characterId: string,
  reason: string,
): string | null {
  const c = state.characters.find((ch) => ch.id === characterId);
  if (!c || c.health <= 0) return null;
  const def = avatarDefOf(c.definitionId);
  const status = c.avatarState;
  if (!def?.enabled || !status || status.active) return null;
  if (status.resonance >= def.threshold) return null;
  const gains = state.roundEventLog.filter((e) => e === `resonance:${characterId}`).length;
  if (gains >= RESONANCE_PER_ROUND_CAP) return null;
  status.resonance = Math.min(def.threshold, status.resonance + 1);
  state.roundEventLog.push(`resonance:${characterId}`);
  return `${c.definitionId} gains Resonance (${status.resonance}/${def.threshold}): ${reason}.`;
}

/** Elemental-practice credit: distinct elements resolved this round. */
export function creditElementalPractice(
  state: GameState,
  characterId: string,
  element: string,
): string | null {
  if (!noteElementResolved(state, characterId, element)) return null;
  return gainResonance(state, characterId, `elemental practice (${element})`);
}

/**
 * Record that a technique of `element` resolved (fresh-use detection).
 * Usage is a fact about the resolution even when the single-gain rule
 * awards that event's Resonance to a different trigger.
 */
export function noteElementResolved(
  state: GameState,
  characterId: string,
  element: string,
): boolean {
  const c = state.characters.find((ch) => ch.id === characterId);
  if (!c || !avatarDefOf(c.definitionId)?.enabled) return false;
  const key = `avatar-element:${characterId}:${element}`;
  if (state.roundEventLog.includes(key)) return false;
  state.roundEventLog.push(key);
  return true;
}

/** Protective-instinct credit: first qualifying defense each round. */
export function creditProtection(state: GameState, characterId: string): string | null {
  const c = state.characters.find((ch) => ch.id === characterId);
  if (!c || !avatarDefOf(c.definitionId)?.enabled) return null;
  const key = `avatar-protect:${characterId}`;
  if (state.roundEventLog.includes(key)) return null;
  state.roundEventLog.push(key);
  return gainResonance(state, characterId, "protective instinct");
}

/** Spiritual-pressure credit: first 3+ HP loss from one enemy action. */
export function creditPressure(state: GameState, characterId: string): string | null {
  const c = state.characters.find((ch) => ch.id === characterId);
  if (!c || !avatarDefOf(c.definitionId)?.enabled) return null;
  const key = `avatar-pressure:${characterId}`;
  if (state.roundEventLog.includes(key)) return null;
  state.roundEventLog.push(key);
  return gainResonance(state, characterId, "spiritual pressure");
}

export interface AvatarActivation {
  ok: boolean;
  errors: ActionError[];
  events: string[];
}

/** Activate Avatar State on the character's own activation (spec §12A.3). */
export function activateAvatarState(state: GameState, characterId: string): AvatarActivation {
  const c = state.characters.find((ch) => ch.id === characterId);
  if (!c) return { ok: false, errors: [{ code: "SOURCE_MISSING", message: "Unknown character." }], events: [] };
  const fail = (code: string, message: string): AvatarActivation => ({
    ok: false,
    errors: [{ code, message }],
    events: [],
  });
  const def = avatarDefOf(c.definitionId);
  const status = c.avatarState;
  if (!def?.enabled || !status)
    return fail("NOT_AVATAR_CAPABLE", `${c.definitionId} cannot enter Avatar State.`);
  if (c.health <= 0)
    return fail("SOURCE_KNOCKED_OUT", "Knocked-out characters cannot act.");
  if (status.activatedThisMatch)
    return fail("ALREADY_USED", "Avatar State can trigger only once per match.");
  if (status.active) return fail("ALREADY_ACTIVE", "Avatar State is already active.");
  if (status.resonance < def.threshold)
    return fail(
      "RESONANCE_NOT_READY",
      `Needs ${def.threshold} Resonance, has ${status.resonance}.`,
    );
  if (c.activatedThisRound)
    return fail("ALREADY_ACTIVATED", "Avatar State must trigger on a fresh activation.");
  if (c.focus < def.activationFocusCost)
    return fail(
      "INSUFFICIENT_FOCUS",
      `Needs ${def.activationFocusCost} Focus, has ${c.focus}.`,
    );
  c.focus -= def.activationFocusCost;
  status.active = true;
  status.roundsRemaining = def.durationRounds;
  status.activatedThisMatch = true;
  status.resonance = 0;
  c.techniqueBlockedThisActivation = true;
  const events = [
    `${c.definitionId} enters AVATAR STATE for ${def.durationRounds} rounds! ` +
      `If this Avatar is knocked out, their team immediately loses.`,
  ];
  return { ok: true, errors: [], events };
}
