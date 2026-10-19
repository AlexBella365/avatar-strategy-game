// Core game types. v2 grid model (§4, §9).
// Keep this file free of logic: pure data shapes only.
//
// Engine convention: rule functions MUTATE the GameState passed to them and
// return event strings for the battle log. The single public action entry
// point clones the state first (see cloneState); tests build fresh states.

/** Grid tile. x: 0..6 (west→east), y: 0..4 (top edge→bottom). */
export interface Position {
  x: number;
  y: number;
}

export type Direction = "north" | "east" | "south" | "west";

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
  /** Roster v2 metadata (role drives alignment restrictions). */
  series?: "ATLA" | "LOK";
  role?: "hero" | "villain" | "antihero" | "neutral";
  class?: "Water" | "Earth" | "Fire" | "Air" | "Non-bending";
  releaseWave?: string;
  /** Companions (Appa, Momo) are drafted separately, never as fighters. */
  companion?: boolean;
}

export interface CharacterState {
  id: string; // stable instance id, e.g. "p1-c0"
  definitionId: string;
  ownerId: string; // "p1" | "p2"
  health: number;
  maxHealth: number;
  focus: number; // 0..4
  position: Position;
  statuses: StatusInstance[];
  shields: ShieldInstance[]; // absorb damage FIFO; expiry handled by round loop
  passiveUsesThisRound: Record<string, number>;
  reactionUsedThisRound: boolean;
  activatedThisRound: boolean;
  movementSpent: number; // movement points spent this activation; reset by round loop
  techniqueBlockedThisActivation: boolean; // Avatar State activation consumes the technique play
  equippedGear: CardInstance[]; // persistent gear (max 2); bonuses apply while equipped
  momentum: number; // 0..1 in MVP
  avatarState?: AvatarStateStatus;
}

/** One shield pool on a character. */
export interface ShieldInstance {
  id: string; // stable instance id
  amount: number;
  duration?: "untilNextRound" | "untilConsumed";
}

export type AllegianceFilter = "enemies" | "allies" | "all" | "selfAndAllies";

export type AreaShapeName =
  | "singleTile"
  | "plus"
  | "line"
  | "rectangle"
  | "radiusManhattan"
  | "sourceAndAdjacent"
  | "allEnemies";

export type Targeting =
  | { kind: "self" }
  | {
      kind: "character";
      allegiance: AllegianceFilter;
      range: number | "melee" | "any";
      requiresLineOfSight?: boolean; // default true
    }
  | { kind: "tile"; range: number | "any"; allowsOccupiedTile: boolean }
  | { kind: "direction"; maxLength: number; directions: Direction[]; includeBlocker?: boolean }
  | {
      kind: "area";
      shape: AreaShapeName;
      allegiance: AllegianceFilter;
      maxRange?: number;
      radius?: number;
      width?: number;
      height?: number;
      maxLength?: number;
      requiresLineOfSight?: boolean; // default true
      includeBlocker?: boolean; // line shapes: include first blocking tile (default false)
    };

export interface MovementEffect {
  timing: "beforeTechnique" | "afterTechnique" | "insteadOfTechnique";
  maxSteps: number;
  path: "orthogonal" | "straightOrthogonal" | "teleport";
  ignoresDifficultTerrain?: boolean;
  destinationRule: "mustBeLegal" | "stopBeforeIllegal" | "fizzle";
}

export interface TerrainEffect {
  terrainId: string;
  target: "targetTile" | "pathTiles" | "areaTiles";
  durationRounds: number | "permanent";
  replacementPolicy: "replace" | "fail" | "preserveExisting";
}

export type CardEffect =
  | {
      type: "damage";
      amount: number;
      scalesWithAggression?: boolean;
      /** Generic synergy conditions (tag/state-based, never card-name checks). */
      bonusVsStatus?: { statusId: string; amount: number };
      bonusIfTargetDisplaced?: number;
      waterEmpoweredBonus?: number;
    }
  | { type: "heal"; amount: number }
  | {
      type: "shield";
      amount: number;
      waterEmpoweredBonus?: number;
      duration?: "untilNextRound" | "untilConsumed";
    }
  | { type: "applyStatus"; statusId: string; duration: number; requiresTargetStatus?: StatusId }
  | { type: "removeStatus"; statusId: string }
  | {
      type: "move";
      steps: number;
      direction?: Direction | "chosen" | "awayFromSource" | "towardSource";
    }
  | { type: "push"; steps: number; direction?: Direction | "awayFromSource" }
  | { type: "pull"; steps: number; direction?: Direction | "towardSource" }
  | { type: "swap"; target: "ally" | "enemy" }
  | {
      type: "createTerrain";
      terrainId: string;
      duration: number | "permanent";
      replacementPolicy: "replace" | "fail" | "preserveExisting";
    }
  | { type: "gainFocus"; amount: number }
  | { type: "gainMomentum"; amount: number }
  | { type: "draw"; count: number; hand: "character" | "team" }
  | { type: "disrupt"; amount: number };

export type CardType = "attack" | "defense" | "setup" | "support" | "reaction";

/** v0.3 card economy: kind/slot/chi/restrictions (amendment §Card data delta). */
export type CardKind = "gear" | "attack" | "defense";

