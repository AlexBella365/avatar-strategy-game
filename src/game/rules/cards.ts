// Card validation + effect resolution. Spec §9–§10.
// The single authoritative entry point will be:
//   applyGameAction(state, action) -> { state, events, errors }
// TODO(step 3): implement per §8 phase 4 resolution order.
import type { ActionResult, GameAction, GameState } from "../types";
import { cloneState } from "../state";

export function applyGameAction(state: GameState, action: GameAction): ActionResult {
  const next = cloneState(state);
  next.log.push(`(stub) action received: ${action.type}`);
  return { state: next, errors: [], events: [] };
}
