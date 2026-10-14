// Test-only random auto-player: picks uniformly among AUTHORIZED actions
// (every choice goes through the same validation as human input).
// A real AI policy lands later; this exists to exercise full matches.
import { getCardDefinition } from "./content/cards";
import { CHARACTERS } from "./content/characters";
import { restrictionSatisfied } from "./content/economy";
import { key, reachableTiles } from "./rules/grid";
import { movementAllowance } from "./rules/movement";
import { hasStatus } from "./rules/statuses";
import { blockingTiles, difficultTiles } from "./rules/terrain";
import { getLegalTargets } from "./rules/targeting";
import type { CardDefinition, GameAction, GameState, Position } from "./types";

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

function randomReachable(
  state: GameState,
  characterId: string,
  random: () => number,
): Position | null {
  const c = state.characters.find((ch) => ch.id === characterId);
  if (!c) return null;
  const occupied = new Set(
    state.characters.filter((ch) => ch.health > 0).map((ch) => key(ch.position)),
  );
  const reach = reachableTiles(c.position, {
    allowance: Math.max(0, movementAllowance(state, characterId) - c.movementSpent),
    blocked: blockingTiles(state),
    occupied,
    difficult: difficultTiles(state),
  });
  const keys = [...reach.keys()];
  if (keys.length === 0) return null;
  const [x, y] = keys[Math.floor(random() * keys.length)].split(",").map(Number);
  return { x, y };
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
    // Sometimes stroll before playing.
    if (c.movementSpent === 0 && random() < 0.6) {
      const dest = randomReachable(state, c.id, random);
      if (dest) return { type: "MOVE", playerId, characterId: c.id, to: dest };
    }
    const card = getCardDefinition(assigned.definitionId);
    if (card && canAfford(state, playerId, c.id, card) && random() >= 0.25) {
      const options = getLegalTargets(state, c.id, card).filter((o) => o.isLegal);
      if (options.length > 0) {
        const pick = options[Math.floor(random() * options.length)];
        // Auto never evades on behalf of defenders (reactions: none).
        return {
          type: "PLAY_CARD",
          playerId,
          characterId: c.id,
          cardInstanceId: assigned.id,
          selection: pick.selection,
          card,
          reactions: [],
        };
      }
    }
    return { type: "SCRAP_ASSIGNED", playerId, characterId: c.id };
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
