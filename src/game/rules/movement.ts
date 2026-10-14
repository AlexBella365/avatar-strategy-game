// Voluntary + forced grid movement. Spec §4.4, §4.7, §4A.
//Movement allowance: 2 tiles/activation (+1 Reposition intention, first move).
import {
  BASE_MOVEMENT,
  DIRECTION_VECTORS,
  inBounds,
  isOrthogonalAdjacent,
  key,
} from "./grid";
import { blockingTiles, difficultTiles, resolveTileEntry } from "./terrain";
import { getCharacterOrThrow, hasStatus, removeStatus } from "./statuses";
import { occupantAt } from "../state";
import type { ActionError, Direction, GameState, Position } from "../types";

function err(code: string, message: string): ActionError {
  return { code, message };
}

function tileCost(difficult: Set<string>, pos: Position): number {
  return difficult.has(key(pos)) ? 2 : 1;
}

/** Movement allowance, including the Reposition-intention bonus (spec §8). */
export function movementAllowance(state: GameState, characterId: string): number {
  const c = getCharacterOrThrow(state, characterId);
  let allowance = BASE_MOVEMENT;
  const player = state.players.find((p) => p.id === c.ownerId);
  if (player?.intentions[characterId] === "Reposition" && c.movementSpent === 0) {
    allowance += 1;
  }
  return allowance;
}

export interface MoveValidation {
  ok: boolean;
  errors: ActionError[];
  cost: number;
}

/** Pure check of an explicit orthogonal path from the character's tile. */
export function validateMove(
  state: GameState,
  characterId: string,
  path: Position[],
): MoveValidation {
  const c = state.characters.find((ch) => ch.id === characterId);
  if (!c) return { ok: false, errors: [err("SOURCE_MISSING", "Unknown character.")], cost: 0 };
  if (c.health <= 0)
    return { ok: false, errors: [err("SOURCE_KNOCKED_OUT", "Knocked-out characters cannot move.")], cost: 0 };
  if (hasStatus(c, "Bound"))
    return { ok: false, errors: [err("CHARACTER_BOUND", `${c.definitionId} is Bound and cannot move voluntarily.`)], cost: 0 };
  const blocked = blockingTiles(state);
  const difficult = difficultTiles(state);
  let prev = c.position;
  let cost = 0;
  for (const tile of path) {
    if (!isOrthogonalAdjacent(prev, tile))
      return { ok: false, errors: [err("INVALID_PATH", "Movement must follow orthogonal tiles.")], cost: 0 };
    if (!inBounds(tile))
      return { ok: false, errors: [err("OUT_OF_BOUNDS", `Tile (${tile.x},${tile.y}) is off the board.`)], cost: 0 };
    if (blocked.has(key(tile)))
      return { ok: false, errors: [err("TILE_BLOCKED", `Tile (${tile.x},${tile.y}) is blocked.`)], cost: 0 };
    const occupant = occupantAt(state, tile);
    if (occupant && occupant.id !== characterId)
      return {
        ok: false,
        errors: [err("TILE_OCCUPIED", `Tile (${tile.x},${tile.y}) is occupied by ${occupant.definitionId}.`)],
        cost: 0,
      };
    cost += tileCost(difficult, tile);
    prev = tile;
  }
  const remaining = movementAllowance(state, characterId) - c.movementSpent;
  if (cost > remaining)
    return {
      ok: false,
      errors: [err("INSUFFICIENT_MOVEMENT", `Needs ${cost} movement, only ${remaining} left.`)],
      cost: 0,
    };
  return { ok: true, errors: [], cost };
}

export interface MoveResult extends MoveValidation {
  events: string[];
  matchEnded: boolean;
}

