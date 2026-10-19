import { describe, expect, it } from "vitest";
import { cloneState } from "../game/state";
import { healthDeltas } from "./combatText";
import { setup } from "../game/testutils";

describe("health deltas (floating combat numbers)", () => {
  it("reports damage as a positive amount on the receiving character", () => {
    const before = setup();
    const after = cloneState(before);
    after.characters[3].health -= 3; // p2 first fighter
    const deltas = healthDeltas(before, after);
    expect(deltas).toEqual([{ charId: after.characters[3].id, amount: 3, kind: "damage" }]);
  });

  it("reports healing as a positive amount", () => {
    const before = setup();
    before.characters[0].health -= 4;
    const after = cloneState(before);
    after.characters[0].health += 2;
    const deltas = healthDeltas(before, after);
    expect(deltas).toEqual([{ charId: after.characters[0].id, amount: 2, kind: "heal" }]);
  });

  it("ignores unchanged characters", () => {
    const before = setup();
    expect(healthDeltas(before, cloneState(before))).toEqual([]);
  });
});
