// Tile terrain: creation, entry triggers, expiry. Spec §5.
// Definitions live in content/terrain.ts; this module owns all mutations.
import { inBounds, orthogonalNeighbors } from "./grid";
import { applyStatus } from "./statuses";
import { dealDamage } from "./damage";
import { nextId } from "../state";
import { TERRAIN_DEFINITIONS, getTerrainDefinition } from "../content/terrain";
import type { GameState, Position, TerrainDefinition, TerrainState } from "../types";

export { TERRAIN_DEFINITIONS };
export type { TerrainDefinition };

/** Terrain instance on a tile, if any (at most one primary per tile). */
export function terrainAt(state: GameState, pos: Position): TerrainState | undefined {
  return state.terrain.find((t) => t.x === pos.x && t.y === pos.y);
}

function setsFor(state: GameState) {
  const blocked = new Set<string>();
  const difficult = new Set<string>();
  for (const t of state.terrain) {
    const def = getTerrainDefinition(t.terrainId);
    if (!def) continue;
    if (def.blocking) blocked.add(`${t.x},${t.y}`);
    else if (def.difficult) difficult.add(`${t.x},${t.y}`);
  }
  return { blocked, difficult };
}

/** Tiles with blocking terrain (impassable, break LOS). */
export function blockingTiles(state: GameState): Set<string> {
  return setsFor(state).blocked;
}

/** Tiles with difficult terrain (2 movement points to enter). */
export function difficultTiles(state: GameState): Set<string> {
  return setsFor(state).difficult;
}

/**
 * Water techniques used from a water-source tile or an orthogonally
 * adjacent tile gain WaterSourceEmpowered (spec §5.2).
 */
export function isWaterEmpowered(state: GameState, pos: Position): boolean {
  const tiles = [pos, ...orthogonalNeighbors(pos)];
  return tiles.some((t) => {
    const terrain = terrainAt(state, t);
    return terrain !== undefined && getTerrainDefinition(terrain.terrainId)?.elementalSource === "water";
  });
}

export interface CreateTerrainResult {
  ok: boolean;
  errors: { code: string; message: string }[];
  events: string[];
}

/**
 * Place terrain on a tile. Blocking terrain under a living character is
 * illegal. Existing terrain is handled per replacement policy.
 */
export function createTerrain(
  state: GameState,
  pos: Position,
  terrainId: string,
  duration: number | "permanent",
  replacementPolicy: "replace" | "fail" | "preserveExisting",
): CreateTerrainResult {
  const def = getTerrainDefinition(terrainId);
  if (!def) {
    return { ok: false, errors: [{ code: "UNKNOWN_TERRAIN", message: `Unknown terrain: ${terrainId}.` }], events: [] };
  }
  if (!inBounds(pos)) {
    return { ok: false, errors: [{ code: "OUT_OF_BOUNDS", message: `Tile (${pos.x},${pos.y}) is off the board.` }], events: [] };
  }
  const occupant = state.characters.find(
    (c) => c.health > 0 && c.position.x === pos.x && c.position.y === pos.y,
  );
  if (occupant && def.blocking) {
    return {
      ok: false,
      errors: [{ code: "TERRAIN_BLOCKED_TILE", message: `Cannot create ${def.name} under ${occupant.definitionId}.` }],
      events: [],
    };
  }
  const existing = terrainAt(state, pos);
  if (existing) {
    if (replacementPolicy === "fail" || replacementPolicy === "preserveExisting") {
      return {
        ok: false,
        errors: [{ code: "TERRAIN_EXISTS", message: `Tile (${pos.x},${pos.y}) already has terrain.` }],
        events: [],
      };
    }
    state.terrain = state.terrain.filter((t) => t.id !== existing.id);
  }
  state.terrain.push({
    id: nextId("terrain"),
    x: pos.x,
    y: pos.y,
    terrainId,
    remainingRounds: duration === "permanent" ? null : duration,
  });
  return { ok: true, errors: [], events: [`${def.name} appears at (${pos.x},${pos.y}).`] };
}

/**
 * Resolve entry triggers for one tile entry, in tile order (caller iterates
 * the path). Hazard damage can KO; statuses apply per definition.
 */
export function resolveTileEntry(
  state: GameState,
  characterId: string,
  pos: Position,
): { events: string[]; knockedOut: boolean; matchEnded: boolean } {
  const events: string[] = [];
  const t = terrainAt(state, pos);
  if (!t) return { events, knockedOut: false, matchEnded: false };
  const def = getTerrainDefinition(t.terrainId);
  if (!def) return { events, knockedOut: false, matchEnded: false };
  if (def.hazard && def.hazard.timing === "onEntry") {
    const outcome = dealDamage(state, characterId, def.hazard.amount, def.hazard.label);
    events.push(...outcome.events);
    if (outcome.knockedOut || outcome.matchEnded)
      return { events, knockedOut: outcome.knockedOut, matchEnded: outcome.matchEnded };
  }
  if (def.onEntryStatus) {
    events.push(applyStatus(state, characterId, def.onEntryStatus.statusId, def.onEntryStatus.duration));
  }
  return { events, knockedOut: false, matchEnded: false };
}

/**
 * End-of-round terrain phase (spec §5.3 ordering completed by round loop):
 * hazard end-of-round damage to occupants, then decrement + remove expired.
 */
export function tickTerrainEndOfRound(state: GameState): string[] {
  const events: string[] = [];
  for (const t of [...state.terrain]) {
    const def = getTerrainDefinition(t.terrainId);
    if (def?.hazard && def.hazard.timing === "endOfRound") {
      const occupant = state.characters.find(
        (c) => c.health > 0 && c.position.x === t.x && c.position.y === t.y,
      );
      if (occupant) {
        const outcome = dealDamage(state, occupant.id, def.hazard.amount, def.hazard.label);
        events.push(...outcome.events);
        if (outcome.matchEnded) return events;
      }
    }
  }
  for (const t of [...state.terrain]) {
    if (t.remainingRounds === null) continue;
    t.remainingRounds -= 1;
    if (t.remainingRounds <= 0) {
      state.terrain = state.terrain.filter((x) => x.id !== t.id);
      const def = getTerrainDefinition(t.terrainId);
      events.push(`${def?.name ?? t.terrainId} at (${t.x},${t.y}) expires.`);
    }
  }
  return events;
}
