// Match state: init + immutable helpers. Spec v2 §3, §4, §6, §8.
import { GRID_COLS, GRID_ROWS, inBounds, key } from "./rules/grid";
import type {
  AvatarStateStatus,
  CharacterDefinition,
  CharacterState,
  GameState,
  Position,
} from "./types";

export const MAX_FOCUS = 4;
export const STARTING_FOCUS = 1;
export const ENERGY_PER_ROUND = 4;
export const MAX_ROUNDS = 8;

/** Deployment rows: first team rows 0–1, second team rows 3–4 (spec §4.2). */
export const DEPLOYMENT_ROWS: [number[], number[]] = [
  [0, 1],
  [3, 4],
];

export function maxHealthFor(resilience: number, override?: number): number {
  if (override !== undefined) return override;
  return Math.max(10, 16 + 2 * (resilience - 3));
}

function initialAvatarStatus(
  def: CharacterDefinition,
): AvatarStateStatus | undefined {
  if (!def.avatarState?.enabled) return undefined;
  return {
    resonance: 0,
    active: false,
    roundsRemaining: 0,
    activatedThisMatch: false,
  };
}

export interface TeamSetup {
  playerId: string;
  characterDefs: CharacterDefinition[];
  positions: Position[];
}

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function createCharacter(
  def: CharacterDefinition,
  ownerId: string,
  instanceId: string,
  position: Position,
): CharacterState {
  return {
    id: instanceId,
    definitionId: def.id,
    ownerId,
    health: maxHealthFor(def.attributes.resilience, def.maxHealthOverride),
    maxHealth: maxHealthFor(def.attributes.resilience, def.maxHealthOverride),
    focus: STARTING_FOCUS,
    position: { ...position },
    statuses: [],
    shields: [],
    passiveUsesThisRound: {},
    reactionUsedThisRound: false,
    activatedThisRound: false,
    movementSpent: 0,
    momentum: 0,
    avatarState: initialAvatarStatus(def),
  };
}

/** Living character on a tile, if any (KO removes occupancy immediately). */
export function occupantAt(state: GameState, pos: Position): CharacterState | undefined {
  return state.characters.find(
    (c) => c.health > 0 && c.position.x === pos.x && c.position.y === pos.y,
  );
}

/** Setup-time deployment validation (spec §4.2). Empty = legal. */
export function deploymentErrors(teams: [TeamSetup, TeamSetup]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  teams.forEach((team, ti) => {
    team.characterDefs.forEach((_def, i) => {
      const pos = team.positions[i];
      const label = `${team.playerId}-c${i}`;
      if (!pos) {
        errors.push(`${label}: missing deployment tile.`);
        return;
      }
      if (!inBounds(pos)) {
        errors.push(`${label}: tile (${pos.x},${pos.y}) is outside the ${GRID_COLS}×${GRID_ROWS} board.`);
        return;
      }
      if (!DEPLOYMENT_ROWS[ti].includes(pos.y)) {
        errors.push(
          `${label}: tile (${pos.x},${pos.y}) is outside the deployment zone (rows ${DEPLOYMENT_ROWS[ti].join(", ")}).`,
        );
      }
      const k = key(pos);
      if (seen.has(k)) errors.push(`${label}: tile (${pos.x},${pos.y}) is already occupied.`);
      seen.add(k);
    });
  });
  return errors;
}

/** Create a fresh match with empty hands (hands dealt in round setup later). */
export function createInitialState(teams: [TeamSetup, TeamSetup]): GameState {
  const errors = deploymentErrors(teams);
  if (errors.length > 0) throw new Error(`Illegal deployment:\n${errors.join("\n")}`);
  const characters: CharacterState[] = [];
  for (const team of teams) {
    team.characterDefs.forEach((def, i) => {
      characters.push(
        createCharacter(def, team.playerId, `${team.playerId}-c${i}`, team.positions[i]),
      );
    });
  }
  return {
    round: 1,
    maxRounds: MAX_ROUNDS,
    initiativePlayerId: "p0",
    characters,
    players: teams.map((t) => ({
      id: t.playerId,
      energy: ENERGY_PER_ROUND,
      teamHand: [],
      characterHands: {},
      intentions: {},
    })),
    terrain: [],
    log: ["Match created."],
    winnerId: null,
    isDraw: false,
    roundEventLog: [],
  };
}

/** Deep-clone serializable state (engine must never mutate inputs). */
export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

export function getCharacter(state: GameState, id: string): CharacterState | undefined {
  return state.characters.find((c) => c.id === id);
}

export function isAlive(c: CharacterState): boolean {
  return c.health > 0;
}
