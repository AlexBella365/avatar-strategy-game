// Step 2a tests: targeting engine (spec §4.3, §4.4, §10; test list §17).
import { describe, expect, it } from "vitest";
import { createInitialState } from "../state";
import type {
  CardDefinition,
  GameState,
  Lane,
  Targeting,
} from "../types";
import { CHARACTERS } from "../content/characters";
import {
  getAffectedCharacters,
  getLegalTargets,
  validateTarget,
} from "./targeting";

function mkCard(
  targeting: Targeting,
  overrides: Partial<CardDefinition> = {},
): CardDefinition {
  return {
    id: "test-card",
    name: "Test Card",
    cardType: "attack",
    energyCost: 1,
    focusCost: 0,
    targeting,
    tags: [],
    effects: [],
    rulesText: "",
    ...overrides,
  };
}

/**
 * p0: aang center/front, katara left/rear, zuko right/front
 * p1: toph center/front, sokka center/rear, azula right/front
 */
function mkState(): GameState {
  return createInitialState([
    {
      playerId: "p0",
      characterDefs: [CHARACTERS[0], CHARACTERS[1], CHARACTERS[3]],
      positions: [
        { lane: "center", rank: "front" },
        { lane: "left", rank: "rear" },
        { lane: "right", rank: "front" },
      ],
    },
    {
      playerId: "p1",
      characterDefs: [CHARACTERS[2], CHARACTERS[4], CHARACTERS[5]],
      positions: [
        { lane: "center", rank: "front" },
        { lane: "center", rank: "rear" },
        { lane: "right", rank: "front" },
      ],
    },
  ]);
}

const AANG = "p0-c0";
const TOPH = "p1-c0";
const SOKKA = "p1-c1";
const AZULA = "p1-c2";

function knockOut(state: GameState, id: string): void {
  state.characters.find((c) => c.id === id)!.health = 0;
}

describe("focused single-target", () => {
  it("affects exactly one target", () => {
    const card = mkCard({ kind: "singleEnemy", range: "melee", canTargetRear: false });
    expect(getAffectedCharacters(mkState(), AANG, card, { kind: "character", characterId: TOPH })).toEqual([
      TOPH,
    ]);
  });

  it("melee cannot target a protected rear character", () => {
    const state = mkState();
    const card = mkCard({ kind: "singleEnemy", range: "melee", canTargetRear: true });
    const options = getLegalTargets(state, AANG, card);
    const rear = options.find((o) => o.primaryCharacterId === SOKKA)!;
    expect(rear.isLegal).toBe(false);
    expect(rear.illegalReason?.code).toBe("FRONT_PROTECTED");
    expect(validateTarget(state, AANG, card, { kind: "character", characterId: SOKKA }).ok).toBe(
      false,
    );
  });

  it("rear becomes targetable once the front character is knocked out", () => {
    const state = mkState();
    knockOut(state, TOPH);
    const card = mkCard({ kind: "singleEnemy", range: "melee", canTargetRear: true });
    const rear = getLegalTargets(state, AANG, card).find((o) => o.primaryCharacterId === SOKKA)!;
    expect(rear.isLegal).toBe(true);
    expect(rear.affectedCharacterIds).toEqual([SOKKA]);
  });

  it("melee cannot reach other lanes", () => {
    const state = mkState();
    const card = mkCard({ kind: "singleEnemy", range: "melee", canTargetRear: true });
    const azula = getLegalTargets(state, AANG, card).find((o) => o.primaryCharacterId === AZULA)!;
    expect(azula.isLegal).toBe(false);
    expect(azula.illegalReason?.code).toBe("OUT_OF_RANGE");
  });

  it("ranged attack can target rear when allowed", () => {
    const state = mkState();
    const card = mkCard({ kind: "singleEnemy", range: "ranged", canTargetRear: true });
    const rear = getLegalTargets(state, AANG, card).find((o) => o.primaryCharacterId === SOKKA)!;
    expect(rear.isLegal).toBe(true);
  });

  it("ranged attack with canTargetRear:false rejects rear", () => {
    const state = mkState();
    const card = mkCard({ kind: "singleEnemy", range: "ranged", canTargetRear: false });
    const rear = getLegalTargets(state, AANG, card).find((o) => o.primaryCharacterId === SOKKA)!;
    expect(rear.isLegal).toBe(false);
    expect(rear.illegalReason?.code).toBe("REAR_UNREACHABLE");
  });

  it("knocked-out characters are excluded and untargetable", () => {
    const state = mkState();
    knockOut(state, TOPH);
    const card = mkCard({ kind: "singleEnemy", range: "melee", canTargetRear: true });
    const options = getLegalTargets(state, AANG, card);
    expect(options.some((o) => o.primaryCharacterId === TOPH)).toBe(false);
    const result = validateTarget(state, AANG, card, { kind: "character", characterId: TOPH });
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("TARGET_KNOCKED_OUT");
  });
});

