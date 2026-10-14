// Targeting: legal targets + affected-area calculation.
// Spec §4, §10. Engine owns these; UI only calls them (no duplicate rules).
import type {
  ActionError,
  AllegianceFilter,
  CardDefinition,
  CharacterState,
  GameState,
  Lane,
  Targeting,
  TargetOption,
  TargetSelection,
  ValidationResult,
} from "../types";

export const LANE_ORDER: Lane[] = ["left", "center", "right"];

export function adjacentLanes(lane: Lane): Lane[] {
  if (lane === "center") return ["left", "right"];
  return ["center"];
}

/** Stable order for multi-target resolution: lane order, front before rear, p0 before p1. */
export function sortCharactersStable(chars: CharacterState[]): CharacterState[] {
  const laneIdx = (l: Lane) => LANE_ORDER.indexOf(l);
  return [...chars].sort((a, b) => {
    if (laneIdx(a.position.lane) !== laneIdx(b.position.lane))
      return laneIdx(a.position.lane) - laneIdx(b.position.lane);
    if (a.position.rank !== b.position.rank) return a.position.rank === "front" ? -1 : 1;
    if (a.ownerId !== b.ownerId) return a.ownerId < b.ownerId ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}

/** Front-rank protection: melee cannot target protected rear (spec §4.3). */
export function isProtectedByFront(
  state: GameState,
  target: CharacterState,
): boolean {
  if (target.position.rank !== "rear") return false;
  return state.characters.some(
    (c) =>
      c.ownerId === target.ownerId &&
      c.health > 0 &&
      c.position.lane === target.position.lane &&
      c.position.rank === "front",
  );
}

// ---------------------------------------------------------------------------
// Engine targeting API (spec §10.2). UI previews and card resolution share
// these functions; neither may reimplement membership rules.
//
// Documented simplifications (spec details unspecified):
// - Melee reach is the attacker's own lane (front or rear slot of that lane).
// - `singleAlly` may include the source itself (a character is its own ally).
// - Front-rank protection applies only to melee single-target attacks
//   (spec §4.3 covers ranged/AoE bypass explicitly).
// - Obstacle blocks ranged/`any` single-target attacks crossing into or past
//   an obstacle lane. Same-lane attacks and lane/area shapes are unaffected
//   by default; `ignoresObstacle` bypasses the block.
// - `cross` shape = whole source lane (both ranks) + same-rank characters in
//   adjacent lanes, then allegiance/`canHitRear` filters apply.
// ---------------------------------------------------------------------------

function err(code: string, message: string): ActionError {
  return { code, message };
}

export function defaultAllegiance(card: CardDefinition): AllegianceFilter {
  if (card.allegiance) return card.allegiance;
  return card.cardType === "attack" ? "enemies" : "allies";
}

function livingCharacters(state: GameState): CharacterState[] {
  return state.characters.filter((c) => c.health > 0);
}

function findSource(state: GameState, sourceId: string): CharacterState | undefined {
  return state.characters.find((c) => c.id === sourceId);
}

/** Lanes strictly between two lanes along Left—Center—Right. */
export function lanesBetween(from: Lane, to: Lane): Lane[] {
  if (from === to) return [];
  const i = LANE_ORDER.indexOf(from);
  const j = LANE_ORDER.indexOf(to);
  const [a, b] = i < j ? [i, j] : [j, i];
  return LANE_ORDER.slice(a + 1, b);
}

/** True when a ranged attack from `fromLane` to `toLane` crosses an obstacle. */
export function obstacleBlocks(state: GameState, fromLane: Lane, toLane: Lane): boolean {
  if (fromLane === toLane) return false;
  const crossed: Lane[] = [...lanesBetween(fromLane, toLane), toLane];
  return state.terrain.some(
    (t) => t.terrainId === "obstacle" && crossed.includes(t.lane),
  );
}

function describeCharacter(c: CharacterState): string {
  return `${c.definitionId} (${c.ownerId}) — ${c.position.lane}/${c.position.rank}`;
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

function singleEnemyReason(
  state: GameState,
  source: CharacterState,
  target: CharacterState,
  range: "melee" | "ranged" | "any",
  canTargetRear: boolean,
  card: CardDefinition,
): ActionError | null {
  if (target.health <= 0)
    return err("TARGET_KNOCKED_OUT", `${describeCharacter(target)} is knocked out.`);
  if (target.ownerId === source.ownerId)
    return err("WRONG_ALLEGIANCE", "This attack must target an enemy.");
  if (range === "melee" && target.position.lane !== source.position.lane)
    return err("OUT_OF_RANGE", "Melee attacks only reach the attacker's own lane.");
  if (target.position.rank === "rear") {
    if (range === "melee" && isProtectedByFront(state, target))
      return err(
        "FRONT_PROTECTED",
        "A living enemy in front protects this rear character from melee.",
      );
    if (!canTargetRear)
      return err("REAR_UNREACHABLE", "This attack cannot target rear-rank characters.");
  }
  if (
    (range === "ranged" || range === "any") &&
    !card.ignoresObstacle &&
    obstacleBlocks(state, source.position.lane, target.position.lane)
  )
    return err("OBSTACLE_BLOCKED", "An obstacle blocks this ranged attack.");
  return null;
}

function singleAllyReason(
  source: CharacterState,
  target: CharacterState,
  range: "sameLane" | "adjacentLane" | "any",
): ActionError | null {
  if (target.health <= 0)
    return err("TARGET_KNOCKED_OUT", `${describeCharacter(target)} is knocked out.`);
  if (target.ownerId !== source.ownerId)
    return err("WRONG_ALLEGIANCE", "This effect must target an ally.");
  const sl = source.position.lane;
  const tl = target.position.lane;
  if (range === "sameLane" && sl !== tl)
    return err("OUT_OF_RANGE", "This effect only reaches the same lane.");
  if (range === "adjacentLane" && sl !== tl && !adjacentLanes(sl).includes(tl))
    return err("OUT_OF_RANGE", "This effect only reaches adjacent lanes.");
  return null;
}

/** Lanes covered by a `lane` targeting mode given the player's selection. */
function laneTargetLanes(
  laneSelection: "current" | "chosen" | "adjacent" | "all",
  source: CharacterState,
  selection: TargetSelection,
): Lane[] {
  switch (laneSelection) {
    case "current":
      return [source.position.lane];
    case "chosen":
      return selection.kind === "lane" ? [selection.lane] : [];
    case "adjacent":
      return adjacentLanes(source.position.lane);
    case "all":
      return [...LANE_ORDER];
  }
}

/** Members of an `area` shape before `canHitRear` filtering (living only). */
function areaMembers(
  source: CharacterState,
  card: CardDefinition,
  selection: TargetSelection,
  living: CharacterState[],
): CharacterState[] {
  const t = card.targeting;
  if (t.kind !== "area") return [];
  const allegiance = defaultAllegiance(card);
  const matching = living.filter((c) => matchesAllegiance(c, source, allegiance));
  switch (t.shape) {
    case "allEnemiesInLane":
      if (selection.kind !== "lane") return [];
      return matching.filter((c) => c.position.lane === selection.lane);
    case "adjacentLanes": {
      const lanes = [source.position.lane, ...adjacentLanes(source.position.lane)];
      return matching.filter((c) => lanes.includes(c.position.lane));
    }
    case "cross": {
      const adj = adjacentLanes(source.position.lane);
      return matching.filter(
        (c) =>
          c.position.lane === source.position.lane ||
          (adj.includes(c.position.lane) && c.position.rank === source.position.rank),
      );
    }
    case "allEnemies":
      return matching;
  }
}

/**
 * Characters affected by a card + locked selection, in stable resolution order.
 * Returns [] when the selection is illegal (spec §10.2: resolution only locks
 * legal targets; a target that becomes invalid fizzles instead of hitting
 * illegally). Always consistent with `validateTarget` and option previews.
 */
export function getAffectedCharacters(
  state: GameState,
  sourceId: string,
  card: CardDefinition,
  selection: TargetSelection,
): string[] {
  if (!validateTarget(state, sourceId, card, selection).ok) return [];
  const source = findSource(state, sourceId);
  if (!source || source.health <= 0) return [];
  const living = livingCharacters(state);
  const t = card.targeting;
  let members: CharacterState[];
  switch (t.kind) {
    case "self":
      members = [source];
      break;
    case "singleEnemy":
    case "singleAlly":
      if (selection.kind !== "character") return [];
      members = living.filter((c) => c.id === selection.characterId);
      break;
    case "lane": {
      const lanes = laneTargetLanes(t.laneSelection, source, selection);
      const allegiance = defaultAllegiance(card);
      members = living.filter(
        (c) => lanes.includes(c.position.lane) && matchesAllegiance(c, source, allegiance),
      );
      break;
    }
    case "area":
      members = areaMembers(source, card, selection, living);
      break;
    case "selfAndAdjacentAllies": {
      const lanes = [source.position.lane, ...adjacentLanes(source.position.lane)];
      members = living.filter(
        (c) => c.ownerId === source.ownerId && lanes.includes(c.position.lane),
      );
      break;
    }
  }
  if (card.canHitRear === false)
    members = members.filter((c) => c.position.rank === "front");
  return sortCharactersStable(members).map((c) => c.id);
}

/** Whether a selection has the shape a targeting mode requires. */
function selectionKindOk(t: Targeting, selection: TargetSelection): boolean {
  switch (t.kind) {
    case "self":
      return selection.kind === "automatic";
    case "singleEnemy":
    case "singleAlly":
      return selection.kind === "character";
    case "lane":
      return t.laneSelection === "chosen"
        ? selection.kind === "lane"
        : selection.kind === "automatic";
    case "area":
      return t.shape === "allEnemiesInLane"
        ? selection.kind === "lane"
        : selection.kind === "automatic";
    case "selfAndAdjacentAllies":
      return selection.kind === "automatic";
  }
}

/** Full legality check for a locked selection (costs/resources checked later). */
export function validateTarget(
  state: GameState,
  sourceId: string,
  card: CardDefinition,
  selection: TargetSelection,
): ValidationResult {
  const source = findSource(state, sourceId);
  if (!source) return { ok: false, errors: [err("SOURCE_MISSING", "Unknown character.")] };
  if (source.health <= 0)
    return { ok: false, errors: [err("SOURCE_KNOCKED_OUT", "Knocked-out characters cannot act.")] };
  const t = card.targeting;
  if (!selectionKindOk(t, selection))
    return {
      ok: false,
      errors: [err("TARGET_MISMATCH", "This selection does not fit the card's target pattern.")],
    };
  if (t.kind === "singleEnemy" && selection.kind === "character") {
    const target = state.characters.find((c) => c.id === selection.characterId);
    if (!target) return { ok: false, errors: [err("TARGET_MISSING", "Unknown target.")] };
    const reason = singleEnemyReason(state, source, target, t.range, t.canTargetRear, card);
    return reason ? { ok: false, errors: [reason] } : { ok: true, errors: [] };
  }
  if (t.kind === "singleAlly" && selection.kind === "character") {
    const target = state.characters.find((c) => c.id === selection.characterId);
    if (!target) return { ok: false, errors: [err("TARGET_MISSING", "Unknown target.")] };
    const reason = singleAllyReason(source, target, t.range);
    return reason ? { ok: false, errors: [reason] } : { ok: true, errors: [] };
  }
  return { ok: true, errors: [] };
}

function characterOptions(
  state: GameState,
  source: CharacterState,
  card: CardDefinition,
): TargetOption[] {
  const t = card.targeting;
  if (t.kind !== "singleEnemy" && t.kind !== "singleAlly") return [];
  return sortCharactersStable(livingCharacters(state)).map((c) => {
    const selection: TargetSelection = { kind: "character", characterId: c.id };
    const reason =
      t.kind === "singleEnemy"
        ? singleEnemyReason(state, source, c, t.range, t.canTargetRear, card)
        : singleAllyReason(source, c, t.range);
    const legal = reason === null;
    return {
      selection,
      label: describeCharacter(c),
      isLegal: legal,
      illegalReason: reason ?? undefined,
      affectedCharacterIds: legal ? [c.id] : [],
      primaryCharacterId: c.id,
    };
  });
}

/**
 * Every selectable target option for a card, including illegal candidates
 * with reasons (spec: the UI must show *why* a target is illegal).
 * `affectedCharacterIds` on each legal option is the exact preview that
 * resolution will use (`getAffectedCharacters`).
 */
export function getLegalTargets(
  state: GameState,
  sourceId: string,
  card: CardDefinition,
): TargetOption[] {
  const source = findSource(state, sourceId);
  if (!source || source.health <= 0) return [];
  const t = card.targeting;
  switch (t.kind) {
    case "self": {
      const selection: TargetSelection = { kind: "automatic" };
      return [
        {
          selection,
          label: `${describeCharacter(source)} (self)`,
          isLegal: true,
          affectedCharacterIds: getAffectedCharacters(state, sourceId, card, selection),
          primaryCharacterId: source.id,
        },
      ];
    }
    case "singleEnemy":
    case "singleAlly":
      return characterOptions(state, source, card);
    case "lane": {
      if (t.laneSelection === "chosen") {
        return LANE_ORDER.map((lane) => {
          const selection: TargetSelection = { kind: "lane", lane };
          const affected = getAffectedCharacters(state, sourceId, card, selection);
          return {
            selection,
            label: `Lane: ${lane} (${affected.length} affected)`,
            isLegal: true,
            affectedCharacterIds: affected,
          };
        });
      }
      const selection: TargetSelection = { kind: "automatic" };
      return [
        {
          selection,
          label: `Lane: ${t.laneSelection} (${getAffectedCharacters(state, sourceId, card, selection).length} affected)`,
          isLegal: true,
          affectedCharacterIds: getAffectedCharacters(state, sourceId, card, selection),
        },
      ];
    }
    case "area": {
      if (t.shape === "allEnemiesInLane") {
        return LANE_ORDER.map((lane) => {
          const selection: TargetSelection = { kind: "lane", lane };
          const affected = getAffectedCharacters(state, sourceId, card, selection);
          return {
            selection,
            label: `Lane: ${lane} (${affected.length} affected)`,
            isLegal: true,
            affectedCharacterIds: affected,
          };
        });
      }
      const selection: TargetSelection = { kind: "automatic" };
      return [
        {
          selection,
          label: `${t.shape} (${getAffectedCharacters(state, sourceId, card, selection).length} affected)`,
          isLegal: true,
          affectedCharacterIds: getAffectedCharacters(state, sourceId, card, selection),
        },
      ];
    }
    case "selfAndAdjacentAllies": {
      const selection: TargetSelection = { kind: "automatic" };
      return [
        {
          selection,
          label: `Self + adjacent allies (${getAffectedCharacters(state, sourceId, card, selection).length} affected)`,
          isLegal: true,
          affectedCharacterIds: getAffectedCharacters(state, sourceId, card, selection),
          primaryCharacterId: source.id,
        },
      ];
    }
  }
}
