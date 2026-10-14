// Card validation + §8 phase-4 technique resolution.
// One authoritative entry: applyGameAction(state, action).
//
// Conventions (documented where the spec is silent):
// - PLAY_CARD carries its CardDefinition; the engine checks the instance is
//   in hand and its definitionId matches. (Content registry lookup wires up
//   in step 7; hands are dealt by the round loop in step 5.)
// - All pre-payment validation (ownership, hand, attributes, target, costs,
//   mustBeLegal movement) runs before any mutation. Post-payment fizzles keep
//   costs (spec §8).
// - Multi-target cards resolve per target in stable y,x order; each target
//   runs damage → support → displacement, with immediate KO/match-end stops.
//   Card-level terrain creation (areaTiles/targetTile) applies once afterwards.
// - Stat-based evasion (§6) applies only when a card opts in with
//   `canBeEvaded: true`; positional Evade (§4A.4) is available unless
//   `cannotBeEvaded: true`. A tie deals damage but skips that target's
//   applyStatus effects.
// - `disrupt` maps to Exhausted(1); `draw` is a logged no-op until decks
//   exist (step 5). Synergy bonuses are data (bonusVsStatus,
//   bonusIfTargetDisplaced, waterEmpoweredBonus), never card-name checks.
// - A target cannot be hit twice by one resolution (deduped by id).
import { CHARACTERS } from "../content/characters";
import { getTerrainDefinition } from "../content/terrain";
import { cloneState, occupantAt } from "../state";
import {
  attackVsEvasion,
  calculateDamage,
  dealDamage,
  requiresAttributesMet,
} from "./damage";
import {
  applyEvade,
  applyMove,
  canEvade,
  findCheapestPath,
  resolveForcedMove,
  resolveSwap,
} from "./movement";
import { applyStatus, getCharacterOrThrow, hasStatus, removeStatus } from "./statuses";
import {
  blockingTiles,
  createTerrain,
  isWaterEmpowered,
  resolveTileEntry,
  terrainAt,
} from "./terrain";
import { getAffectedCharacters, resolveTiles, validateTarget } from "./targeting";
import { inBounds, isOrthogonalAdjacent, key } from "./grid";
import type {
  ActionError,
  ActionResult,
  CardDefinition,
  CharacterDefinition,
  CharacterState,
  Direction,
  GameAction,
  GameState,
  Position,
  TargetSelection,
} from "../types";

function err(code: string, message: string): ActionError {
  return { code, message };
}

function defOf(actor: CharacterState): CharacterDefinition | undefined {
  return CHARACTERS.find((d) => d.id === actor.definitionId);
}

/** melee/ranged/aoe class for Cover matching. */
function attackClass(card: CardDefinition): "melee" | "ranged" | "aoe" {
  const t = card.targeting;
  if (t.kind === "character") return t.range === "melee" ? "melee" : "ranged";
  if (t.kind === "tile") return "ranged";
  return "aoe";
}

/** Cardinal push/pull direction, or null when the line is ambiguous. */
function cardinalFromTo(from: Position, to: Position): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  if (dx === 0) return dy > 0 ? "south" : "north";
  if (dy === 0) return dx > 0 ? "east" : "west";
  return null; // ambiguous diagonal: card must name a direction
}

function opposite(dir: Direction): Direction {
  switch (dir) {
    case "north": return "south";
    case "south": return "north";
    case "east": return "west";
    case "west": return "east";
  }
}

