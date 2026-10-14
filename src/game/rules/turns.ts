// Authoritative victory checker + round loop. Spec §3, §8, §12A.5–§12A.6.
import type { GameState } from "../types";
import { ENERGY_PER_ROUND, MAX_ROUNDS } from "../state";
import { tickStatusesEndOfRound } from "./statuses";
import { tickTerrainEndOfRound } from "./terrain";

function teamOf(state: GameState, ownerId: string) {
  return state.characters.filter((c) => c.ownerId === ownerId);
}

/** Health share of a team (0..1) for the round-8 tiebreaker. */
export function teamHealthShare(state: GameState, ownerId: string): number {
  const team = teamOf(state, ownerId);
  const max = team.reduce((sum, c) => sum + c.maxHealth, 0);
  if (max <= 0) return 0;
  return team.reduce((sum, c) => sum + Math.max(0, c.health), 0) / max;
}

/**
 * Recompute winnerId/isDraw. Immediate conditions (full knockout,
 * active-Avatar loss) apply any time; the round limit only applies when
 * `applyRoundLimit` is set by the end-of-round flow (step 5).
 */
export function updateMatchResult(
  state: GameState,
  opts: { applyRoundLimit?: boolean } = {},
): void {
  if (state.winnerId !== null || state.isDraw) return;
  const owners = [...new Set(state.characters.map((c) => c.ownerId))];
  // Existential risk first: active Avatar KO ends the match immediately.
  for (const c of state.characters) {
    if (c.avatarState?.active && c.health <= 0) {
      const opponent = owners.find((o) => o !== c.ownerId);
      state.winnerId = opponent ?? null;
      state.isDraw = state.winnerId === null;
      state.log.push(
        `${c.definitionId} fell while in Avatar State — ${state.winnerId ?? "no one"} wins.`,
      );
      return;
    }
  }
  const aliveByOwner = new Map(owners.map((o) => [o, teamOf(state, o).some((c) => c.health > 0)]));
  const aliveOwners = owners.filter((o) => aliveByOwner.get(o));
  if (aliveOwners.length === 0) {
    state.isDraw = true;
    state.log.push("All characters knocked out — draw.");
    return;
  }
  if (aliveOwners.length === 1 && owners.length > 1) {
    state.winnerId = aliveOwners[0];
    state.log.push(`${state.winnerId} wins by knockout.`);
    return;
  }
  if (opts.applyRoundLimit && state.round >= (state.maxRounds || MAX_ROUNDS)) {
    const [a, b] = owners;
    if (b === undefined) {
      state.winnerId = a;
      return;
    }
    const shareA = teamHealthShare(state, a);
    const shareB = teamHealthShare(state, b);
    if (shareA !== shareB) {
      state.winnerId = shareA > shareB ? a : b;
    } else {
      const countA = teamOf(state, a).filter((c) => c.health > 0).length;
      const countB = teamOf(state, b).filter((c) => c.health > 0).length;
      if (countA !== countB) state.winnerId = countA > countB ? a : b;
      else state.isDraw = true;
    }
    state.log.push(
      state.isDraw ? "Round limit reached — draw." : `${state.winnerId} wins on tiebreakers.`,
    );
  }
}

/** Living characters that have not activated this round. */
export function pendingActivations(state: GameState): string[] {
  return state.characters
    .filter((c) => c.health > 0 && !c.activatedThisRound)
    .map((c) => c.id);
}

/** Whether a character may act now (turn order is driven by the UI/hot-seat). */
export function canActivate(state: GameState, characterId: string): boolean {
  if (state.winnerId !== null || state.isDraw) return false;
  const c = state.characters.find((ch) => ch.id === characterId);
  return !!c && c.health > 0 && !c.activatedThisRound;
}

/**
 * End-of-round phase (§8 phase 5) + next-round setup, or match end.
 * Order: Avatar duration → statuses → terrain → Momentum → victory
 * (round limit applies at round 8) → refresh/advance when continuing.
 */
export function endRound(state: GameState): string[] {
  const events: string[] = [];
  if (state.winnerId !== null || state.isDraw) {
    events.push("The match is already over.");
    return events;
  }
  // Avatar State duration counts down each end-of-round (§12A.5).
  for (const c of state.characters) {
    if (c.avatarState?.active) {
      c.avatarState.roundsRemaining -= 1;
      if (c.avatarState.roundsRemaining <= 0) {
        c.avatarState.active = false;
        c.avatarState.roundsRemaining = 0;
        events.push(`${c.definitionId}'s Avatar State ends.`);
      } else {
        events.push(
          `${c.definitionId}'s Avatar State: ${c.avatarState.roundsRemaining} round(s) left.`,
        );
      }
    }
  }
  events.push(...tickStatusesEndOfRound(state));
  events.push(...tickTerrainEndOfRound(state));
  if (state.winnerId !== null || state.isDraw) {
    state.log.push(...events);
    return events;
  }
  let momentumCleared = false;
  for (const c of state.characters) {
    if (c.momentum !== 0) {
      c.momentum = 0;
      momentumCleared = true;
    }
    c.techniqueBlockedThisActivation = false;
  }
  if (momentumCleared) events.push("Momentum expires.");
  updateMatchResult(state, { applyRoundLimit: state.round >= (state.maxRounds || MAX_ROUNDS) });
  if (state.winnerId !== null || state.isDraw) {
    state.log.push(...events);
    return events;
  }
  // Next round: refresh, reset, alternate initiative, clear intentions.
  state.round += 1;
  for (const player of state.players) {
    player.energy = ENERGY_PER_ROUND;
    player.intentions = {};
  }
  for (const c of state.characters) {
    c.activatedThisRound = false;
    c.reactionUsedThisRound = false;
    c.movementSpent = 0;
    c.passiveUsesThisRound = {};
    const before = c.shields.length;
    c.shields = c.shields.filter((s) => s.duration !== "untilNextRound");
    if (c.shields.length < before) events.push(`${c.definitionId}'s fading shields expire.`);
  }
  const owners = [...new Set(state.characters.map((c) => c.ownerId))];
  const other = owners.find((o) => o !== state.initiativePlayerId);
  if (other !== undefined) state.initiativePlayerId = other;
  events.push(`Round ${state.round} begins (initiative: ${state.initiativePlayerId}).`);
  state.log.push(...events);
  return events;
}
