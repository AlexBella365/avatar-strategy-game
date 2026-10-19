import { describe, expect, it } from "vitest";
import { attackFxKind } from "./attackFx";
import { CARD_DEFINITIONS } from "../game/content/cards";

describe("attack FX mapping", () => {
  it("maps each bending attack to its element", () => {
    expect(attackFxKind(CARD_DEFINITIONS["rising-flame"])).toBe("fire");
    expect(attackFxKind(CARD_DEFINITIONS["fire-sweep"])).toBe("fire");
    expect(attackFxKind(CARD_DEFINITIONS["comet-strike"])).toBe("fire");
    expect(attackFxKind(CARD_DEFINITIONS["water-whip"])).toBe("water");
    expect(attackFxKind(CARD_DEFINITIONS["ice-bind"])).toBe("water");
    expect(attackFxKind(CARD_DEFINITIONS["air-blast"])).toBe("air");
    expect(attackFxKind(CARD_DEFINITIONS["earth-sweep"])).toBe("earth");
  });

  it("uses a slash for non-bender strikes", () => {
    expect(attackFxKind(CARD_DEFINITIONS["precision-strike"])).toBe("slash");
    expect(attackFxKind(CARD_DEFINITIONS["sokkas-feint"])).toBe("slash");
    expect(attackFxKind(CARD_DEFINITIONS["dust-toss"])).toBe("slash");
  });

  it("returns null for non-offensive plays", () => {
    expect(attackFxKind(CARD_DEFINITIONS["water-recovery"])).toBeNull();
    expect(attackFxKind(CARD_DEFINITIONS["air-shield"])).toBeNull();
    expect(attackFxKind(CARD_DEFINITIONS["earth-wall"])).toBeNull();
    expect(attackFxKind(CARD_DEFINITIONS["seismic-read"])).toBeNull();
    expect(attackFxKind(CARD_DEFINITIONS["travel-rations"])).toBeNull();
    expect(attackFxKind(CARD_DEFINITIONS["smoke-bomb"])).toBeNull();
    expect(attackFxKind(CARD_DEFINITIONS["aang-glider"])).toBeNull();
    expect(attackFxKind(CARD_DEFINITIONS["sokka-boomerang"])).toBeNull();
  });
});