/** Execute a validated path: spend allowance, move, resolve entry triggers. */
export function applyMove(
  state: GameState,
  characterId: string,
  path: Position[],
): MoveResult {
  const validation = validateMove(state, characterId, path);
  if (!validation.ok) return { ...validation, events: [], matchEnded: false };
  const events: string[] = [];
  const c = getCharacterOrThrow(state, characterId);
  const difficult = difficultTiles(state);
  for (const tile of path) {
    c.position = { ...tile };
    c.movementSpent += tileCost(difficult, tile);
    events.push(`${c.definitionId} moves to (${tile.x},${tile.y}).`);
    const entry = resolveTileEntry(state, characterId, tile);
    events.push(...entry.events);
    if (entry.knockedOut || entry.matchEnded)
      return { ok: true, errors: [], cost: validation.cost, events, matchEnded: entry.matchEnded };
  }
  return { ok: true, errors: [], cost: validation.cost, events, matchEnded: false };
}

// ---------------------------------------------------------------------------
// Universal Evade reaction (spec §4A.4): 1 Focus, one orthogonal tile,
// once per round. Re-checking the attack against the new tile happens at
// card resolution (step 4).
// ---------------------------------------------------------------------------

/** Legal Evade destinations: in-bounds, unoccupied, non-blocking neighbors. */
export function getEvadeDestinations(state: GameState, characterId: string): Position[] {
  const c = getCharacterOrThrow(state, characterId);
  const blocked = blockingTiles(state);
  return Object.values(DIRECTION_VECTORS)
    .map((v) => ({ x: c.position.x + v.x, y: c.position.y + v.y }))
    .filter(
      (t) => inBounds(t) && !blocked.has(key(t)) && !occupantAt(state, t),
    );
}

export function canEvade(
  state: GameState,
  characterId: string,
  attackCanBeEvaded: boolean,
): MoveValidation {
  const c = state.characters.find((ch) => ch.id === characterId);
  if (!c || c.health <= 0)
    return { ok: false, errors: [err("SOURCE_KNOCKED_OUT", "Knocked-out characters cannot evade.")], cost: 0 };
  if (!attackCanBeEvaded)
    return { ok: false, errors: [err("CANNOT_BE_EVADED", "This attack cannot be evaded.")], cost: 0 };
  if (c.reactionUsedThisRound)
    return { ok: false, errors: [err("REACTION_USED", "Evade was already used this round.")], cost: 0 };
  if (hasStatus(c, "Bound"))
    return { ok: false, errors: [err("CHARACTER_BOUND", `${c.definitionId} is Bound and cannot evade.`)], cost: 0 };
  if (c.focus < 1)
    return { ok: false, errors: [err("INSUFFICIENT_FOCUS", "Evade costs 1 Focus.")], cost: 0 };
  if (getEvadeDestinations(state, characterId).length === 0)
    return { ok: false, errors: [err("NO_EVADE_DESTINATION", "No legal tile to evade to.")], cost: 0 };
  return { ok: true, errors: [], cost: 0 };
}

export function applyEvade(
  state: GameState,
  characterId: string,
  dest: Position,
  attackCanBeEvaded: boolean,
): MoveResult {
  const check = canEvade(state, characterId, attackCanBeEvaded);
  if (!check.ok) return { ...check, events: [], matchEnded: false };
  const legal = getEvadeDestinations(state, characterId).some(
    (t) => t.x === dest.x && t.y === dest.y,
  );
  if (!legal)
    return {
      ok: false,
      errors: [err("ILLEGAL_EVADE_DESTINATION", `Tile (${dest.x},${dest.y}) is not a legal evade destination.`)],
      cost: 0,
      events: [],
      matchEnded: false,
    };
  const events: string[] = [];
  const c = getCharacterOrThrow(state, characterId);
  c.focus -= 1;
  c.reactionUsedThisRound = true;
  c.position = { ...dest };
  events.push(`${c.definitionId} evades to (${dest.x},${dest.y}).`);
  const entry = resolveTileEntry(state, characterId, dest);
  events.push(...entry.events);
  return { ok: true, errors: [], cost: 0, events, matchEnded: entry.matchEnded };
}