export type Restriction =
  | { type: "unique"; characterId: string } // definition id, e.g. glider→aang
  | { type: "element"; elements: string[] } // any-of match
  | { type: "alignment"; alignment: "hero" | "villain" };

export interface GearBonus {
  movement?: number;
  damage?: number;
}

export interface CardDefinition {
  id: string;
  name: string;
  cardType: CardType;
  element?: "air" | "water" | "earth" | "fire" | "nonbender";
  energyCost: number;
  focusCost: number;
  targeting: Targeting;
  movement?: MovementEffect;
  terrainEffects?: TerrainEffect[];
  tags: string[];
  effects: CardEffect[];
  reactionWindow?: "beforeDamage" | "afterTargeting" | "onMovement";
  canBeEvaded?: boolean;
  accuracyModifier?: number;
  cannotBeEvaded?: boolean;
  tracking?: boolean;
  requiresReaction?: boolean;
  requiresAttributes?: Partial<AttributeSet>;
  rulesText: string;
  /** v0.3 economy. Absent = legacy test fixture (no kind/slot/chi/restrictions). */
  economy?: {
    kind: CardKind;
    value: number; // chi gained when banked/scrapped
    chiCost: number; // chi spent from team bank to Play
    restrictions: Restriction[];
    slotType: "gear" | "attack" | "defense";
  };
  /** Persistent bonus while equipped (gear only). */
  gearBonus?: GearBonus;
  /** Center art emoji for the playing-card face (unique per card). */
  art?: string;
}

export interface CardInstance {
  id: string; // stable instance id
  definitionId: string;
}

/** Tile-level terrain. Property semantics (blocking/difficult/cover/...) come
 * from data-driven terrain definitions (step 3); geometry takes explicit sets. */
export interface TerrainState {
  id: string; // stable instance id
  x: number;
  y: number;
  terrainId: string;
  remainingRounds: number | null; // null = permanent
}

/** Data-driven terrain definition (spec §5.1–§5.2). */
export interface TerrainDefinition {
  id: string;
  name: string;
  /** Cannot be entered AND blocks line of sight (walls). */
  blocking: boolean;
  /** Cannot be entered but does NOT block line of sight (water). A distinct
   *  flag from `blocking` so an impassable pond gates movement only. */
  impassableToMove?: boolean;
  difficult: boolean; // costs 2 movement points to enter
  cover?: { reduction: number; vs: ("melee" | "ranged" | "aoe")[] };
  elementalSource?: "water" | "earth" | "fire" | "air";
  hazard?: {
    amount: number;
    timing: "onEntry" | "endOfRound" | "endOfActivation";
    label: string;
  };
  onEntryStatus?: { statusId: StatusId; duration: number };
}

export interface PlayerState {
  id: string; // "p1" | "p2"
  energy: number;
  /** v0.3 chi bank: spendable team currency, persists across rounds. */
  chi: number;
  deck: CardInstance[];
  discard: CardInstance[];
  teamHand: CardInstance[];
  /** Direct per-character deals (used by tests); the UI plays from teamHand. */
  characterHands: Record<string, CardInstance[]>;
  /** Face-down assignments: characterId -> assigned instance (revealed on activation). */
  assignments: Record<string, CardInstance | null>;
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
  /** Deterministic PRNG state (mulberry32) for shuffles/draws. */
  rng: number;
}

export type GameAction =
  | { type: "MOVE"; playerId: string; characterId: string; to: Position; path?: Position[] }
  | {
      type: "PLAY_CARD";
      playerId: string;
      characterId: string;
      cardInstanceId: string;
      selection: TargetSelection;
      /** Card data; the engine checks the instance is in hand and IDs match. */
      card: CardDefinition;
      /** Explicit movement path for cards with movement effects. */
      movePath?: Position[];
      /** Declared Evade reactions (defender characterId -> destination). */
      reactions?: { characterId: string; dest: Position }[];
      /** Gear replacement target when at the gear cap. */
      replaceGearInstanceId?: string;
    }
  | { type: "ASSIGN_CARD"; playerId: string; characterId: string; cardInstanceId: string }
  | { type: "SCRAP_ASSIGNED"; playerId: string; characterId: string }
  | { type: "PASS_ACTIVATION"; playerId: string; characterId: string }
  | { type: "ACTIVATE_AVATAR_STATE"; playerId: string; characterId: string }
  | { type: "END_ROUND"; playerId: string };

export interface ActionError {
  code: string;
  message: string;
}

/** Player's target choice. UI builds these; the engine validates them. */
export type TargetSelection =
  | { kind: "character"; characterId: string }
  | { kind: "tile"; pos: Position }
  | { kind: "direction"; direction: Direction }
  | { kind: "automatic" }; // shapes with no choice (self, sourceAndAdjacent, allEnemies)

/** One selectable option, including *illegal* candidates so the UI can explain why. */
export interface TargetOption {
  selection: TargetSelection;
  label: string;
  isLegal: boolean;
  illegalReason?: ActionError;
  /** Preview of affected tiles (stable y,x order); empty when illegal. */
  affectedTiles: Position[];
  /** Preview of affected characters (stable y,x order); empty when illegal. */
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
