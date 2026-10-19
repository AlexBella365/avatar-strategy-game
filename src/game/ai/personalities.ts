// Track A personalities: named weight vectors + the character -> archetype
// mapping. Behavior differences are data (weights), never code branches
// (specs/npc_ai_plan.md §2.A.4).
import type { CharacterDefinition } from "../types";
import type { PersonalityId, Weights } from "./types";

/** Neutral baseline. Personality deltas are merged on top of this. */
export const BASE_WEIGHTS: Weights = {
  damage: 1.15,
  kill: 1.3,
  positioning: 0.8,
  safety: 0.8,
  cover: 0.6,
  survival: 0.9,
  focusFire: 1.0,
  economy: 0.7,
  support: 0.4,
  elemental: 0.4,
};

/** Archetype deltas, tuned via the scripted scenarios in policy.test.ts. */
export const PERSONALITIES: Record<PersonalityId, Partial<Weights>> = {
  default: {},
  aggressive: {
    damage: 1.4,
    focusFire: 1.2,
    positioning: 0.9,
    safety: 0.4,
    cover: 0.3,
    survival: 0.5,
  },
  cautious: { damage: 0.7, focusFire: 0.9, positioning: 0.6, safety: 1.3, cover: 1.0, survival: 1.3, economy: 0.9 },
  sniper: { damage: 1.1, focusFire: 1.2, positioning: 0.6, safety: 1.0, cover: 1.1, survival: 0.9 },
  berserker: {
    damage: 1.7,
    kill: 1.6,
    focusFire: 1.0,
    positioning: 1.0,
    safety: 0.1,
    cover: 0.0,
    survival: 0.15,
    support: 0.2,
  },
  support: { damage: 0.6, focusFire: 0.8, support: 1.4, safety: 1.0, cover: 0.8, positioning: 0.6 },
};

/** Explicit archetypes for the MVP roster; element is the fallback. */
export const PERSONALITY_BY_CHARACTER: Record<string, PersonalityId> = {
  aang: "cautious",
  katara: "support",
  toph: "aggressive",
  zuko: "aggressive",
  sokka: "support",
  azula: "aggressive",
};

const PERSONALITY_BY_ELEMENT: Record<string, PersonalityId> = {
  fire: "aggressive",
  water: "support",
  earth: "cautious",
  air: "cautious",
  nonbender: "support",
  avatar: "cautious",
};

/** Archetype for a character definition: explicit id, else element, else default. */
export function personalityFor(def: CharacterDefinition | undefined): PersonalityId {
  if (!def) return "default";
  return (
    PERSONALITY_BY_CHARACTER[def.id] ??
    PERSONALITY_BY_ELEMENT[def.element] ??
    "default"
  );
}

function merge(base: Weights, delta: Partial<Weights>): Weights {
  return { ...base, ...delta };
}

/**
 * Resolve the effective weights: baseline -> archetype delta -> explicit
 * override. `override` may name an archetype or carry raw weight overrides.
 */
export function resolveWeights(
  def: CharacterDefinition | undefined,
  override?: PersonalityId | Partial<Weights>,
): Weights {
  const archetype = typeof override === "string" ? override : personalityFor(def);
  const fromArchetype = merge(BASE_WEIGHTS, PERSONALITIES[archetype]);
  if (override && typeof override === "object") return merge(fromArchetype, override);
  return fromArchetype;
}