describe("ally targeting", () => {
  const allyInLeftRear = "p0-c1"; // katara

  it("sameLane restricts to the source lane", () => {
    const state = mkState();
    const card = mkCard(
      { kind: "singleAlly", range: "sameLane" },
      { cardType: "support" },
    );
    const katara = getLegalTargets(state, AANG, card).find(
      (o) => o.primaryCharacterId === allyInLeftRear,
    )!;
    expect(katara.isLegal).toBe(false);
    expect(katara.illegalReason?.code).toBe("OUT_OF_RANGE");
  });

  it("adjacentLane reaches neighboring lanes", () => {
    const state = mkState();
    const card = mkCard(
      { kind: "singleAlly", range: "adjacentLane" },
      { cardType: "support" },
    );
    const katara = getLegalTargets(state, AANG, card).find(
      (o) => o.primaryCharacterId === allyInLeftRear,
    )!;
    expect(katara.isLegal).toBe(true);
  });

  it("rejects enemies with WRONG_ALLEGIANCE", () => {
    const state = mkState();
    const card = mkCard({ kind: "singleAlly", range: "any" }, { cardType: "support" });
    const result = validateTarget(state, AANG, card, { kind: "character", characterId: TOPH });
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("WRONG_ALLEGIANCE");
  });
});

describe("AoE shapes", () => {
  it("allEnemiesInLane hits only enemies in the chosen lane", () => {
    const state = mkState();
    const card = mkCard({ kind: "area", shape: "allEnemiesInLane" });
    const affected = getAffectedCharacters(state, AANG, card, { kind: "lane", lane: "center" });
    expect(affected).toEqual([TOPH, SOKKA]); // stable order: front before rear
    expect(getAffectedCharacters(state, AANG, card, { kind: "lane", lane: "left" })).toEqual([]);
  });

  it("adjacentLanes covers the source lane and neighbors", () => {
    const state = mkState();
    const card = mkCard({ kind: "area", shape: "adjacentLanes" });
    // aang is center: all lanes; enemies are toph+sokka (center) + azula (right)
    expect(getAffectedCharacters(state, AANG, card, { kind: "automatic" })).toEqual([
      TOPH,
      SOKKA,
      AZULA,
    ]);
  });

  it("cross = whole source lane + same-rank characters in adjacent lanes", () => {
    const state = mkState();
    const card = mkCard({ kind: "area", shape: "cross" });
    // aang center/front: center lane (toph front, sokka rear) + front-rank
    // characters in left/right (azula right/front; no enemy left)
    expect(getAffectedCharacters(state, AANG, card, { kind: "automatic" })).toEqual([
      TOPH,
      SOKKA,
      AZULA,
    ]);
    // ...but a rear-rank enemy in an adjacent lane is NOT in the cross:
    // move sokka to left/rear and re-check from a center/front source
    state.characters.find((c) => c.id === SOKKA)!.position = { lane: "left", rank: "rear" };
    expect(getAffectedCharacters(state, AANG, card, { kind: "automatic" })).toEqual([
      TOPH,
      AZULA,
    ]);
  });

  it("allEnemies hits every living enemy", () => {
    const state = mkState();
    const card = mkCard({ kind: "area", shape: "allEnemies" });
    expect(getAffectedCharacters(state, AANG, card, { kind: "automatic" })).toEqual([
      TOPH,
      SOKKA,
      AZULA,
    ]);
  });

  it("allegiance filter excludes allies from enemy AoE", () => {
    const state = mkState();
    const card = mkCard(
      { kind: "area", shape: "adjacentLanes" },
      { allegiance: "allies" },
    );
    // aang center: allies are aang (center/front), katara (left/rear), zuko (right/front)
    expect(getAffectedCharacters(state, AANG, card, { kind: "automatic" })).toEqual([
      "p0-c1",
      AANG,
      "p0-c2",
    ]);
  });

  it("selfAndAdjacentAllies covers self plus allies in adjacent lanes", () => {
    const state = mkState();
    const card = mkCard({ kind: "selfAndAdjacentAllies" }, { cardType: "defense" });
    expect(getAffectedCharacters(state, AANG, card, { kind: "automatic" })).toEqual([
      "p0-c1",
      AANG,
      "p0-c2",
    ]);
  });
});

