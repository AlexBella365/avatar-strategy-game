// Basic actions: the cardless fallback (spec v2 §8 Phase 3; user rule).
// Every activation has ONE action slot, shared with the technique play and
// governed by `techniqueBlockedThisActivation`. A character with no assigned
// card may still act — very weak by design so cards stay the real decision:
//   Basic Attack — adjacent enemy, 1 damage, free, no reaction window.
//   Basic Defense — self shield 1 until next round, free.
import type { ActionResult, GameAction, GameState } from "../types";
import { getCardDefinition } from "../content/cards";
import { err } from "./errors";
import { dealDamage } from "./damage";

function actorError(state: GameState, playerId: string, characterId: string) {
  const actor = state.characters.find((c) => c.id === characterId);
  if (!actor || actor.ownerId !== playerId) {
    return { actor: null, error: err("NOT_YOUR_CHARACTER", "That character is not yours.") };
  }
  if (actor.health <= 0) {
    return { actor: null, error: err("CHARACTER_KNOCKED_OUT", "Knocked-out characters cannot act.") };
  }
  return { actor, error: null };
}

/** Guards shared by both basic actions. Returns errors (empty = allowed). */
function basicActionErrors(
  state: GameState,
  playerId: string,
  characterId: string,
): { actor: import("../types").CharacterState | null; errors: import("../types").ActionError[] } {
  const { actor, error } = actorError(state, playerId, characterId);
  if (!actor) return { actor, errors: [error!] };
  const errors: import("../types").ActionError[] = [];
  if (actor.techniqueBlockedThisActivation) {
    errors.push(
      err("ACTIVATION_SPENT", "This activation's one action is already spent."),
    );
  }
  const assigned = state.players.find((p) => p.id === playerId)?.assignments[characterId];
  if (assigned) {
    errors.push(
      err(
        "CARD_ASSIGNED",
        "A character holding an assigned card plays it instead of using a basic action (scrap it first for chi).",
      ),
    );
  }
  return { actor, errors };
}

export function resolveBasicAttack(
  state: GameState,
  playerId: string,
  characterId: string,
  targetCharacterId: string,
): { errors: ActionResult["errors"]; events: string[] } {
  const { actor, errors } = basicActionErrors(state, playerId, characterId);
  const events: string[] = [];
  if (errors.length > 0 || !actor) return { errors, events };
  const target = state.characters.find((c) => c.id === targetCharacterId);
  if (!target) return { errors: [err("UNKNOWN_CHARACTER", "No such target.")], events };
  if (target.health <= 0) {
    return { errors: [err("CHARACTER_KNOCKED_OUT", "That character is knocked out.")], events };
  }
  if (target.ownerId === actor.ownerId) {
    return { errors: [err("NOT_AN_ENEMY", "Basic attacks only target enemies.")], events };
  }
  const distance =
    Math.abs(actor.position.x - target.position.x) + Math.abs(actor.position.y - target.position.y);
  if (distance !== 1) {
    return {
      errors: [err("OUT_OF_RANGE", "Basic attacks need an orthogonally adjacent enemy.")],
      events,
    };
  }
  actor.techniqueBlockedThisActivation = true;
  let damage = 1;
  const protector = state.characters.find((candidate) => {
    if (
      candidate.ownerId !== target.ownerId ||
      candidate.id === target.id ||
      candidate.health <= 0 ||
      candidate.reactionUsedThisRound ||
      Math.abs(candidate.position.x - target.position.x) +
        Math.abs(candidate.position.y - target.position.y) !==
        1
    ) {
      return false;
    }
    const prepared =
      candidate.preparedResponse && getCardDefinition(candidate.preparedResponse.cardId);
    return (
      prepared?.conditional?.trigger === "adjacentAllyMeleeTargeted" &&
      prepared.conditional.response.type === "allyIntercept"
    );
  });
  const protectorCard =
    protector?.preparedResponse && getCardDefinition(protector.preparedResponse.cardId);
  const response = protectorCard?.conditional?.response;
  if (protector && response?.type === "allyIntercept") {
    protector.preparedResponse = null;
    protector.reactionUsedThisRound = true;
    damage = Math.max(0, damage - response.damageReduction);
    events.push(
      `${protector.definitionId} triggers Octopus Intercept for ${target.definitionId} (-${response.damageReduction} damage).`,
    );
  }
  // Basic attacks stay at their printed 1 damage: the global damage multiplier
  // is for card/hazard lethality, not the free fallback (rules §8 Phase 3).
  const outcome = dealDamage(state, targetCharacterId, damage, "basic attack", { scale: false });
  events.push(`${actor.definitionId} makes a basic attack (1).`);
  events.push(...outcome.events);
  return { errors, events };
}

export function resolveBasicDefense(
  state: GameState,
  playerId: string,
  characterId: string,
): { errors: ActionResult["errors"]; events: string[] } {
  const { actor, errors } = basicActionErrors(state, playerId, characterId);
  const events: string[] = [];
  if (errors.length > 0 || !actor) return { errors, events };
  actor.techniqueBlockedThisActivation = true;
  actor.shields.push({
    id: `basic-shield-${actor.shields.length}-${characterId}`,
    amount: 1,
    duration: "untilNextRound",
  });
  events.push(`${actor.definitionId} braces (basic shield 1 until next round).`);
  return { errors, events };
}

/** Convenience wrapper for the dispatch switch in cards.ts. */
export function applyBasic(
  state: GameState,
  action: Extract<GameAction, { type: "BASIC_ATTACK" | "BASIC_DEFENSE" }>,
): { errors: ActionResult["errors"]; events: string[] } {
  return action.type === "BASIC_ATTACK"
    ? resolveBasicAttack(state, action.playerId, action.characterId, action.targetCharacterId)
    : resolveBasicDefense(state, action.playerId, action.characterId);
}
