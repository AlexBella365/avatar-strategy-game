// Shipped balance data: the defaults in content/balance.ts are read by the
// engine through `tuningOf`, so this test guards the wiring end to end.
import { describe, expect, it } from "vitest";
import { CHARACTERS } from "./characters";
import { DEFAULT_MATCH_TUNING, tuningOf } from "./balance";
import { createInitialState, maxHealthFor } from "../state";
import { dealDamage } from "../rules/damage";
import { movementAllowance } from "../rules/movement";
import type { TeamSetup } from "../state";

const AANG = CHARACTERS[0];
const ZUKO = CHARACTERS[3];

function shippedMatch() {
  const teams: [TeamSetup, TeamSetup] = [
    {
      playerId: "p1",
      characterDefs: [AANG, CHARACTERS[1], CHARACTERS[2]],
      positions: [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 5, y: 1 },
      ],
    },
    {
      playerId: "p2",
      characterDefs: [ZUKO, CHARACTERS[4], CHARACTERS[5]],
      positions: [
        { x: 1, y: 5 },
        { x: 3, y: 5 },
        { x: 5, y: 5 },
      ],
    },
  ];
  return createInitialState(teams, 1, { northPlayerId: "p1" });
}

describe("shipped match tuning", () => {
  it("resolves defaults and merges per-match overrides", () => {
    expect(tuningOf({})).toEqual(DEFAULT_MATCH_TUNING);
    expect(tuningOf({ tuning: { movement: 3 } })).toEqual({
      ...DEFAULT_MATCH_TUNING,
      movement: 3,
    });
  });

  it("deploys one row in from each edge", () => {
    const state = shippedMatch();
    expect(state.tuning).toEqual(DEFAULT_MATCH_TUNING);
    expect(state.characters.find((c) => c.id === "p1-c0")!.position.y).toBe(1);
    expect(state.characters.find((c) => c.id === "p2-c0")!.position.y).toBe(5);
    expect(state.log.join("\n")).toContain("row 1");
    expect(state.log.join("\n")).toContain("row 5");
  });

  it("scales starting HP and movement for the lethality pass", () => {
    const state = shippedMatch();
    const base = maxHealthFor(AANG.attributes.resilience, AANG.maxHealthOverride);
    const aang = state.characters.find((c) => c.id === "p1-c0")!;
    expect(aang.maxHealth).toBe(Math.round(base * DEFAULT_MATCH_TUNING.hpScale));
    expect(aang.health).toBe(aang.maxHealth);
    expect(movementAllowance(state, "p1-c0")).toBe(DEFAULT_MATCH_TUNING.movement);
  });

  it("applies the damage multiplier to every damage source", () => {
    const state = shippedMatch();
    const before = state.characters.find((c) => c.id === "p2-c0")!.health;
    const outcome = dealDamage(state, "p2-c0", 4, "test");
    expect(outcome.hpLost).toBe(4 * DEFAULT_MATCH_TUNING.damageScale);
    expect(state.characters.find((c) => c.id === "p2-c0")!.health).toBe(
      before - outcome.hpLost,
    );
  });

  it("lets a match opt back into neutral rules (used by engine tests)", () => {
    const teams: [TeamSetup, TeamSetup] = [
      {
        playerId: "p1",
        characterDefs: [AANG],
        positions: [{ x: 1, y: 0 }],
      },
      {
        playerId: "p2",
        characterDefs: [ZUKO],
        positions: [{ x: 1, y: 6 }],
      },
    ];
    const state = createInitialState(teams, 1, {
      northPlayerId: "p1",
      tuning: { hpScale: 1, movement: 1, deploymentInset: 0 },
    });
    const aang = state.characters.find((c) => c.id === "p1-c0")!;
    expect(aang.maxHealth).toBe(maxHealthFor(AANG.attributes.resilience, AANG.maxHealthOverride));
    expect(movementAllowance(state, "p1-c0")).toBe(1);
  });
});