export function applyGameAction(state: GameState, action: GameAction): ActionResult {
  const next = cloneState(state);
  const events: string[] = [];
  const errors: ActionError[] = [];
  switch (action.type) {
    case "MOVE": {
      const actor = next.characters.find((c) => c.id === action.characterId);
      if (!actor || actor.ownerId !== action.playerId) {
        errors.push(err("NOT_YOUR_CHARACTER", "That character is not yours."));
        break;
      }
      const path = action.path ?? findCheapestPath(next, actor.id, action.to);
      if (!path) {
        errors.push(err("NO_PATH", `No legal path to (${action.to.x},${action.to.y}).`));
        break;
      }
      const result = applyMove(next, actor.id, path);
      if (!result.ok) errors.push(...result.errors);
      events.push(...result.events);
      break;
    }
    case "SET_INTENTION": {
      const actor = next.characters.find((c) => c.id === action.characterId);
      if (!actor || actor.ownerId !== action.playerId) {
        errors.push(err("NOT_YOUR_CHARACTER", "That character is not yours."));
        break;
      }
      if (actor.health <= 0) {
        errors.push(err("CHARACTER_KNOCKED_OUT", "Knocked-out characters take no intentions."));
        break;
      }
      const player = next.players.find((p) => p.id === action.playerId)!;
      player.intentions[action.characterId] = action.intention;
      events.push(`${actor.definitionId} sets an intention (hidden).`);
      break;
    }
    case "PASS_ACTIVATION": {
      const actor = next.characters.find((c) => c.id === action.characterId);
      if (!actor || actor.ownerId !== action.playerId) {
        errors.push(err("NOT_YOUR_CHARACTER", "That character is not yours."));
        break;
      }
      actor.activatedThisRound = true;
      events.push(`${actor.definitionId} passes.`);
      break;
    }
    case "PLAY_CARD": {
      const outcome = resolvePlayCard(next, action);
      errors.push(...outcome.errors);
      events.push(...outcome.events);
      break;
    }
    default:
      errors.push(
        err("NOT_IMPLEMENTED", `${action.type} lands with the round loop / Avatar flow.`),
      );
      break;
  }
  next.log.push(...events);
  return { state: next, errors, events };
}

// ---------------------------------------------------------------------------
// PLAY_CARD.
// ---------------------------------------------------------------------------

interface PlayCardAction {
  playerId: string;
  characterId: string;
  cardInstanceId: string;
  selection: TargetSelection;
  movePath?: Position[];
  reactions?: { characterId: string; dest: Position }[];
  card: CardDefinition;
}

function removeFromHand(state: GameState, playerId: string, characterId: string, instanceId: string): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  const hand = player.characterHands[characterId] ?? [];
  const idx = hand.findIndex((c) => c.id === instanceId);
  if (idx >= 0) {
    hand.splice(idx, 1);
    return true;
  }
  const teamIdx = player.teamHand.findIndex((c) => c.id === instanceId);
  if (teamIdx >= 0) {
    player.teamHand.splice(teamIdx, 1);
    return true;
  }
  return false;
}