// ---------------------------------------------------------------------------
// Forced movement: push/pull along an explicit direction, plus swap.
// Deterministic, one tile at a time; stops before occupied/blocking/edge.
// No collision damage unless a card says so (step 4).
// ---------------------------------------------------------------------------

export interface ForcedMoveResult {
  events: string[];
  moved: number;
  stopped: string | null; // "occupied" | "blocking" | "board-edge" | "knocked-out" | "match-ended"
  matchEnded: boolean;
}

function stepToward(from: Position, dir: Direction): Position {
  const v = DIRECTION_VECTORS[dir];
  return { x: from.x + v.x, y: from.y + v.y };
}

export function resolveForcedMove(
  state: GameState,
  targetId: string,
  direction: Direction,
  steps: number,
): ForcedMoveResult {
  const events: string[] = [];
  const target = state.characters.find((ch) => ch.id === targetId);
  if (!target || target.health <= 0) return { events, moved: 0, stopped: null, matchEnded: false };
  // OffBalance: one additional step, consumed by this displacement.
  if (hasStatus(target, "OffBalance")) {
    steps += 1;
    events.push(removeStatus(state, targetId, "OffBalance"));
    events.push(`${target.definitionId} is OffBalance and slides an extra tile.`);
  }
  const blocked = blockingTiles(state);
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    const next = stepToward(target.position, direction);
    if (!inBounds(next)) return { events, moved, stopped: "board-edge", matchEnded: false };
    if (blocked.has(key(next))) return { events, moved, stopped: "blocking", matchEnded: false };
    if (occupantAt(state, next)) return { events, moved, stopped: "occupied", matchEnded: false };
    target.position = { ...next };
    moved += 1;
    events.push(`${target.definitionId} is displaced to (${next.x},${next.y}).`);
    const entry = resolveTileEntry(state, targetId, next);
    events.push(...entry.events);
    if (entry.knockedOut) return { events, moved, stopped: "knocked-out", matchEnded: entry.matchEnded };
    if (entry.matchEnded) return { events, moved, stopped: "match-ended", matchEnded: true };
  }
  if (moved > 0 && !state.roundEventLog.includes(`displaced:${targetId}`)) {
    state.roundEventLog.push(`displaced:${targetId}`);
  }
  return { events, moved, stopped: null, matchEnded: false };
}

export interface SwapResult {
  ok: boolean;
  errors: ActionError[];
  events: string[];
}

/** Exchange two living characters' tiles (forced: ignores Bound). */
export function resolveSwap(state: GameState, aId: string, bId: string): SwapResult {
  const a = state.characters.find((ch) => ch.id === aId);
  const b = state.characters.find((ch) => ch.id === bId);
  if (!a || !b || aId === bId)
    return { ok: false, errors: [err("SWAP_ILLEGAL", "Swap needs two distinct characters.")], events: [] };
  if (a.health <= 0 || b.health <= 0)
    return { ok: false, errors: [err("SWAP_ILLEGAL", "Knocked-out characters cannot swap.")], events: [] };
  const events: string[] = [];
  const aPos = { ...a.position };
  a.position = { ...b.position };
  events.push(`${a.definitionId} swaps to (${a.position.x},${a.position.y}).`);
  const entryA = resolveTileEntry(state, aId, a.position);
  events.push(...entryA.events);
  if (!entryA.matchEnded) {
    // a's old tile is free unless a was knocked out onto it (KO frees occupancy anyway).
    b.position = aPos;
    events.push(`${b.definitionId} swaps to (${b.position.x},${b.position.y}).`);
    const entryB = resolveTileEntry(state, bId, b.position);
    events.push(...entryB.events);
    if (entryB.matchEnded) return { ok: true, errors: [], events };
  }
  for (const id of [aId, bId]) {
    if (!state.roundEventLog.includes(`displaced:${id}`)) state.roundEventLog.push(`displaced:${id}`);
  }
  return { ok: true, errors: [], events };
}
