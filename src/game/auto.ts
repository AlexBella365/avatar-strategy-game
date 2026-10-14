// Test-only random auto-player: picks uniformly among AUTHORIZED actions
// (every choice goes through the same validation as human input).
// A real AI policy lands later; this exists to exercise full matches.
import { getCardDefinition } from "./content/cards";
import { CHARACTERS } from "./content/characters";
import { restrictionSatisfied } from "./content/economy";
import { key, manhattan, reachableTiles } from "./rules/grid";
import { movementAllowance } from "./rules/movement";
import { hasStatus } from "./rules/statuses";
import { blockingTiles, difficultTiles } from "./rules/terrain";
import { getLegalTargets, validateTarget } from "./rules/targeting";
import { cloneState } from "./state";
import type {
  CardDefinition,
  CharacterState,
  GameAction,
  GameState,
  Position,
  TargetSelection,
} from "./types";

/** Mirror of the engine's cost check so auto prefers affordable plays. */
function canAfford(
  state: GameState,
  playerId: string,
  characterId: string,
  card: CardDefinition,
): boolean {
  const c = state.characters.find((ch) => ch.id === characterId);
  const player = state.players.find((p) => p.id === playerId);
  const def = CHARACTERS.find((d) => d.id === c?.definitionId);
  if (!c || !player || !def) return false;
  let energy = card.energyCost + (hasStatus(c, "Exhausted") ? 1 : 0);
  if (
    def.attributes.discipline >= 4 &&
    card.energyCost >= 2 &&
    !c.passiveUsesThisRound["disciplineDiscount"]
  ) {
    energy = Math.max(1, energy - 1);
  }
  return (
    player.energy >= energy &&
    c.focus >= card.focusCost &&
    player.chi >= (card.economy?.chiCost ?? 0)
  );
}

/**
 * Pick a fight target: focused attacks go for the nearest legal character;
 * shapes maximize wanted hits (enemies for attacks, allies for support)
 * while minimizing friendly fire. Random tiebreaks. Null when unhittable.
 */
function pickFightTarget(
  state: GameState,
  characterId: string,
  card: CardDefinition,
  random: () => number,
): TargetSelection | null {
  const source = state.characters.find((ch) => ch.id === characterId);
  if (!source) return null;
  const options = getLegalTargets(state, characterId, card).filter((o) => o.isLegal);
  if (options.length === 0) return null;
  const t = card.targeting;
  if (t.kind === "character") {
    let best = options[0];
    let bestDist = Infinity;
    for (const option of options) {
      const target = state.characters.find((ch) => ch.id === option.primaryCharacterId);
      const dist = target ? manhattan(source.position, target.position) : Infinity;
      if (dist < bestDist || (dist === bestDist && random() < 0.5)) {
        best = option;
        bestDist = dist;
      }
    }
    return best.selection;
  }
  const allegiance =
    t.kind === "area" ? t.allegiance : t.kind === "direction" ? "enemies" : "all";
  const wantAllies = allegiance === "allies" || allegiance === "selfAndAllies";
  let best = options[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const option of options) {
    let wanted = 0;
    let unwanted = 0;
    for (const id of option.affectedCharacterIds) {
      const hit = state.characters.find((ch) => ch.id === id);
      if (!hit) continue;
      if ((hit.ownerId === source.ownerId) === wantAllies) wanted += 1;
      else unwanted += 1;
    }
    const score = wanted * 2 - unwanted;
    if (score > bestScore || (score === bestScore && random() < 0.5)) {
      best = option;
      bestScore = score;
    }
  }
  return best.selection;
}

/** Living enemies of a character, nearest first. */
function nearestEnemies(state: GameState, characterId: string): CharacterState[] {
  const c = state.characters.find((ch) => ch.id === characterId);
  if (!c) return [];
  return state.characters
    .filter((o) => o.health > 0 && o.ownerId !== c.ownerId)
    .sort((a, b) => manhattan(c.position, a.position) - manhattan(c.position, b.position));
}

/**
 * Step toward the nearest enemy: the reachable tile minimizing distance to
 * any living enemy. Returns null when already as close as possible.
 */
