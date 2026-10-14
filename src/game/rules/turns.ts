// Authoritative victory checker + round loop. Spec §3, §8, §12A.6.
// The full round loop lands in step 5; the victory checker is needed now so
// damage, hazards, and entry triggers end the match authoritatively.
import type { GameState } from "../types";
import { MAX_ROUNDS } from "../state";

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
