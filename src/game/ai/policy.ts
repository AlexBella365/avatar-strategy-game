// Track A utility policy: one authorized GameAction per call, chosen by
// scoring candidates on simulated outcomes.
//
// Control flow mirrors the original auto-player so termination is preserved
// (only PASS_ACTIVATION ends an activation):
//   1. Avatar State activation (scored payoff vs. KO risk)
//   2. Move, if movement remains (scored vs. staying put)
//   3. Play or scrap the assigned card (scored over all legal targets)
//   4. Assign the best playable hand card, else
//   5. Basic attack (adjacent enemy) or basic defense (cardless fallback)
//
// The policy only *proposes* actions; applyGameAction remains the authority and
// every emitted action is re-checked before it leaves (see `commit`).
//
// Phase A3 (one-ply lookahead) is deliberately not implemented yet — see
// specs/npc_ai_plan.md §2.A.7.
import { getCardDefinition } from "../content/cards";
import { CHARACTERS } from "../content/characters";
import { restrictionSatisfied } from "../content/economy";
import { applyGameAction } from "../rules/cards";
import { activationOwner } from "../rules/turns";
import { key, manhattan, reachableTiles } from "../rules/grid";
import { movementAllowance } from "../rules/movement";
import { hasStatus } from "../rules/statuses";
import { getLegalTargets } from "../rules/targeting";
import { blockingTiles, difficultTiles } from "../rules/terrain";
import type {
  CardDefinition,
  CardInstance,
  CharacterDefinition,
  CharacterState,
  GameAction,
  GameState,
  Position,
  TargetSelection,
} from "../types";
import { resolveWeights } from "./personalities";
import {
  avatarScore,
  canAfford,
  scoreCardPotential,
  scorePlay,
  scorePosition,
  type PlayValue,
} from "./scoring";
import { recordDecision } from "./traceLog";
import type {
  AiDecision,
  ChooseAiOptions,
  DecisionTrace,
  Scored,
  Weights,
} from "./types";

/** Candidates within this fraction of the best are near-ties (variety). */
const DEFAULT_TIE_BAND = 0.06;
/**
 * Play below this score is scrapped (banked for chi) instead.
 *
 * Must stay near zero: an assigned card that is not played is auto-scrapped
 * at round end anyway, so a legal, affordable play with any positive value is
 * at least as good as banking it. The old 0.15 threshold was above the whole
 * score of a 2-damage attack for `cautious`/`support` archetypes
 * (≈0.09–0.13), so Aang and Katara scrapped every attack card they drew and
 * the hero team barely dealt damage.
 */
const SCRAP_THRESHOLD = 0.01;
/** Avatar State activates at or above this score. */
const AVATAR_THRESHOLD = 0.5;
/** A move must beat "stay" by this margin to be worth the movement point. */
const MOVE_MARGIN = 0.04;
/** Cap on simulated target candidates per card (board is tiny; keeps it bounded). */
const TARGET_CAP = 48;

const OCCUPANT_EFFECTS = new Set<string>([
  "damage",
  "heal",
  "healOverTime",
  "shield",
  "applyStatus",
  "removeStatus",
  "push",
  "pull",
  "swap",
  "disrupt",
]);

function byId(a: CharacterState, b: CharacterState): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function defFor(c: CharacterState): CharacterDefinition | undefined {
  return CHARACTERS.find((d) => d.id === c.definitionId);
}

/** Sort desc by score, then pick uniformly among the near-ties (seeded). */
function select<T>(
  candidates: Scored<T>[],
  random: () => number,
  tieBand: number,
  top: number,
): { chosen: Scored<T>; ranked: Scored<T>[] } {
  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const band = tieBand * Math.max(0.5, Math.abs(best.score));
  const near = ranked.filter((c) => c.score >= best.score - band);
  const chosen = near[Math.floor(random() * near.length)] ?? best;
  return { chosen, ranked: ranked.slice(0, Math.max(1, top)) };
}

function toTrace<T>(
  phase: DecisionTrace["phase"],
  characterId: string,
  chosen: Scored<T>,
  ranked: Scored<T>[],
  note?: string,
): DecisionTrace {
  return {
    characterId,
    phase,
    chosen: chosen.label,
    score: chosen.score,
    components: chosen.components,
    alternatives: ranked
      .filter((r) => r !== chosen)
      .map((r) => ({ label: r.label, score: r.score })),
    note,
  };
}