function advanceTowardEnemy(
  state: GameState,
  characterId: string,
  random: () => number,
): Position | null {
  const c = state.characters.find((ch) => ch.id === characterId);
  const foes = nearestEnemies(state, characterId);
  if (!c || foes.length === 0) return null;
  const occupied = new Set(
    state.characters.filter((ch) => ch.health > 0).map((ch) => key(ch.position)),
  );
  const reach = reachableTiles(c.position, {
    allowance: Math.max(0, movementAllowance(state, characterId) - c.movementSpent),
    blocked: blockingTiles(state),
    occupied,
    difficult: difficultTiles(state),
  });
  const here = Math.min(...foes.map((f) => manhattan(c.position, f.position)));
  let best: Position[] = [];
  let bestDist = here;
  for (const k of reach.keys()) {
    const [x, y] = k.split(",").map(Number);
    const tile = { x, y };
    const dist = Math.min(...foes.map((f) => manhattan(tile, f.position)));
    if (dist < bestDist) {
      bestDist = dist;
      best = [tile];
    } else if (dist === bestDist && dist < here) {
      best.push(tile);
    }
  }
  if (best.length === 0) return null;
  return best[Math.floor(random() * best.length)];
}

/**
 * Would stepping to `dest` dodge a locked focused attack? Re-checks the
 * attack from the hypothetical tile using the shared validator.
 */
export function evadeEscapes(
  state: GameState,
  attackerId: string,
  card: CardDefinition,
  targetId: string,
  dest: Position,
): boolean {
  const clone = cloneState(state);
  const target = clone.characters.find((ch) => ch.id === targetId);
  if (!target) return false;
  target.position = { ...dest };
  return !validateTarget(clone, attackerId, card, {
    kind: "character",
    characterId: targetId,
  }).ok;
}

/**
 * One authorized action for `playerId`, or null when that side has nothing
 * left to do (caller should pass/end the round). Never invents illegal
 * moves: assign/play/move/scrap paths all re-validate in the engine.
 */
export function chooseAutoAction(
  state: GameState,
  playerId: string,
  random: () => number = Math.random,
): GameAction | null {
  if (state.winnerId !== null || state.isDraw) return null;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  const mine = state.characters
    .filter((c) => c.ownerId === playerId && c.health > 0 && !c.activatedThisRound)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (mine.length === 0) return null;
  const c = mine[0];
  const def = CHARACTERS.find((d) => d.id === c.definitionId);

  // Avatar activation when ready (consumes the technique play).
  const avDef = def?.avatarState;
  if (
    avDef?.enabled &&
    c.avatarState &&
    !c.avatarState.active &&
    !c.avatarState.activatedThisMatch &&
    c.avatarState.resonance >= avDef.threshold &&
    c.focus >= avDef.activationFocusCost &&
    random() < 0.7
  ) {
    return { type: "ACTIVATE_AVATAR_STATE", playerId, characterId: c.id };
  }

  const assigned = player.assignments[c.id];
  if (assigned) {
    // Technique spent (Avatar activation): may still move, then pass.
    if (!c.techniqueBlockedThisActivation) {
      // Close in before playing.
      if (c.movementSpent === 0 && random() < 0.85) {
        const dest = advanceTowardEnemy(state, c.id, random);
        if (dest) return { type: "MOVE", playerId, characterId: c.id, to: dest };
      }
      const card = getCardDefinition(assigned.definitionId);
      if (card && canAfford(state, playerId, c.id, card) && random() >= 0.15) {
        const pick = pickFightTarget(state, c.id, card, random);
        if (pick) {
          // Auto never evades on behalf of defenders (reactions: none).
          return {
            type: "PLAY_CARD",
            playerId,
            characterId: c.id,
            cardInstanceId: assigned.id,
            selection: pick,
            card,
            reactions: [],
          };
        }
      }
      return { type: "SCRAP_ASSIGNED", playerId, characterId: c.id };
    }
    if (c.movementSpent === 0) {
      const dest = advanceTowardEnemy(state, c.id, random);
      if (dest) return { type: "MOVE", playerId, characterId: c.id, to: dest };
    }
    return { type: "PASS_ACTIVATION", playerId, characterId: c.id };
  }

  const fitting = player.teamHand.filter((instance) => {
    const card = getCardDefinition(instance.definitionId);
    if (!card || !def) return false;
    return (card.economy?.restrictions ?? []).every((r) =>
      restrictionSatisfied({ definitionId: def.id, element: def.element, role: def.role }, r),
    );
  });
  if (fitting.length > 0) {
    const pick = fitting[Math.floor(random() * fitting.length)];
    return { type: "ASSIGN_CARD", playerId, characterId: c.id, cardInstanceId: pick.id };
  }
  return { type: "PASS_ACTIVATION", playerId, characterId: c.id };
}