function resolvePlayCard(
  state: GameState,
  action: PlayCardAction,
): { errors: ActionError[]; events: string[] } {
  const errors: ActionError[] = [];
  const events: string[] = [];
  const card = action.card;

  // --- 1. Validation (all pre-payment). ---
  const actor = state.characters.find((c) => c.id === action.characterId);
  if (!actor || actor.ownerId !== action.playerId)
    return { errors: [err("NOT_YOUR_CHARACTER", "That character is not yours.")], events };
  if (actor.health <= 0)
    return { errors: [err("CHARACTER_KNOCKED_OUT", "Knocked-out characters cannot act.")], events };
  const def = defOf(actor);
  if (!def)
    return { errors: [err("UNKNOWN_CHARACTER", "No definition for that character.")], events };
  if (
    !state.players
      .find((p) => p.id === action.playerId)
      ?.characterHands[action.characterId]?.some((c) => c.id === action.cardInstanceId) &&
    !state.players
      .find((p) => p.id === action.playerId)
      ?.teamHand.some((c) => c.id === action.cardInstanceId)
  )
    return { errors: [err("CARD_NOT_IN_HAND", "That card is not in hand.")], events };
  if (!requiresAttributesMet(def.attributes, card.requiresAttributes))
    return {
      errors: [err("ATTRIBUTE_REQUIREMENT", "Attribute requirements not met.")],
      events,
    };
  const targetCheck = validateTarget(
    state,
    actor.id,
    card,
    action.selection,
    // Dash-strike cards move before ranging: full check runs post-movement.
    { lenientRange: card.movement?.timing === "beforeTechnique" },
  );
  if (!targetCheck.ok) return { errors: targetCheck.errors, events };

  const player = state.players.find((p) => p.id === action.playerId)!;
  let energyCost = card.energyCost;
  const exhausted = hasStatus(actor, "Exhausted");
  if (exhausted) energyCost += 1;
  let discounted = false;
  if (
    def.attributes.discipline >= 4 &&
    card.energyCost >= 2 &&
    !actor.passiveUsesThisRound["disciplineDiscount"]
  ) {
    energyCost = Math.max(1, energyCost - 1);
    discounted = true;
  }
  if (player.energy < energyCost)
    return {
      errors: [err("INSUFFICIENT_ENERGY", `Needs ${energyCost} Energy, has ${player.energy}.`)],
      events,
    };
  if (actor.focus < card.focusCost)
    return {
      errors: [err("INSUFFICIENT_FOCUS", `Needs ${card.focusCost} Focus, has ${actor.focus}.`)],
      events,
    };
  // mustBeLegal movement is validated pre-payment (no loss on failure).
  // `fizzle` fails at execution (costs lost); stopBeforeIllegal never fails.
  if (card.movement && card.movement.maxSteps > 0 && card.movement.destinationRule === "mustBeLegal") {
    const pathCheck = checkMovementEffect(state, actor, card, action.movePath ?? []);
    if (!pathCheck.ok) return { errors: pathCheck.errors, events };
  }

  // --- 2. Payment. ---
  player.energy -= energyCost;
  actor.focus -= card.focusCost;
  if (exhausted) events.push(removeStatus(state, actor.id, "Exhausted"));
  if (discounted) {
    actor.passiveUsesThisRound["disciplineDiscount"] = 1;
    events.push(`${actor.definitionId} uses Discipline focus (-1 Energy).`);
  }
  removeFromHand(state, action.playerId, actor.id, action.cardInstanceId);
  events.push(
    `${actor.definitionId} plays ${card.name} (-${energyCost} Energy${card.focusCost > 0 ? `, -${card.focusCost} Focus` : ""}).`,
  );

  // --- Movement beforeTechnique / insteadOfTechnique. ---
  if (card.movement && card.movement.timing !== "afterTechnique") {
    const moveResult = runMovementEffect(state, actor, card, action.movePath ?? [], events);
    if (!moveResult) return { errors, events }; // fizzled after payment
    if (card.movement.timing === "insteadOfTechnique") {
      events.push(`${card.name} moves instead of resolving a technique.`);
      return { errors, events };
    }
    // Dash-strike: full target check from the post-movement tile.
    const postCheck = validateTarget(state, actor.id, card, action.selection);
    if (!postCheck.ok) {
      events.push(`${card.name} fizzles: ${postCheck.errors[0].message}`);
      return { errors, events };
    }
  }

  // --- 4-5. Reactions (Evade) then locked targets. ---
  // Evade is available against focused, tile-targeted, and area attacks
  // (spec §4A.4); only currently-affected characters may declare it.
  const missed = new Set<string>();
  const t = card.targeting;
  if (
    (t.kind === "character" || t.kind === "tile" || t.kind === "area") &&
    card.cannotBeEvaded !== true &&
    (action.reactions?.length ?? 0) > 0
  ) {
    const preAffected = new Set(
      t.kind === "character" && action.selection.kind === "character"
        ? [action.selection.characterId]
        : getAffectedCharacters(state, actor.id, card, action.selection),
    );
    for (const reaction of action.reactions ?? []) {
      if (!preAffected.has(reaction.characterId)) continue;
      const target = state.characters.find((c) => c.id === reaction.characterId);
      if (!target || target.health <= 0) continue;
      const check = canEvade(state, target.id, card.canBeEvaded !== false);
      if (!check.ok) {
        events.push(`Evade fails: ${check.errors[0].message}`);
        continue;
      }
      const evade = applyEvade(state, target.id, reaction.dest, card.canBeEvaded !== false);
      events.push(...evade.events);
      if (evade.matchEnded) return { errors, events };
    }
    // Focused attacks re-check the (possibly moved) target; tile/area attacks
    // stay aimed and recompute occupants below.
    if (t.kind === "character" && action.selection.kind === "character") {
      if (!validateTarget(state, actor.id, card, action.selection).ok) {
        missed.add(action.selection.characterId);
        events.push(
          `${getCharacterOrThrow(state, action.selection.characterId).definitionId} evades the attack (miss).`,
        );
      }
    }
  }

  // Lock affected characters post-reaction (tile attacks re-read occupancy).
  let affected = getAffectedCharacters(state, actor.id, card, action.selection).filter(
    (id) => !missed.has(id),
  );
  affected = [...new Set(affected)]; // one hit per target per resolution
  const lockedTiles = resolveTiles(state, actor.id, card, action.selection);

  // --- 6-8. Per-target effects. ---
  const empowered = isWaterEmpowered(state, actor.position);
  if (empowered) events.push(`${actor.definitionId} is empowered by a Water Source.`);
  const avatarBonus = actor.avatarState?.active ? (def.avatarState?.damageBonus ?? 0) : 0;
  let avatarShieldUsed = false;
  const attackerAgg = def.attributes.aggression;
  const attackerPer = def.attributes.perception;

  for (const targetId of affected) {
    if (state.winnerId !== null || state.isDraw) break;
    const target = getCharacterOrThrow(state, targetId);
    if (target.health <= 0) continue;
    const targetDef = CHARACTERS.find((d) => d.id === target.definitionId);

    // Stat-based evasion (opt-in per card).
    let tieNoStatus = false;
    if (card.canBeEvaded === true && targetDef) {
      const score = attackVsEvasion(attackerPer, card.accuracyModifier ?? 0, targetDef.attributes.agility, 0);
      if (score === "evaded") {
        events.push(`${target.definitionId} evades ${card.name}.`);
        continue;
      }
      if (score === "tie") {
        tieNoStatus = true;
        events.push(`${target.definitionId} partially evades ${card.name} (no secondary status).`);
      }
    }

    for (const effect of card.effects) {
      if (state.winnerId !== null || state.isDraw) break;
      switch (effect.type) {
        case "damage": {
          let conditional = 0;
          if (effect.bonusVsStatus && hasStatus(target, effect.bonusVsStatus.statusId as never))
            conditional += effect.bonusVsStatus.amount;
          if (effect.bonusIfTargetDisplaced && state.roundEventLog.includes(`displaced:${targetId}`))
            conditional += effect.bonusIfTargetDisplaced;
          if (effect.waterEmpoweredBonus && empowered) conditional += effect.waterEmpoweredBonus;
          let exposed = 0;
          if (t.kind === "character" && hasStatus(target, "Exposed")) exposed = 1;
          let cover = 0;
          const coverDef = getTerrainDefinition(terrainAt(state, target.position)?.terrainId ?? "");
          if (coverDef?.cover && coverDef.cover.vs.includes(attackClass(card))) cover = coverDef.cover.reduction;
          const total = calculateDamage({
            base: effect.amount,
            scalesWithAggression: effect.scalesWithAggression,
            attackerAggression: attackerAgg,
            conditionalBonus: conditional,
            avatarBonus,
            exposedBonus: exposed,
            coverReduction: cover,
          });
          const outcome = dealDamage(state, targetId, total, card.name);
          events.push(...outcome.events);
          if (exposed > 0) events.push(removeStatus(state, targetId, "Exposed"));
          if (outcome.matchEnded) return { errors, events };
          break;
        }
        case "heal": {
          const before = target.health;
          target.health = Math.min(target.maxHealth, target.health + effect.amount);
          events.push(`${target.definitionId} recovers ${target.health - before}.`);
          break;
        }
        case "shield": {
          let amount = effect.amount;
          if (effect.waterEmpoweredBonus && empowered) amount += effect.waterEmpoweredBonus;
          if (!avatarShieldUsed && actor.avatarState?.active && card.cardType === "defense") {
            amount += def.avatarState?.shieldBonus ?? 0;
            avatarShieldUsed = true;
          }
          target.shields.push({ id: `shield-${target.shields.length}-${targetId}`, amount });
          events.push(`${target.definitionId} gains ${amount} shield.`);
          break;
        }
        case "applyStatus": {
          if (tieNoStatus) break;
          events.push(applyStatus(state, targetId, effect.statusId as never, effect.duration));
          break;
        }
        case "removeStatus":
          events.push(removeStatus(state, targetId, effect.statusId as never));
          break;
        case "move": {
          const path = (action.movePath ?? []).slice(0, effect.steps);
          if (path.length === 0) {
            events.push(`${card.name}: no movement path given; move fizzles.`);
            break;
          }
          // Card-granted movement explicitly allows motion (bypasses Bound).
          const blocked = tilesBlocked(state);
          let prev = actor.position;
          for (const tile of path) {
            if (!isOrthogonalAdjacent(prev, tile) || !inBounds(tile)) {
              events.push(`${card.name}: illegal movement step; move stops.`);
              break;
            }
            if (blocked.has(key(tile)) || (occupantAt(state, tile) && occupantAt(state, tile)!.id !== actor.id)) {
              events.push(`${card.name}: movement blocked at (${tile.x},${tile.y}).`);
              break;
            }
            actor.position = { ...tile };
            events.push(`${actor.definitionId} moves to (${tile.x},${tile.y}).`);
            const entry = resolveTileEntry(state, actor.id, tile);
            events.push(...entry.events);
            if (entry.knockedOut || entry.matchEnded) return { errors, events };
            prev = tile;
          }
          break;
        }
        case "push":
        case "pull": {
          const dir = resolveDisplaceDirection(effect.direction, actor.position, target.position, effect.type);
          if (!dir) {
            events.push(`${card.name}: ambiguous displacement line; no displacement.`);
            break;
          }
          const forced = resolveForcedMove(state, targetId, dir, effect.steps);
          events.push(...forced.events);
          if (forced.matchEnded) return { errors, events };
          break;
        }
        case "swap": {
          const ally = target.ownerId === actor.ownerId;
          if ((effect.target === "ally") !== ally) {
            events.push(`${card.name}: swap target allegiance mismatch; no swap.`);
            break;
          }
          const swap = resolveSwap(state, actor.id, targetId);
          events.push(...swap.events);
          break;
        }
        case "createTerrain": {
          // Inline creation resolves at the primary locked tile (content uses terrainEffects).
          const tile = lockedTiles[0];
          if (!tile) {
            events.push(`${card.name}: no tile for terrain; creation fizzles.`);
            break;
          }
          const created = createTerrain(state, tile, effect.terrainId, effect.duration, effect.replacementPolicy);
          events.push(...created.events);
          if (!created.ok) events.push(...created.errors.map((e) => e.message));
          break;
        }
        case "gainFocus": {
          const before = actor.focus;
          actor.focus = Math.min(4, actor.focus + effect.amount);
          events.push(`${actor.definitionId} gains ${actor.focus - before} Focus.`);
          break;
        }
        case "gainMomentum": {
          const before = actor.momentum;
          actor.momentum = Math.min(1, actor.momentum + effect.amount);
          events.push(`${actor.definitionId} gains ${actor.momentum - before} Momentum.`);
          break;
        }
        case "draw":
          events.push(`${actor.definitionId} would draw ${effect.count} (no decks in prototype).`);
          break;
        case "disrupt":
          events.push(applyStatus(state, targetId, "Exhausted", 1));
          break;
      }
    }
  }

  // --- Card-level terrain effects (once, not per target). ---
  for (const terrainEffect of card.terrainEffects ?? []) {
    if (state.winnerId !== null || state.isDraw) break;
    const tiles =
      terrainEffect.target === "areaTiles"
        ? lockedTiles
        : terrainEffect.target === "targetTile"
          ? lockedTiles.slice(0, 1)
          : (action.movePath ?? []);
    for (const tile of tiles) {
      const created = createTerrain(state, tile, terrainEffect.terrainId, terrainEffect.durationRounds, terrainEffect.replacementPolicy);
      events.push(...created.events);
      if (!created.ok) events.push(...created.errors.map((e) => e.message));
    }
  }

  // --- Movement afterTechnique. ---
  if (card.movement && card.movement.timing === "afterTechnique") {
    runMovementEffect(state, actor, card, action.movePath ?? [], events);
  }

  return { errors, events };
}

