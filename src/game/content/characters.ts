// Starter roster stubs. Spec §13 — full stats + passives land in step 6.
import type { CharacterDefinition } from "../types";

const base = {
  passiveDescription: "TODO(step 6)",
} as const;

export const CHARACTERS: CharacterDefinition[] = [
  {
    id: "aang",
    name: "Aang",
    element: "avatar",
    attributes: { aggression: 2, perception: 4, agility: 5, discipline: 3, resilience: 2 },
    ...base,
    passiveDescription: "Gains Focus after a successful evasion, once per round.",
    avatarState: {
      enabled: true,
      threshold: 6,
      maximum: 6,
      durationRounds: 2,
      activationFocusCost: 2,
      damageBonus: 1,
      shieldBonus: 1,
    },
  },
  {
    id: "katara",
    name: "Katara",
    element: "water",
    attributes: { aggression: 3, perception: 4, agility: 3, discipline: 4, resilience: 3 },
    ...base,
    passiveDescription: "TODO(step 6): water control / healing / binding.",
  },
  {
    id: "toph",
    name: "Toph",
    element: "earth",
    attributes: { aggression: 3, perception: 5, agility: 2, discipline: 3, resilience: 4 },
    ...base,
    passiveDescription: "TODO(step 6): terrain shaping / counters / disruption.",
  },
  {
    id: "zuko",
    name: "Zuko",
    element: "fire",
    attributes: { aggression: 5, perception: 3, agility: 3, discipline: 3, resilience: 3 },
    ...base,
    passiveDescription: "TODO(step 6): offensive chains / guard-breaking.",
  },
  {
    id: "sokka",
    name: "Sokka",
    element: "nonbender",
    attributes: { aggression: 3, perception: 4, agility: 3, discipline: 4, resilience: 2 },
    ...base,
    passiveDescription: "TODO(step 6): tactical support / feints / traps.",
  },
  {
    id: "azula",
    name: "Azula",
    element: "fire",
    attributes: { aggression: 5, perception: 4, agility: 3, discipline: 4, resilience: 2 },
    ...base,
    passiveDescription: "TODO(step 6): precise pressure / charged attacks.",
  },
];
