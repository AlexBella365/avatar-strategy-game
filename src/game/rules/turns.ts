// Authoritative victory checker + round loop. Spec §3, §8, §12A.5–§12A.6 + v0.3.
import type { GameState } from "../types";
import { MAX_ROUNDS, nextRandom } from "../state";
import { CARD_ECONOMY } from "../content/economy";
import { ECONOMY_TUNING } from "../content/economy";
import { tuningOf } from "../content/balance";
import { tickStatusesEndOfRound } from "./statuses";
import { tickRegeneration } from "./healing";
import { tickTerrainEndOfRound } from "./terrain";

function teamOf(state: GameState, ownerId: string) {
  return state.characters.filter((c) => c.ownerId === ownerId);
}

/** Health share of a team (0..1). Descriptive stat for the self-play report. */
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
    // Rule (v0.4): reaching the round cap without a knockout is a draw.
    // There are no health-share or survivor tiebreakers.
    state.isDraw = true;
    state.log.push(`Round limit reached (${state.maxRounds || MAX_ROUNDS} rounds) — draw.`);
  }
}

/**
 * Draw up to `n` cards from deck to team hand (reshuffling discard when the
 * deck runs dry). Deterministic via state.rng.
 */
export function drawCards(state: GameState, playerId: string, n: number): string[] {
  const events: string[] = [];
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return events;
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (player.deck.length === 0) {
      if (player.discard.length === 0) break;
      player.deck = [...player.discard];
      player.discard = [];
      // Fisher-Yates with the match PRNG stream.
      for (let k = player.deck.length - 1; k > 0; k--) {
        const j = Math.floor(nextRandom(state) * (k + 1));
        [player.deck[k], player.deck[j]] = [player.deck[j], player.deck[k]];
      }
      events.push(`${playerId} reshuffles the discard into the deck.`);
    }
    player.teamHand.push(player.deck.shift()!);
    drawn += 1;
  }
  if (drawn > 0) events.push(`${playerId} draws ${drawn}.`);
  return events;
}

/**
 * Bank leftover team-hand cards for their chi (identities hidden).
 * Assigned-but-unplayed cards auto-scrap the same way.
 */
export function bankLeftovers(state: GameState, playerId: string): string[] {
  const events: string[] = [];
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return events;
  for (const [characterId, assigned] of Object.entries(player.assignments)) {
    if (assigned) {
      const value = CARD_ECONOMY[assigned.definitionId]?.value ?? 1;
      player.chi += value;
      player.discard.push(assigned);
      player.assignments[characterId] = null;
      events.push(`${playerId} auto-scraps an unplayed card (+${value} chi; identity hidden).`);
    }
  }
  if (player.teamHand.length > 0) {
    let gained = 0;
    for (const instance of player.teamHand) {
      gained += CARD_ECONOMY[instance.definitionId]?.value ?? 1;
      player.discard.push(instance);
    }
    const count = player.teamHand.length;
    player.teamHand = [];
    player.chi += gained;
    events.push(`${playerId} auto-banks ${count} unassigned card(s) (+${gained} chi).`);
  }
  return events;
}

/** Living characters that have not activated this round. */
export function pendingActivations(state: GameState): string[] {
  return state.characters
    .filter((c) => c.health > 0 && !c.activatedThisRound)
    .map((c) => c.id);
}

/**
 * Who holds the current activation (rules §3: players alternate one
 * character at a time, initiative acts first, initiative swaps each round).
 *
 * Derived rather than stored: the next mover is the eligible owner with the
 * fewest completed activations this round (ties -> initiative). While both
 * sides still have characters left that means strict alternation; once one
 * side is exhausted the other finishes its remaining activations, and a KO'd
 * character is simply never pending. `null` = the round's activations are
 * over (call `endRound`).
 */
export function activationOwner(state: GameState): string | null {
  if (state.winnerId !== null || state.isDraw) return null;
  const alive = state.characters.filter((c) => c.health > 0);
  const pending = new Set(pendingActivations(state));
  if (pending.size === 0) return null;
  const owners = [...new Set(alive.map((c) => c.ownerId))];
  if (owners.length === 0) return null;
  const done = new Map<string, number>(owners.map((o) => [o, 0]));
  for (const c of alive) {
    if (!pending.has(c.id)) done.set(c.ownerId, (done.get(c.ownerId) ?? 0) + 1);
  }
  const rank = (o: string): number => (o === state.initiativePlayerId ? 0 : 1);
  const eligible = owners.filter((o) =>
    alive.some((c) => c.ownerId === o && pending.has(c.id)),
  );
  const [mover] = eligible.sort(
    (a, b) =>
      (done.get(a) ?? 0) - (done.get(b) ?? 0) ||
      rank(a) - rank(b) ||
      (a < b ? -1 : 1),
  );
  return mover ?? null;
}

/** Whether a character may act now (life + not yet activated + holds the turn). */
export function canActivate(state: GameState, characterId: string): boolean {
  if (state.winnerId !== null || state.isDraw) return false;
  const c = state.characters.find((ch) => ch.id === characterId);
  if (!c || c.health <= 0 || c.activatedThisRound) return false;
  const owner = activationOwner(state);
  return owner !== null && c.ownerId === owner;
}

/**
 * End-of-round phase (§8 phase 5) + next-round setup, or match end.
 * Order: Avatar duration → statuses → regeneration → terrain → Momentum →
 * victory (the round limit applies at `maxRounds`) → refresh/advance.
 */
export function endRound(state: GameState): string[] {
  const events: string[] = [];
  if (state.winnerId !== null || state.isDraw) {
    events.push("The match is already over.");
    return events;
  }
  // v0.3: unplayed assignments auto-scrap, leftovers auto-bank — then effects.
  for (const player of state.players) events.push(...bankLeftovers(state, player.id));
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
  events.push(...tickRegeneration(state));
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
  // Next round: refresh, reset, alternate initiative.
  state.round += 1;
  state.roundEventLog = []; // per-round synergy/resonance tracking resets
  const energyPerRound = tuningOf(state).energyPerRound;
  for (const player of state.players) {
    player.energy = energyPerRound;
    events.push(...drawCards(state, player.id, ECONOMY_TUNING.drawPerRound));
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