// ---------------------------------------------------------------------------
// Card movement effects.
// ---------------------------------------------------------------------------

function tilesBlocked(state: GameState): Set<string> {
  return blockingTiles(state);
}

/** Geometry + budget check for a card movement effect path. */
function checkMovementEffect(
  state: GameState,
  actor: CharacterState,
  card: CardDefinition,
  path: Position[],
): { ok: boolean; errors: ActionError[] } {
  const movement = card.movement!;
  if (movement.path === "teleport") {
    const dest = path[path.length - 1];
    const legal =
      dest !== undefined &&
      inBounds(dest) &&
      !blockingTiles(state).has(key(dest)) &&
      !occupantAt(state, dest);
    if (!legal)
      return { ok: false, errors: [err("INVALID_DESTINATION", "Teleport needs a legal destination tile.")] };
    return { ok: true, errors: [] };
  }
  if (path.length > movement.maxSteps)
    return { ok: false, errors: [err("TOO_MANY_STEPS", `This movement allows ${movement.maxSteps} steps.`)] };
  if (movement.path === "straightOrthogonal" && path.length > 0) {
    const start = actor.position;
    const straight = path.every((p) => p.x === start.x || p.y === start.y);
    if (!straight)
      return { ok: false, errors: [err("INVALID_PATH", "This movement must run in a straight orthogonal line.")] };
  }
  let prev = actor.position;
  for (const tile of path) {
    if (!isOrthogonalAdjacent(prev, tile))
      return { ok: false, errors: [err("INVALID_PATH", "Movement must follow orthogonal tiles.")] };
    if (!inBounds(tile))
      return { ok: false, errors: [err("OUT_OF_BOUNDS", `Tile (${tile.x},${tile.y}) is off the board.`)] };
    if (blockingTiles(state).has(key(tile)))
      return { ok: false, errors: [err("TILE_BLOCKED", `Tile (${tile.x},${tile.y}) is blocked.`)] };
    const occupier = occupantAt(state, tile);
    if (occupier && occupier.id !== actor.id)
      return { ok: false, errors: [err("TILE_OCCUPIED", `Tile (${tile.x},${tile.y}) is occupied.`)] };
    prev = tile;
  }
  return { ok: true, errors: [] };
}

