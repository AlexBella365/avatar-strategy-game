// Core game types. Mirrors spec §4–§9, §11–§12A.
// Keep this file free of logic: pure data shapes only.

export type Lane = "left" | "center" | "right";
export type Rank = "front" | "rear";

export interface Position {
  lane: Lane;
  rank: Rank;
}

export interface AttributeSet {
  aggression: number; // 1..5
  perception: number; // 1..5
  agility: number; // 1..5
  discipline: number; // 1..5
  resilience: number; // 1..5
}

export type StatusId = "OffBalance" | "Exposed" | "Bound" | "Exhausted";

export interface StatusInstance {
  id: string; // stable instance id
  statusId: StatusId;
  remainingRounds: number;
}

export interface AvatarStateDefinition {
  enabled: boolean;
  threshold: number; // MVP: 6
  maximum: number; // MVP: 6
  durationRounds: number; // MVP: 2
  activationFocusCost: number; // MVP: 2
  damageBonus: number; // MVP: +1
  shieldBonus: number; // MVP: +1
}

export interface AvatarStateStatus {
  resonance: number; // 0..maximum
  active: boolean;
  roundsRemaining: number;
  activatedThisMatch: boolean;
}

export interface CharacterDefinition {
  id: string;
  name: string;
  element: "air" | "water" | "earth" | "fire" | "nonbender" | "avatar";
  attributes: AttributeSet;
  maxHealthOverride?: number;
  passiveDescription: string;
  avatarState?: AvatarStateDefinition;
}

export interface CharacterState {
  id: string; // stable instance id, e.g. "p0-c0"
  definitionId: string;
  ownerId: string; // "p0" | "p1"
  health: number;
  maxHealth: number;
  focus: number; // 0..4
  position: Position;
  statuses: StatusInstance[];
  passiveUsesThisRound: Record<string, number>;
  reactionUsedThisRound: boolean;
  activatedThisRound: boolean;
  momentum: number; // 0..1 in MVP
  avatarState?: AvatarStateStatus;
}

export type Targeting =
  | { kind: "self" }
  | {
      kind: "singleEnemy";
      range: "melee" | "ranged" | "any";
      canTargetRear: boolean;
    }
  | { kind: "singleAlly"; range: "sameLane" | "adjacentLane" | "any" }
  | {
      kind: "lane";
      laneSelection: "current" | "chosen" | "adjacent" | "all";
    }
  | {
      kind: "area";
      shape: "cross" | "adjacentLanes" | "allEnemiesInLane" | "allEnemies";
    }
  | { kind: "selfAndAdjacentAllies" };

export type CardEffect =
  | { type: "damage"; amount: number; scalesWithAggression?: boolean }
  | { type: "heal"; amount: number }
  | {
      type: "shield";
      amount: number;
      duration?: "untilNextRound" | "untilConsumed";
    }
  | { type: "applyStatus"; statusId: string; duration: number }
  | { type: "removeStatus"; statusId: string }
  | {
      type: "move";
      steps: number;
      direction?: "chosen" | "awayFromSource" | "towardSource";
    }
  | { type: "push"; steps: number }
  | {
      type: "createTerrain";
      terrainId: string;
      duration: number;
      replacementPolicy: "replace" | "fail";
    }
  | { type: "gainFocus"; amount: number }
  | { type: "gainMomentum"; amount: number }
  | { type: "draw"; count: number; hand: "character" | "team" }
  | { type: "disrupt"; amount: number };

export type CardType = "attack" | "defense" | "setup" | "support" | "reaction";

export interface CardDefinition {
  id: string;
  name: string;
  cardType: CardType;
  element?: "air" | "water" | "earth" | "fire" | "nonbender";
  energyCost: number;
  focusCost: number;
  targeting: Targeting;
  tags: string[];
  effects: CardEffect[];
  reactionWindow?: "beforeDamage" | "afterTargeting" | "onMovement";
  canBeEvaded?: boolean;
  accuracyModifier?: number;
  cannotBeEvaded?: boolean;
  requiresAttributes?: Partial<AttributeSet>;
  /** Who lane/area effects can hit. Default: "enemies" for attacks, "allies" otherwise. */
  allegiance?: AllegianceFilter;
  /** Whether lane/area effects include rear-rank characters. Default true. */
  canHitRear?: boolean;
  /** Whether a ranged attack ignores Obstacle blocking. Default false. */
  ignoresObstacle?: boolean;
  rulesText: string;
}

export interface CardInstance {
  id: string; // stable instance id
  definitionId: string;
}

export type TerrainId = "cover" | "unstableGround" | "waterSource" | "obstacle";

export interface TerrainState {
  lane: Lane;
  terrainId: TerrainId;
  remainingRounds: number | null; // null = permanent
}

export type Intention = "Attack" | "Defend" | "Reposition" | "Prepare";

export interface PlayerState {
  id: string; // "p0" | "p1"
  energy: number;
  teamHand: CardInstance[];
  characterHands: Record<string, CardInstance[]>; // characterId -> hand
  intentions: Record<string, Intention>; // characterId -> hidden intention
}

export interface GameState {
  round: number; // 1..8
  maxRounds: number;
  initiativePlayerId: string;
  characters: CharacterState[];
  players: PlayerState[];
  terrain: TerrainState[];
  log: string[];
  winnerId: string | null;
  isDraw: boolean;
  roundEventLog: string[]; // tags like "displaced:<charId>" for synergy checks
}

export type GameAction =
  | { type: "SET_INTENTION"; playerId: string; characterId: string; intention: Intention }
  | { type: "MOVE"; playerId: string; characterId: string; to: Position }
  | {
      type: "PLAY_CARD";
      playerId: string;
      characterId: string;
      cardInstanceId: string;
      targetCharacterIds: string[];
      targetLane?: Lane;
    }
  | { type: "PASS_ACTIVATION"; playerId: string; characterId: string }
  | { type: "ACTIVATE_AVATAR_STATE"; playerId: string; characterId: string }
  | { type: "END_ROUND"; playerId: string };

export interface ActionError {
  code: string;
  message: string;
}

export type AllegianceFilter = "enemies" | "allies" | "all" | "selfAndAllies";

/** Player's target choice. UI builds these; the engine validates them. */
export type TargetSelection =
  | { kind: "character"; characterId: string }
  | { kind: "lane"; lane: Lane }
  | { kind: "automatic" }; // shapes with no choice (self, lane:"all", most areas)

/** One selectable option, including *illegal* candidates so the UI can explain why. */
export interface TargetOption {
  selection: TargetSelection;
  label: string;
  isLegal: boolean;
  illegalReason?: ActionError;
  /** Preview of affected characters (stable order); empty when illegal. */
  affectedCharacterIds: string[];
  primaryCharacterId?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ActionError[];
}

export interface ActionResult {
  state: GameState;
  errors: ActionError[];
  events: string[];
}
