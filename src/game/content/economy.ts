// Card + character economy tuning (spec v0.3 amendment).
//
// SINGLE SOURCE OF TRUTH for balance numbers: draw count, slot caps, and
// per-card chi value / chi cost / energy / restrictions. Tune here, not in
// engine code. The engine (types/rules) adopts these shapes when card data
// lands; until then this file is the draft the rules doc and spec cite.

/** Match-level tunables. */
export const ECONOMY_TUNING = {
  /** Cards drawn per player per round; 3 assigned, rest auto-bank. */
  drawPerRound: 5,
  /** Total slots per character (intentional: caps below sum above this). */
  slotsPerCharacter: 4,
  maxGearSlots: 2,
  maxAttackSlots: 2,
  maxDefenseSlots: 2,
  teamEnergyPerRound: 4,
  /** Chi bank starts here, persists across rounds, uncapped in prototype. */
  startingChi: 0,
  minCardChiValue: 1,
  maxCardChiValue: 3,
} as const;

export type SlotType = "gear" | "attack" | "defense";

/** Assignment/play gate. ALL entries must hold; banking is always legal. */
export type Restriction =
  | { type: "unique"; characterId: string }
  | { type: "element"; anyOf: readonly ("water" | "earth" | "fire" | "air" | "nonbender" | "avatar")[] }
  | { type: "alignment"; alignment: "hero" | "villain" };

export interface CardEconomy {
  /** Slot family: gear stays equipped; attack/defense resolve then discard. */
  slot: SlotType;
  /** Chi gained when banked/scrapped (1..3). */
  chiValue: number;
  /** Chi spent from the team bank to Play (in addition to Energy). */
  chiCost: number;
  /** Energy spent from the team pool to Play (initial tuning). */
  energy: number;
  restrictions: Restriction[];
  note: string;
}

const EARTH = { type: "element", anyOf: ["earth", "avatar"] } as const;
const WATER = { type: "element", anyOf: ["water", "avatar"] } as const;
const FIRE = { type: "element", anyOf: ["fire", "avatar"] } as const;
const AIR = { type: "element", anyOf: ["air", "avatar"] } as const;

/** Draft economy for the 12 starter cards (§13) + 2 signature gear. */
export const CARD_ECONOMY: Record<string, CardEconomy> = {
  // --- Attacks ---
  "earth-sweep": {
    slot: "attack", chiValue: 1, chiCost: 0, energy: 1,
    restrictions: [EARTH],
    note: "Workhorse: 2 dmg + OffBalance. Cheap to play, poor to bank.",
  },
  "air-blast": {
    slot: "attack", chiValue: 1, chiCost: 0, energy: 1,
    restrictions: [AIR],
    note: "Workhorse: 2 dmg, bonus vs OffBalance.",
  },
  "rising-flame": {
    slot: "attack", chiValue: 2, chiCost: 1, energy: 2,
    restrictions: [FIRE],
    note: "Mid bomb: 3 dmg +1 vs displaced. Banking it funds a bigger bomb.",
  },
  "water-whip": {
    slot: "attack", chiValue: 1, chiCost: 0, energy: 1,
    restrictions: [WATER],
    note: "Workhorse: 2 dmg + pull/displace setup.",
  },
  "fire-sweep": {
    slot: "attack", chiValue: 2, chiCost: 2, energy: 2,
    restrictions: [FIRE],
    note: "AoE bomb: needs 2+ rounds of banking if played early.",
  },
  "ice-bind": {
    slot: "attack", chiValue: 2, chiCost: 1, energy: 2,
    restrictions: [WATER],
    note: "Control: Bound if OffBalance. Mid cost, good bank.",
  },
  "sokkas-feint": {
    slot: "attack", chiValue: 1, chiCost: 0, energy: 1,
    restrictions: [{ type: "unique", characterId: "sokka" }],
    note: "Setup: Exposed / bait a reaction. Signature but cheap.",
  },
  "precision-strike": {
    slot: "attack", chiValue: 2, chiCost: 1, energy: 2,
    restrictions: [],
    note: "Universal (Perception-gated). Fits anyone, banks well.",
  },
  // --- Defenses / support ---
  "air-shield": {
    slot: "defense", chiValue: 2, chiCost: 0, energy: 1,
    restrictions: [AIR],
    note: "Area defense for source + adjacent allies. Banks well.",
  },
  "earth-wall": {
    slot: "defense", chiValue: 2, chiCost: 1, energy: 2,
    restrictions: [EARTH],
    note: "Blocking terrain. Setup cost matches its board impact.",
  },
  "water-recovery": {
    slot: "defense", chiValue: 1, chiCost: 0, energy: 1,
    restrictions: [WATER],
    note: "Heal (+cleanse if defined). Cheap staple.",
  },
  "seismic-read": {
    slot: "defense", chiValue: 1, chiCost: 0, energy: 1,
    restrictions: [{ type: "unique", characterId: "toph" }],
    note: "Intel + Focus. Effect TBD in card-data step (no intentions in v0.3).",
  },
  // --- Signature gear (equip, stays until replaced) ---
  "aangs-glider": {
    slot: "gear", chiValue: 2, chiCost: 0, energy: 1,
    restrictions: [{ type: "unique", characterId: "aang" }],
    note: "+1 movement while equipped. Scrapping it hurts: real tension.",
  },
  "sokkas-boomerang": {
    slot: "gear", chiValue: 2, chiCost: 0, energy: 1,
    restrictions: [{ type: "unique", characterId: "sokka" }],
    note: "Effect TBD in card-data step. High bank value by design.",
  },
};