/**
 * Execute a card movement effect. Returns false when the card fizzles
 * (post-payment) under a `fizzle` destination rule.
 */
function runMovementEffect(
  state: GameState,
  actor: CharacterState,
  card: CardDefinition,
  path: Position[],
  events: string[],
): boolean {
  const movement = card.movement!;
  const rule = movement.destinationRule;
  if (movement.path === "teleport") {
    const dest = path[path.length - 1];
    const legal =
      dest && inBounds(dest) && !tilesBlocked(state).has(key(dest)) && !occupantAt(state, dest);
    if (!legal) {
      events.push(`${card.name}: illegal teleport destination; card fizzles.`);
      return rule !== "mustBeLegal" ? false : false;
    }
    actor.position = { ...dest };
    events.push(`${actor.definitionId} teleports to (${dest.x},${dest.y}).`);
    const entry = resolveTileEntry(state, actor.id, dest);
    events.push(...entry.events);
    return true;
  }
  // Orthogonal / straight-line: walk up to maxSteps, honoring stop rules.
  const steps = path.slice(0, movement.maxSteps);
  const start = { ...actor.position };
  let prev = start;
  for (const tile of steps) {
    const occupier = occupantAt(state, tile);
    let illegal =
      !isOrthogonalAdjacent(prev, tile) ||
      !inBounds(tile) ||
      tilesBlocked(state).has(key(tile)) ||
      (occupier !== undefined && occupier.id !== actor.id);
    if (
      !illegal &&
      movement.path === "straightOrthogonal" &&
      tile.x !== start.x &&
      tile.y !== start.y
    ) {
      illegal = true;
    }
    if (illegal) {
      if (rule === "stopBeforeIllegal") {
        events.push(`${card.name}: movement stops before (${tile.x},${tile.y}).`);
        return true;
      }
      events.push(`${card.name}: illegal movement step; card fizzles.`);
      return false;
    }
    actor.position = { ...tile };
    events.push(`${actor.definitionId} moves to (${tile.x},${tile.y}).`);
    const entry = resolveTileEntry(state, actor.id, tile);
    events.push(...entry.events);
    if (entry.knockedOut || entry.matchEnded) return true;
    prev = tile;
  }
  return true;
}

/** Resolve push/pull direction from data or the source→target grid line. */
function resolveDisplaceDirection(
  direction: Direction | "chosen" | "awayFromSource" | "towardSource" | undefined,
  source: Position,
  target: Position,
  kind: "push" | "pull",
): Direction | null {
  if (direction === "north" || direction === "east" || direction === "south" || direction === "west")
    return direction;
  const line = cardinalFromTo(source, target);
  if (!line) return null;
  if (direction === undefined) return kind === "push" ? line : opposite(line);
  if (direction === "awayFromSource") return line;
  if (direction === "towardSource") return opposite(line);
  return line; // "chosen" falls back to the grid line
}
