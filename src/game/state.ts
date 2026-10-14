// Match state: init + immutable helpers. Spec §3, §6, §8.
import type {
  AvatarStateStatus,
  CharacterDefinition,
  CharacterState,
  GameState,
  Lane,
  Rank,
} from "./types";

export const MAX_FOCUS = 4;
export const STARTING_FOCUS = 1;
export const ENERGY_PER_ROUND = 4;
export const MAX_ROUNDS = 8;

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
  positions: { lane: Lane; rank: Rank }[];
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
  lane: Lane,
  rank: Rank,
): CharacterState {
  return {
    id: instanceId,
    definitionId: def.id,
    ownerId,
    health: maxHealthFor(def.attributes.resilience, def.maxHealthOverride),
    maxHealth: maxHealthFor(def.attributes.resilience, def.maxHealthOverride),
    focus: STARTING_FOCUS,
    position: { lane, rank },
    statuses: [],
    passiveUsesThisRound: {},
    reactionUsedThisRound: false,
    activatedThisRound: false,
    momentum: 0,
    avatarState: initialAvatarStatus(def),
  };
}

/** Create a fresh match with empty hands (hands dealt in round setup later). */
export function createInitialState(teams: [TeamSetup, TeamSetup]): GameState {
  const characters: CharacterState[] = [];
  for (const team of teams) {
    team.characterDefs.forEach((def, i) => {
      const pos = team.positions[i] ?? { lane: "center" as Lane, rank: "front" as Rank };
      characters.push(
        createCharacter(def, team.playerId, `${team.playerId}-c${i}`, pos.lane, pos.rank),
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
