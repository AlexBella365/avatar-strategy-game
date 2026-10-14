// Targeting: legal targets + affected-area calculation.
// Spec §4, §10. Engine owns these; UI only calls them (no duplicate rules).
import type { CharacterState, GameState, Lane } from "../types";

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

// TODO(step 2): getLegalTargets / getAffectedCharacters / validateTarget
// per spec §10.2. Stubbed until card resolution lands.
export function getLegalTargets(): string[] {
  throw new Error("not implemented (step 2: targeting)");
}
