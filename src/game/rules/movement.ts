// Movement rules. Spec §4.2.
import type { GameState, Position } from "../types";

export function isAdjacentStep(from: Position, to: Position): boolean {
  const laneChanged = from.lane !== to.lane;
  const rankChanged = from.rank !== to.rank;
  if (laneChanged && rankChanged) return false; // one step only
  if (!laneChanged && !rankChanged) return false;
  if (laneChanged) {
    // left<->center, center<->right only
    if (from.rank !== to.rank) return false;
    const pair = [from.lane, to.lane].sort().join(",");
    return pair === "center,left" || pair === "center,right";
  }
  return true; // front<->rear same lane
}

// TODO(step 2): validateMove(state, characterId, to) — ally occupancy,
// Bound, obstacle/terrain blocking. Stubbed until round loop lands.
export function validateMove(_state: GameState, _charId: string, _to: Position): string | null {
  void _state;
  void _charId;
  void _to;
  throw new Error("not implemented (step 2: movement)");
}
