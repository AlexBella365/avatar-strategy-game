// Pure grid geometry: bounds, distance, adjacency, line of sight,
// movement paths/costs, AoE shape tiles. Spec v2 §4.1, §4.3, §4.5, §10.
// No game-state imports: terrain/occupancy enter as explicit tile sets so
// these functions stay pure, deterministic, and shared by UI + engine.
//
// Conventions:
// - Tiles sorted by row (y) then column (x) for stable resolution order.
// - `line` shapes extend from (excluding) the origin tile.
// - `rectangle` uses the origin as its northwest corner, extending east/south.
// - Line of sight excludes the source tile and the target tile; blockers in
//   between break it. Whether a blocking target tile is hittable is card data.
import type { AreaShapeName, Direction, Position } from "../types";

export const GRID_COLS = 7;
export const GRID_ROWS = 7;
export const BASE_MOVEMENT = 2;

export const DIRECTION_VECTORS: Record<Direction, Position> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

export function key(p: Position): string {
  return `${p.x},${p.y}`;
}

export function inBounds(p: Position): boolean {
  return p.x >= 0 && p.x < GRID_COLS && p.y >= 0 && p.y < GRID_ROWS;
}

/** Manhattan distance (spec §4.3). Diagonals do not count as one step. */
export function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function isOrthogonalAdjacent(a: Position, b: Position): boolean {
  return manhattan(a, b) === 1;
}

export function orthogonalNeighbors(p: Position): Position[] {
  const out: Position[] = [];
  for (const d of Object.values(DIRECTION_VECTORS)) {
    const n = { x: p.x + d.x, y: p.y + d.y };
    if (inBounds(n)) out.push(n);
  }
  return out;
}

export function step(p: Position, d: Direction): Position {
  const v = DIRECTION_VECTORS[d];
  return { x: p.x + v.x, y: p.y + v.y };
}

/** Stable tile order: row (y) first, then column (x) (spec §10.2). */
export function sortTiles(tiles: Position[]): Position[] {
  return [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Deterministic grid line (Bresenham), inclusive of both endpoints. */
export function lineTiles(a: Position, b: Position): Position[] {
  const tiles: Position[] = [];
  let x0 = a.x;
  let y0 = a.y;
  const dx = Math.abs(b.x - x0);
  const dy = -Math.abs(b.y - y0);
  const sx = x0 < b.x ? 1 : -1;
  const sy = y0 < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    tiles.push({ x: x0, y: y0 });
    if (x0 === b.x && y0 === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return tiles;
}

/** True when no blocked tile sits strictly between source and target. */
export function hasLineOfSight(a: Position, b: Position, blocked: Set<string>): boolean {
  const line = lineTiles(a, b);
  for (let i = 1; i < line.length - 1; i++) {
    if (blocked.has(key(line[i]))) return false;
  }
  return true;
}

export interface ReachabilityOptions {
  allowance: number;
  blocked: Set<string>; // blocking terrain: cannot enter or pass
  occupied: Set<string>; // living characters: cannot enter or pass
  difficult: Set<string>; // costs 2 movement points to enter
}

/**
 * Destinations reachable within `allowance` (Dijkstra; tiny board).
 * Excludes the start tile. Entry into blocked/occupied tiles is illegal;
 * passing through them is illegal too.
 */
export function reachableTiles(
  start: Position,
  opts: ReachabilityOptions,
): Map<string, number> {
  const costs = new Map<string, number>([[key(start), 0]]);
  const frontier: { pos: Position; cost: number }[] = [{ pos: start, cost: 0 }];
  while (frontier.length > 0) {
    let best = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i].cost < frontier[best].cost) best = i;
    }
    const cur = frontier.splice(best, 1)[0];
    for (const nb of orthogonalNeighbors(cur.pos)) {
      const k = key(nb);
      if (opts.blocked.has(k) || opts.occupied.has(k)) continue;
      const next = cur.cost + (opts.difficult.has(k) ? 2 : 1);
      if (next > opts.allowance) continue;
      if (next < (costs.get(k) ?? Infinity)) {
        costs.set(k, next);
        frontier.push({ pos: nb, cost: next });
      }
    }
  }
  costs.delete(key(start));
  return costs;
}

export interface ShapeParams {
  direction?: Direction;
  maxLength?: number;
  radius?: number;
  width?: number;
  height?: number;
  blocked?: Set<string>; // line stop behavior
  includeBlocker?: boolean; // include the first blocking tile (default false)
}

/** Tiles covered by an AoE shape from an origin tile (sorted y,x). */
export function shapeTiles(
  origin: Position,
  shape: AreaShapeName,
  params: ShapeParams = {},
): Position[] {
  let tiles: Position[] = [];
  switch (shape) {
    case "singleTile":
      tiles = [origin];
      break;
    case "plus":
    case "sourceAndAdjacent":
      tiles = [origin, ...orthogonalNeighbors(origin)];
      break;
    case "line": {
      if (!params.direction || (params.maxLength ?? 0) <= 0) break;
      let cur = origin;
      for (let i = 0; i < (params.maxLength ?? 0); i++) {
        cur = step(cur, params.direction);
        if (!inBounds(cur)) break;
        if (params.blocked?.has(key(cur))) {
          if (params.includeBlocker) tiles.push(cur);
          break;
        }
        tiles.push(cur);
      }
      break;
    }
    case "rectangle": {
      const w = params.width ?? 1;
      const h = params.height ?? 1;
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const p = { x: origin.x + dx, y: origin.y + dy };
          if (inBounds(p)) tiles.push(p);
        }
      }
      break;
    }
    case "radiusManhattan": {
      const r = params.radius ?? 0;
      for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          const p = { x, y };
          if (manhattan(origin, p) <= r) tiles.push(p);
        }
      }
      break;
    }
    case "allEnemies":
      // Global shape resolved at targeting level from character lists, not tiles.
      tiles = [];
      break;
  }
  return sortTiles(tiles);
}