describe("obstacles", () => {
  function obstacleState(lane: Lane): GameState {
    const state = mkState();
    state.terrain.push({ lane, terrainId: "obstacle", remainingRounds: null });
    return state;
  }

  it("blocks ranged attacks crossing the obstacle lane", () => {
    // aang center -> azula right crosses center? no: lanes between center,right = [] + target lane right.
    // obstacle in the TARGET lane blocks; use left-source vs right-target via center obstacle instead:
    const state = obstacleState("center");
    const card = mkCard({ kind: "singleEnemy", range: "ranged", canTargetRear: true });
    // katara (p0, left/rear) -> azula (p1, right/front) crosses center
    const azula = getLegalTargets(state, "p0-c1", card).find(
      (o) => o.primaryCharacterId === AZULA,
    )!;
    expect(azula.isLegal).toBe(false);
    expect(azula.illegalReason?.code).toBe("OBSTACLE_BLOCKED");
  });

  it("does not block melee in the same lane", () => {
    const state = obstacleState("center");
    const card = mkCard({ kind: "singleEnemy", range: "melee", canTargetRear: true });
    const toph = getLegalTargets(state, AANG, card).find((o) => o.primaryCharacterId === TOPH)!;
    expect(toph.isLegal).toBe(true);
  });

  it("ignoresObstacle bypasses the block", () => {
    const state = obstacleState("center");
    const card = mkCard(
      { kind: "singleEnemy", range: "ranged", canTargetRear: true },
      { ignoresObstacle: true },
    );
    const azula = getLegalTargets(state, "p0-c1", card).find(
      (o) => o.primaryCharacterId === AZULA,
    )!;
    expect(azula.isLegal).toBe(true);
  });

  it("AoE shape membership is unaffected by obstacles by default", () => {
    const state = obstacleState("center");
    const card = mkCard({ kind: "area", shape: "allEnemies" });
    expect(getAffectedCharacters(state, AANG, card, { kind: "automatic" })).toEqual([
      TOPH,
      SOKKA,
      AZULA,
    ]);
  });
});

describe("preview-resolution consistency", () => {
  it("every legal option preview equals getAffectedCharacters output", () => {
    const state = mkState();
    const cards = [
      mkCard({ kind: "singleEnemy", range: "melee", canTargetRear: true }),
      mkCard({ kind: "singleEnemy", range: "ranged", canTargetRear: true }),
      mkCard({ kind: "singleAlly", range: "any" }, { cardType: "support" }),
      mkCard({ kind: "lane", laneSelection: "chosen" }),
      mkCard({ kind: "area", shape: "allEnemiesInLane" }),
      mkCard({ kind: "area", shape: "cross" }),
      mkCard({ kind: "area", shape: "allEnemies" }),
      mkCard({ kind: "selfAndAdjacentAllies" }, { cardType: "defense" }),
      mkCard({ kind: "self" }, { cardType: "support" }),
    ];
    for (const card of cards) {
      for (const option of getLegalTargets(state, AANG, card)) {
        expect(option.affectedCharacterIds).toEqual(
          getAffectedCharacters(state, AANG, card, option.selection),
        );
        expect(validateTarget(state, AANG, card, option.selection).ok).toBe(option.isLegal);
      }
    }
  });

  it("rejects mismatched selection shapes", () => {
    const state = mkState();
    const card = mkCard({ kind: "singleEnemy", range: "melee", canTargetRear: true });
    const result = validateTarget(state, AANG, card, { kind: "lane", lane: "center" });
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("TARGET_MISMATCH");
  });
});
