// Grid movement entry points. Full rules (validateMove, Evade, push/pull/swap)
// land in step 3 (§4.4, §4.7, §4A); this module currently hosts the shared
// adjacency predicate used by geometry tests and the UI.
import { isOrthogonalAdjacent } from "./grid";
import type { Position } from "../types";

export function isAdjacentStep(from: Position, to: Position): boolean {
  return isOrthogonalAdjacent(from, to);
}