function passAction(playerId: string, characterId: string): GameAction {
  return { type: "PASS_ACTIVATION", playerId, characterId };
}

/**
 * Emit `action` after re-validating it against the engine. Any rejection falls
 * back to PASS_ACTIVATION so the caller always makes progress (the original
 * auto-player's guarantee, now enforced here too).
 */
function commit(
  state: GameState,
  playerId: string,
  characterId: string,
  action: GameAction,
  trace: DecisionTrace,
): AiDecision {
  const check = applyGameAction(state, action);
  if (check.errors.length > 0) {
    const fallback = passAction(playerId, characterId);
    const fallbackTrace: DecisionTrace = {
      ...trace,
      chosen: `pass (fallback: ${check.errors[0].code})`,
      note: check.errors[0].message,
    };
    recordDecision(fallbackTrace);
    return { action: fallback, trace: fallbackTrace };
  }
  recordDecision(trace);
  return { action, trace };
}

// ---------------------------------------------------------------------------
// Step choosers.
// ---------------------------------------------------------------------------

/** Distance the actor wants from its nearest enemy, from a card's targeting. */
function desiredRangeForCard(card: CardDefinition): number {
  const t = card.targeting;
  switch (t.kind) {
    case "character":
      return t.range === "melee" ? 1 : t.range === "any" ? 3 : t.range;
    case "tile":
      return t.range === "any" ? 3 : t.range;
    case "area":
      return t.maxRange ?? 3;
    case "direction":
      return Math.max(1, t.maxLength);
    case "self":
      return 3;
  }
}

/**
 * Desired engagement distance from this unit's best usable damage card.
 * `null` means it has no attack option at all → close to melee and use the
 * cardless basic attack instead of idling at range.
 */
function attackRangeFor(
  state: GameState,
  player: { assignments: Record<string, CardInstance | null> },
  c: CharacterState,
  def: CharacterDefinition,
  w: Weights,
): number | null {
  const candidates: { value: number; range: number }[] = [];
  const consider = (card: CardDefinition | undefined) => {
    if (!card || !card.effects.some((e) => e.type === "damage")) return;
    candidates.push({
      value: scoreCardPotential(state, c.id, card, w),
      range: desiredRangeForCard(card),
    });
  };
  const assignedCard = player.assignments[c.id]
    ? getCardDefinition(player.assignments[c.id]!.definitionId)
    : undefined;
  if (assignedCard && canAfford(state, c.ownerId, c.id, assignedCard)) consider(assignedCard);
  const hand = state.players.find((p) => p.id === c.ownerId)?.teamHand ?? [];
  for (const instance of hand) {
    const card = getCardDefinition(instance.definitionId);
    if (!card || !canAfford(state, c.ownerId, c.id, card)) continue;
    const fits = (card.economy?.restrictions ?? []).every((r) =>
      restrictionSatisfied({ definitionId: def.id, element: def.element, role: def.role }, r),
    );
    if (fits) consider(card);
  }
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.value > a.value ? b : a)).range;
}

function chooseMove(
  state: GameState,
  c: CharacterState,
  w: Weights,
  random: () => number,
  tieBand: number,
  top: number,
  desiredRange: number,
): { chosen: Scored<Position>; ranked: Scored<Position>[] } | null {
  const allowance = movementAllowance(state, c.id) - c.movementSpent;
  if (allowance <= 0 || hasStatus(c, "Bound")) return null;
  const occupied = new Set(
    state.characters
      .filter((x) => x.health > 0 && x.id !== c.id)
      .map((x) => key(x.position)),
  );
  const reach = reachableTiles(c.position, {
    allowance,
    blocked: blockingTiles(state),
    occupied,
    difficult: difficultTiles(state),
  });

  const scoredPosition = (pos: Position, label: string): Scored<Position> => {
    const { score, components } = scorePosition(state, c.id, pos, w, desiredRange);
    return { value: pos, score, components, label };
  };
  const stay = scoredPosition(c.position, "stay put");
  const moves: Scored<Position>[] = [];
  for (const k of reach.keys()) {
    const [x, y] = k.split(",").map(Number);
    const s = scoredPosition({ x, y }, `move to (${x},${y})`);
    if (s.score >= stay.score + MOVE_MARGIN) moves.push(s);
  }
  if (moves.length === 0) return null;
  const { chosen, ranked } = select(moves, random, tieBand, top);
  return { chosen, ranked };
}

