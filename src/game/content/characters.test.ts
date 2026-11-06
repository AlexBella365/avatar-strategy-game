import { describe, expect, it } from "vitest";
import { CHARACTERS } from "./characters";

describe("character stats", () => {
  it("defines valid 1–5 attributes for all portrait characters", () => {
    const portraitCharacterIds = [
      "korra",
      "mako",
      "bolin",
      "asami",
      "lin",
      "amon",
      "kuvira",
      "tenzin",
      "zaheer",
    ];
    const attributes = [
      "aggression",
      "perception",
      "agility",
      "discipline",
      "resilience",
    ] as const;

    for (const id of portraitCharacterIds) {
      const character = CHARACTERS.find((entry) => entry.id === id);
      expect(character, `${id} is in the game roster`).toBeDefined();
      for (const attribute of attributes) {
        const score = character?.attributes[attribute];
        expect(score, `${id}.${attribute} is on the 1–5 scale`).toBeGreaterThanOrEqual(1);
        expect(score, `${id}.${attribute} is on the 1–5 scale`).toBeLessThanOrEqual(5);
      }
    }
  });
});
