// Grid targeting: legality, tile resolution, affected characters.
// Spec v2 §4.5, §10. Engine owns these; UI previews and resolution share them.
//
// Documented defaults (spec silent):
// - Ranged character/tile/area attacks require line of sight unless the card
//   opts out (`requiresLineOfSight: false`). Melee (distance ≤ 1) always has
//   LOS (adjacent tiles share an edge). Direction/line attacks propagate tile
//   by tile instead (see `includeBlocker`), no separate LOS check.
// - `tile` attacks affect all living occupants (no allegiance filter in data).
// - `direction` attacks default to enemies-only allegiance.
// - Blocking tiles are illegal tile targets.
// - `area` origin range defaults to unlimited when `maxRange` is omitted.
// - Area LOS is checked source→origin only; shape propagation is geometric.
import { blockingTiles } from "./terrain";
import {
  GRID_COLS,
  GRID_ROWS,
  hasLineOfSight,
  inBounds,
  key,
  manhattan,
  shapeTiles,
} from "./grid";
import { occupantAt } from "../state";
import type {
  ActionError,
  AllegianceFilter,
  CardDefinition,
  CharacterState,
  Direction,
  GameState,
  Position,
  Targeting,
  TargetOption,
  TargetSelection,
  ValidationResult,
} from "../types";

function err(code: string, message: string): ActionError {
  return { code, message };
}

function findSource(state: GameState, sourceId: string): CharacterState | undefined {
  return state.characters.find((c) => c.id === sourceId);
}

function living(state: GameState): CharacterState[] {
  return state.characters.filter((c) => c.health > 0);
}

function describeTile(p: Position): string {
  return `(${p.x},${p.y})`;
}

function describeChar(c: CharacterState): string {
  return `${c.definitionId} (${c.ownerId}) @${describeTile(c.position)}`;
}

function matchesAllegiance(
  c: CharacterState,
  source: CharacterState,
  allegiance: AllegianceFilter,
): boolean {
  switch (allegiance) {
    case "enemies":
      return c.ownerId !== source.ownerId;
    case "allies":
    case "selfAndAllies":
      return c.ownerId === source.ownerId;
    case "all":
      return true;
  }
}

function inRange(source: Position, target: Position, range: number | "melee" | "any"): boolean {
  if (range === "any") return true;
  if (range === "melee") return manhattan(source, target) <= 1;
  return manhattan(source, target) <= range;
}

function rangeLabel(range: number | "melee" | "any"): string {
  if (range === "any") return "any range";
  if (range === "melee") return "adjacent";
  return `range ${range}`;
}

// ---------------------------------------------------------------------------
// Tile resolution: selection -> affected tiles ([] when illegal).
// ---------------------------------------------------------------------------

export function resolveTiles(
  state: GameState,
  sourceId: string,
  card: CardDefinition,
  selection: TargetSelection,
): Position[] {
  if (!validateTarget(state, sourceId, card, selection).ok) return [];
  const source = findSource(state, sourceId)!;
  const t = card.targeting;
  const blocked = blockingTiles(state);
  switch (t.kind) {
    case "self":
      return [{ ...source.position }];
    case "character": {
      if (selection.kind !== "character") return [];
      const target = living(state).find((c) => c.id === selection.characterId);
      return target ? [{ ...target.position }] : [];
    }
    case "tile":
      return selection.kind === "tile" ? [{ ...selection.pos }] : [];
    case "direction": {
      if (selection.kind !== "direction") return [];
      return shapeTiles(source.position, "line", {
        direction: selection.direction,
        maxLength: t.maxLength,
        blocked,
        includeBlocker: t.includeBlocker,
      });
    }
    case "area": {
      if (t.shape === "allEnemies" || t.shape === "sourceAndAdjacent") {
        return shapeTiles(source.position, t.shape === "allEnemies" ? "radiusManhattan" : "sourceAndAdjacent", {
          radius: t.shape === "allEnemies" ? GRID_COLS + GRID_ROWS : undefined,
        });
      }
      if (t.shape === "line") {
        if (selection.kind !== "direction") return [];
        return shapeTiles(source.position, "line", {
          direction: selection.direction,
          maxLength: t.maxLength ?? 0,
          blocked,
          includeBlocker: t.includeBlocker,
        });
      }
      if (selection.kind !== "tile") return [];
      return shapeTiles(selection.pos, t.shape, {
        radius: t.radius,
        width: t.width,
        height: t.height,
      });
    }
  }
}