function playTargets(
  state: GameState,
  characterId: string,
  card: CardDefinition,
): TargetSelection[] {
  const options = getLegalTargets(state, characterId, card).filter((o) => o.isLegal);
  const wantsOccupant = card.effects.some((e) => OCCUPANT_EFFECTS.has(e.type));
  const areaLike = card.targeting.kind === "tile" || card.targeting.kind === "area";
  const out: TargetSelection[] = [];
  for (const o of options) {
    if (wantsOccupant && areaLike && o.affectedCharacterIds.length === 0) continue;
    out.push(o.selection);
    if (out.length >= TARGET_CAP) break;
  }
  return out;
}

function choosePlay(
  state: GameState,
  c: CharacterState,
  card: CardDefinition,
  instanceId: string,
  w: Weights,
  random: () => number,
  tieBand: number,
  top: number,
): { chosen: Scored<PlayValue>; ranked: Scored<PlayValue>[] } | null {
  const candidates: Scored<PlayValue>[] = [];
  for (const selection of playTargets(state, c.id, card)) {
    const s = scorePlay(state, c.id, card, instanceId, selection, w);
    if (s) candidates.push(s);
  }
  if (candidates.length === 0) return null;
  return select(candidates, random, tieBand, top);
}

/**
 * Cards this character could actually use *this activation*: restriction-fit,
 * affordable, and with a legal target from the current tile.
 *
 * Assignment is free and can happen any time, but a card that cannot be
 * played before the round ends is auto-scrapped anyway. Assigning only
 * playable cards stops the old assign→scrap→assign churn that burned most of
 * each side's hand for chi instead of dealing damage.
 */
