// Shared engine-test setup: 3v3 on the 7×7 board, edge-row deployment
// (north row 0, south row 6 — spec §4.2). Sides pinned for determinism.
//
// Engine tests run on the *neutral* tuning (legacy 1-tile movement, full HP,
// no damage/healing multipliers) so assertions about rules mechanics stay
// independent of balance data. Shipped tuning lives in content/balance.ts and
// has its own test; the self-play harness overrides tuning per cell.
import { CHARACTERS } from "./content/characters";
import { createInitialState, type TeamSetup } from "./state";
import type { GameState, Position } from "./types";

export const TEST_TUNING = {
  movement: 1,
  hpScale: 1,
  deploymentInset: 0,
  energyPerRound: 4,
  healingScale: 1,
  damageScale: 1,
} as const;

export const OPEN: [Position[], Position[]] = [
  [
    { x: 1, y: 0 },
    { x: 3, y: 0 },
    { x: 5, y: 0 },
  ],
  [
    { x: 1, y: 6 },
    { x: 3, y: 6 },
    { x: 5, y: 6 },
  ],
];

export function setup(positions: [Position[], Position[]] = OPEN): GameState {
  const teams: [TeamSetup, TeamSetup] = [
    { playerId: "p1", characterDefs: [CHARACTERS[0], CHARACTERS[1], CHARACTERS[3]], positions: positions[0] },
    { playerId: "p2", characterDefs: [CHARACTERS[2], CHARACTERS[4], CHARACTERS[5]], positions: positions[1] },
  ];
  return createInitialState(teams, 1, { northPlayerId: "p1", tuning: TEST_TUNING });
}