/** Default allegiance for targeting kinds that carry none in data. */
function effectiveAllegiance(card: CardDefinition): AllegianceFilter {
  const t = card.targeting;
  if (t.kind === "character" || t.kind === "area") return t.allegiance;
  if (t.kind === "self") return "allies";
  return "enemies"; // tile: all occupants handled below; direction: enemies
}

/**
 * Characters hit by locked tiles/characters, stable y,x tile order.
 * `tile`-targeted attacks affect every living occupant.
 */
export function getAffectedCharacters(
  state: GameState,
  sourceId: string,
  card: CardDefinition,
  selection: TargetSelection,
): string[] {
  const source = findSource(state, sourceId);
  if (!source) return [];
  const tiles = resolveTiles(state, sourceId, card, selection);
  if (tiles.length === 0) return [];
  const t = card.targeting;
  const allegiance =
    t.kind === "tile" ? ("all" as AllegianceFilter) : effectiveAllegiance(card);
  const ids = new Set<string>();
  for (const tile of tiles) {
    const occupant = occupantAt(state, tile);
    if (occupant && matchesAllegiance(occupant, source, allegiance)) ids.add(occupant.id);
  }
  const chars = [...ids]
    .map((id) => living(state).find((c) => c.id === id)!)
    .filter(Boolean)
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  return chars.map((c) => c.id);
}

// ---------------------------------------------------------------------------
// Validation.
// ---------------------------------------------------------------------------

function selectionShapeOk(t: Targeting, selection: TargetSelection): boolean {
  switch (t.kind) {
    case "self":
      return selection.kind === "automatic";
    case "character":
      return selection.kind === "character";
    case "tile":
      return selection.kind === "tile";
    case "direction":
      return selection.kind === "direction";
    case "area":
      if (t.shape === "allEnemies" || t.shape === "sourceAndAdjacent")
        return selection.kind === "automatic";
      if (t.shape === "line") return selection.kind === "direction";
      return selection.kind === "tile";
  }
}

export function validateTarget(
  state: GameState,
  sourceId: string,
  card: CardDefinition,
  selection: TargetSelection,
  opts: { lenientRange?: boolean } = {},
): ValidationResult {
  const source = findSource(state, sourceId);
  if (!source) return { ok: false, errors: [err("SOURCE_MISSING", "Unknown character.")] };
  if (source.health <= 0)
    return { ok: false, errors: [err("SOURCE_KNOCKED_OUT", "Knocked-out characters cannot act.")] };
  const t = card.targeting;
  if (!selectionShapeOk(t, selection))
    return {
      ok: false,
      errors: [err("TARGET_MISMATCH", "This selection does not fit the card's target pattern.")],
    };
  const blocked = blockingTiles(state);
  // Lenient mode (dash-strike cards): allegiance/occupancy checked now,
  // range and line of sight re-checked from the post-movement tile.
  const checkRange = !opts.lenientRange;

  if (t.kind === "character" && selection.kind === "character") {
    const target = state.characters.find((c) => c.id === selection.characterId);
    if (!target) return { ok: false, errors: [err("TARGET_MISSING", "Unknown target.")] };
    if (target.health <= 0)
      return { ok: false, errors: [err("TARGET_KNOCKED_OUT", `${describeChar(target)} is knocked out.`)] };
    if (!matchesAllegiance(target, source, t.allegiance))
      return { ok: false, errors: [err("WRONG_ALLEGIANCE", "This card cannot target that character.")] };
    if (checkRange && !inRange(source.position, target.position, t.range))
      return {
        ok: false,
        errors: [err("OUT_OF_RANGE", `Target is beyond ${rangeLabel(t.range)}.`)],
      };
    if (checkRange && (t.requiresLineOfSight ?? true) && t.range !== "melee") {
      if (!hasLineOfSight(source.position, target.position, blocked))
        return { ok: false, errors: [err("NO_LINE_OF_SIGHT", "A blocker breaks line of sight.")] };
    }
    return { ok: true, errors: [] };
  }

  if (t.kind === "tile" && selection.kind === "tile") {
    const pos = selection.pos;
    if (!inBounds(pos))
      return { ok: false, errors: [err("OUT_OF_BOUNDS", `Tile ${describeTile(pos)} is off the board.`)] };
    if (checkRange && !inRange(source.position, pos, t.range))
      return { ok: false, errors: [err("OUT_OF_RANGE", `Tile is beyond ${rangeLabel(t.range)}.`) ] };
    if (blocked.has(key(pos)))
      return { ok: false, errors: [err("TILE_BLOCKED", `Tile ${describeTile(pos)} holds blocking terrain.`)] };
    if (!t.allowsOccupiedTile && occupantAt(state, pos))
      return { ok: false, errors: [err("TILE_OCCUPIED", `Tile ${describeTile(pos)} is occupied.`)] };
    if (checkRange && !hasLineOfSight(source.position, pos, blocked))
      return { ok: false, errors: [err("NO_LINE_OF_SIGHT", "A blocker breaks line of sight.")] };
    return { ok: true, errors: [] };
  }

  if (t.kind === "direction" && selection.kind === "direction") {
    if (!t.directions.includes(selection.direction))
      return { ok: false, errors: [err("TARGET_MISMATCH", "That direction is not allowed by this card.")] };
    return { ok: true, errors: [] };
  }

  if (t.kind === "area") {
    if (t.shape === "allEnemies" || t.shape === "sourceAndAdjacent") return { ok: true, errors: [] };
    if (t.shape === "line") return { ok: true, errors: [] }; // direction validated by shape
    if (selection.kind !== "tile") return { ok: false, errors: [err("TARGET_MISMATCH", "This card needs an origin tile.")] };
    const pos = selection.pos;
    if (!inBounds(pos))
      return { ok: false, errors: [err("OUT_OF_BOUNDS", `Tile ${describeTile(pos)} is off the board.`)] };
    if (checkRange && t.maxRange !== undefined && manhattan(source.position, pos) > t.maxRange)
      return { ok: false, errors: [err("OUT_OF_RANGE", `Origin is beyond range ${t.maxRange}.`)] };
    if (checkRange && (t.requiresLineOfSight ?? true) && !hasLineOfSight(source.position, pos, blocked))
      return { ok: false, errors: [err("NO_LINE_OF_SIGHT", "A blocker breaks line of sight to the origin.")] };
    return { ok: true, errors: [] };
  }

  return { ok: true, errors: [] };
}