function playableCards(
  state: GameState,
  playerId: string,
  c: CharacterState,
  def: CharacterDefinition,
): CardInstance[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  return player.teamHand.filter((instance) => {
    const card = getCardDefinition(instance.definitionId);
    if (!card) return false;
    const fits = (card.economy?.restrictions ?? []).every((r) =>
      restrictionSatisfied(
        { definitionId: def.id, element: def.element, role: def.role },
        r,
      ),
    );
    if (!fits || !canAfford(state, playerId, c.id, card)) return false;
    return getLegalTargets(state, c.id, card).some((o) => o.isLegal);
  });
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

export function chooseAiAction(
  state: GameState,
  playerId: string,
  opts: ChooseAiOptions = {},
): AiDecision {
  const random = opts.random ?? Math.random;
  const tieBand = opts.tieBand ?? DEFAULT_TIE_BAND;
  const top = opts.traceTop ?? 4;

  if (state.winnerId !== null || state.isDraw) return { action: null, trace: null };
  // Turn order (rules §3): only the activation owner may act. Everyone else
  // is either preparing (assign/scrap, legal at any time) or waiting.
  if (activationOwner(state) !== playerId) return { action: null, trace: null };
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { action: null, trace: null };
  const mine = state.characters
    .filter((c) => c.ownerId === playerId && c.health > 0 && !c.activatedThisRound)
    .sort(byId);
  if (mine.length === 0) return { action: null, trace: null };

  const c = mine[0];
  const def = defFor(c);
  const w = resolveWeights(def, opts.personality);

  // 1. Avatar State: activation consumes the technique play for this activation.
  const avatar = avatarScore(state, c.id, w);
  if (avatar && avatar.score >= AVATAR_THRESHOLD) {
    const chosen: Scored<null> = {
      value: null,
      score: avatar.score,
      components: avatar.components,
      label: "activate Avatar State",
    };
    const action: GameAction = {
      type: "ACTIVATE_AVATAR_STATE",
      playerId,
      characterId: c.id,
    };
    return commit(state, playerId, c.id, action, toTrace("avatar", c.id, chosen, [chosen]));
  }

  // Technique already spent (Avatar activation): end the activation.
  if (c.techniqueBlockedThisActivation) {
    const chosen: Scored<null> = {
      value: null,
      score: 0,
      components: {},
      label: "pass (technique spent)",
    };
    const action = passAction(playerId, c.id);
    return commit(state, playerId, c.id, action, toTrace("pass", c.id, chosen, [chosen]));
  }

  // 2. Movement comes before the technique (marching is free). Approach the
  // best usable damage card's range; with no attack option, close to melee so
  // the cardless basic attack (step 5) is actually reachable.
  const desiredRange = (def && attackRangeFor(state, player, c, def, w)) ?? 1;
  const move = chooseMove(state, c, w, random, tieBand, top, desiredRange);
  if (move) {
    const action: GameAction = {
      type: "MOVE",
      playerId,
      characterId: c.id,
      to: move.chosen.value,
    };
    return commit(
      state,
      playerId,
      c.id,
      action,
      toTrace("move", c.id, move.chosen, move.ranked),
    );
  }

  // 3. Play the assigned card, or scrap it for chi when the best play is poor.
  const assigned = player.assignments[c.id];
  if (assigned) {
    const card = getCardDefinition(assigned.definitionId);
    if (card && canAfford(state, playerId, c.id, card)) {
      const play = choosePlay(state, c, card, assigned.id, w, random, tieBand, top);
      if (play && play.chosen.score > SCRAP_THRESHOLD) {
        const action: GameAction = {
          type: "PLAY_CARD",
          playerId,
          characterId: c.id,
          cardInstanceId: assigned.id,
          selection: play.chosen.value.selection,
          card,
          reactions: [],
        };
        return commit(
          state,
          playerId,
          c.id,
          action,
          toTrace("play", c.id, play.chosen, play.ranked),
        );
      }
    }
    const reason = !card
      ? "unknown card"
      : !canAfford(state, playerId, c.id, card)
        ? "unaffordable"
        : "no play above threshold";
    const chosen: Scored<null> = {
      value: null,
      score: 0,
      components: {},
      label: `scrap assigned card (${reason})`,
    };
    const action: GameAction = {
      type: "SCRAP_ASSIGNED",
      playerId,
      characterId: c.id,
    };
    return commit(state, playerId, c.id, action, toTrace("scrap", c.id, chosen, [chosen]));
  }

  // 4. Assign the highest-potential playable card, else pass.
  if (def) {
    const fitting = playableCards(state, playerId, c, def);
    if (fitting.length > 0) {
      const candidates: Scored<{ instanceId: string; card: CardDefinition }>[] =
        fitting.map((instance) => {
          const card = getCardDefinition(instance.definitionId)!;
          const value = scoreCardPotential(state, c.id, card, w);
          return {
            value: { instanceId: instance.id, card },
            score: value,
            components: { potential: value },
            label: `assign ${card.name}`,
          };
        });
      const { chosen, ranked } = select(candidates, random, tieBand, top);
      const action: GameAction = {
        type: "ASSIGN_CARD",
        playerId,
        characterId: c.id,
        cardInstanceId: chosen.value.instanceId,
      };
      return commit(
        state,
        playerId,
        c.id,
        action,
        toTrace("assign", c.id, chosen, ranked),
      );
    }
  }

  // 5. Cardless fallback (rules §8 Phase 3): never waste an activation.
  // A basic action is free and shares the activation's one action slot, so it
  // is only reached when no card can be played. Prefer a finishing strike on
  // an adjacent enemy; otherwise brace.
  const adjacent = state.characters
    .filter(
      (e) =>
        e.ownerId !== playerId &&
        e.health > 0 &&
        manhattan(e.position, c.position) === 1,
    )
    .sort((a, b) => a.health - b.health)[0];
  if (adjacent) {
    const chosen: Scored<null> = {
      value: null,
      score: 1,
      components: {},
      label: `basic attack ${adjacent.definitionId} (${adjacent.health} HP)`,
    };
    const action: GameAction = {
      type: "BASIC_ATTACK",
      playerId,
      characterId: c.id,
      targetCharacterId: adjacent.id,
    };
    return commit(state, playerId, c.id, action, toTrace("basic", c.id, chosen, [chosen]));
  }
  const brace: Scored<null> = {
    value: null,
    score: 0.5,
    components: {},
    label: "basic defend",
  };
  const action: GameAction = {
    type: "BASIC_DEFENSE",
    playerId,
    characterId: c.id,
  };
  return commit(state, playerId, c.id, action, toTrace("basic", c.id, brace, [brace]));
}

// Re-export for callers that want the play value shape (tests, overlay).
export type { PlayValue };
