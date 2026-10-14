// Shared engine-test setup: 3v3 on the 7×5 grid.
import { CHARACTERS } from "./content/characters";
import { createInitialState, type TeamSetup } from "./state";
import type { GameState, Position } from "./types";

export const OPEN: [Position[], Position[]] = [
  [
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 5, y: 1 },
  ],
  [
    { x: 1, y: 3 },
    { x: 3, y: 3 },
    { x: 5, y: 3 },
  ],
];

export function setup(positions: [Position[], Position[]] = OPEN): GameState {
  const teams: [TeamSetup, TeamSetup] = [
    { playerId: "p0", characterDefs: [CHARACTERS[0], CHARACTERS[1], CHARACTERS[3]], positions: positions[0] },
    { playerId: "p1", characterDefs: [CHARACTERS[2], CHARACTERS[4], CHARACTERS[5]], positions: positions[1] },
  ];
  return createInitialState(teams);
}