// ---------------------------------------------------------------------------
// Options (including illegal candidates with reasons for UI explanations).
// ---------------------------------------------------------------------------

export function getLegalTargets(
  state: GameState,
  sourceId: string,
  card: CardDefinition,
): TargetOption[] {
  const source = findSource(state, sourceId);
  if (!source || source.health <= 0) return [];
  const t = card.targeting;
  const mk = (selection: TargetSelection, label: string, primary?: string): TargetOption => {
    const result = validateTarget(state, sourceId, card, selection);
    const tiles = result.ok ? resolveTiles(state, sourceId, card, selection) : [];
    const affected = result.ok ? getAffectedCharacters(state, sourceId, card, selection) : [];
    return {
      selection,
      label: `${label} (${affected.length} affected)`,
      isLegal: result.ok,
      illegalReason: result.ok ? undefined : result.errors[0],
      affectedTiles: tiles,
      affectedCharacterIds: affected,
      primaryCharacterId: primary ?? affected[0],
    };
  };

  switch (t.kind) {
    case "self":
      return [mk({ kind: "automatic" }, `${source.definitionId} (self)`)];
    case "character":
      return living(state)
        .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
        .map((c) =>
          mk({ kind: "character", characterId: c.id }, describeChar(c), c.id),
        );
    case "tile": {
      const options: TargetOption[] = [];
      for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          const pos = { x, y };
          options.push(mk({ kind: "tile", pos }, `Tile ${describeTile(pos)}`));
        }
      }
      return options;
    }
    case "direction": {
      const all: Direction[] = ["north", "east", "south", "west"];
      // Disallowed directions surface as illegal TARGET_MISMATCH options.
      return all.map((direction) => mk({ kind: "direction", direction }, `Direction ${direction}`));
    }
    case "area": {
      if (t.shape === "allEnemies" || t.shape === "sourceAndAdjacent")
        return [mk({ kind: "automatic" }, `${t.shape}`)];
      if (t.shape === "line") {
        const all: Direction[] = ["north", "east", "south", "west"];
        return all.map((direction) => mk({ kind: "direction", direction }, `Line ${direction}`));
      }
      const options: TargetOption[] = [];
      for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          const pos = { x, y };
          options.push(mk({ kind: "tile", pos }, `Origin ${describeTile(pos)}`));
        }
      }
      return options;
    }
  }
}
