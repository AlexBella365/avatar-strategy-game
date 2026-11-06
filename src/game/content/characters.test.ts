// Roster guardrails: the demo drafts every non-companion character straight
// into the 3v3 picker, so the roster needs to stay inside the design target
// and keep its metadata complete (specs/avatar_character_roster_v2.md).
import { describe, expect, it } from "vitest";
import { CHARACTERS } from "./characters";

const FIGHTERS = CHARACTERS.filter((c) => !c.companion);
const CLASSES = ["Water", "Earth", "Fire", "Air", "Non-bending"];

describe("character roster", () => {
  it("has 15–20 playable fighters", () => {
    expect(FIGHTERS.length).toBeGreaterThanOrEqual(15);
    expect(FIGHTERS.length).toBeLessThanOrEqual(20);
  });

  it("keeps ids and names unique", () => {
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(CHARACTERS.length);
    expect(new Set(CHARACTERS.map((c) => c.name)).size).toBe(CHARACTERS.length);
  });

  it("covers every gameplay class, including non-benders", () => {
    const classes = new Set(FIGHTERS.map((c) => c.class));
    for (const cls of CLASSES) expect(classes).toContain(cls);
    expect(FIGHTERS.filter((c) => c.element === "nonbender").length).toBeGreaterThanOrEqual(4);
  });

  it("gives every fighter complete roster metadata and valid attributes", () => {
    for (const c of FIGHTERS) {
      expect(["ATLA", "LOK"]).toContain(c.series);
      expect(["hero", "villain", "antihero", "neutral"]).toContain(c.role);
      expect(CLASSES).toContain(c.class);
      expect(c.releaseWave?.length).toBeGreaterThan(0);
      expect(c.passiveDescription.length).toBeGreaterThan(0);
      for (const value of Object.values(c.attributes)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(5);
      }
    }
  });

  it("includes the LOK main cast", () => {
    const ids = new Set(FIGHTERS.map((c) => c.id));
    for (const id of ["korra", "mako", "bolin", "asami"]) expect(ids).toContain(id);
  });

  it("keeps Avatar State exclusive to Aang", () => {
    const avatars = CHARACTERS.filter((c) => c.avatarState?.enabled);
    expect(avatars.map((c) => c.id)).toEqual(["aang"]);
  });
});
