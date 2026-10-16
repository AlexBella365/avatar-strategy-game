// Match state: init + immutable helpers. Spec v2 §3, §4, §6, §8 + v0.3 economy.
import { STARTER_DECK_IDS } from "./content/economy";
import { getMap } from "./maps";
import { parseTerrainGrid } from "./mapGrid";
import { GRID_COLS, GRID_ROWS, inBounds, key } from "./rules/grid";
import type {
  AvatarStateStatus,
  CardInstance,
  CharacterDefinition,
  CharacterState,
  GameState,
  Position,
  TerrainState,
} from "./types";

export const MAX_FOCUS = 4;
export const STARTING_FOCUS = 1;
export const ENERGY_PER_ROUND = 4;
export const MAX_ROUNDS = 8;

/** Deployment rows: first team rows 0–1, second team rows 5–6 (spec §4.2). */
export const DEPLOYMENT_ROWS: [number[], number[]] = [
  [0, 1],
  [5, 6],
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

/** Board at match start: parses the selected hand-editable grid from the map
 *  registry (src/game/maps; see mapGrid.ts for the tile-name mapping). The
 *  engine default stays empty so unit tests keep a clean board. */
export function createTestMapTerrain(mapId = "demo"): TerrainState[] {
  return parseTerrainGrid(getMap(mapId).grid);
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
    techniqueBlockedThisActivation: false,
    equippedGear: [],
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
export function createInitialState(teams: [TeamSetup, TeamSetup], seed = 1): GameState {
  // Instance-id counter resets per match so replays are fully deterministic.
  idCounter = 0;
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
    initiativePlayerId: "p1",
    characters,
    players: teams.map((t, ti) => ({
      id: t.playerId,
      energy: ENERGY_PER_ROUND,
      chi: 0,
      // Each side shuffles independently (seed offset per team) so opening
      // hands differ while staying fully deterministic per match seed.
      deck: buildStarterDeck(t.playerId, seed + ti * 7919),
      discard: [],
      teamHand: [],
      characterHands: {},
      intentions: {},
      assignments: {},
    })),
    terrain: [],
    log: ["Match created."],
    winnerId: null,
    isDraw: false,
    roundEventLog: [],
    rng: seed,
  };
}

/** Deterministic PRNG (mulberry32); advances state.rng. */
export function nextRandom(state: { rng: number }): number {
  let a = (state.rng + 0x6d2b79f5) | 0;
  state.rng = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Deterministic starter deck (STARTER_DECK_IDS order, seeded shuffle). */
export function buildStarterDeck(playerId: string, seed: number): CardInstance[] {
  const deck = STARTER_DECK_IDS.map((definitionId, i) => ({
    id: `${playerId}-deck-${i}`,
    definitionId,
  }));
  const rngState = { rng: seed };
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(rngState) * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
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
