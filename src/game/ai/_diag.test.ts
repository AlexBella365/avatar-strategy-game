// Temporary diagnostic (not committed): where does the hero/villain gap come from?
import { it } from "vitest";
import { createInitialState, type TeamSetup } from "../state";
import { CHARACTERS } from "../content/characters";
import { ECONOMY_TUNING } from "../content/economy";
import { chooseAutoAction } from "../auto";
import { applyGameAction } from "../rules/cards";
import { activationOwner, drawCards, endRound } from "../rules/turns";
import { BASE_WEIGHTS } from "./personalities";
import type { CharacterDefinition, GameState, Position } from "../types";

function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const byId = (id: string) => CHARACTERS.find((c) => c.id === id)!;
const HEROES = [byId("aang"), byId("katara"), byId("toph")];
const VILLAINS = [byId("zuko"), byId("sokka"), byId("azula")];
const slots = (inset: number): [Position[], Position[]] => [
  [
    { x: 1, y: inset },
    { x: 3, y: inset },
    { x: 5, y: inset },
  ],
  [
    { x: 1, y: 6 - inset },
    { x: 3, y: 6 - inset },
    { x: 5, y: 6 - inset },
  ],
];

interface Tuning {
  movement: number;
  hpScale: number;
  damageScale: number;
}

function sim(
  a: CharacterDefinition[],
  b: CharacterDefinition[],
  seed: number,
  tuning: Tuning,
  neutral: { p1: boolean; p2: boolean },
) {
  const [north, south] = slots(1);
  const teams: [TeamSetup, TeamSetup] = [
    { playerId: "p1", characterDefs: a, positions: north },
    { playerId: "p2", characterDefs: b, positions: south },
  ];
  const state = createInitialState(teams, seed, {
    northPlayerId: "p1",
    tuning: { ...tuning, deploymentInset: 1 },
  });
  drawCards(state, "p1", ECONOMY_TUNING.drawPerRound);
  drawCards(state, "p2", ECONOMY_TUNING.drawPerRound);
  const random = mulberry(seed);
  let guard = 0;
  while (state.winnerId === null && !state.isDraw && state.round <= state.maxRounds && guard < 5000) {
    guard += 1;
    const mover = activationOwner(state);
    if (!mover) {
      endRound(state);
      continue;
    }
    const wantNeutral = mover === "p1" ? neutral.p1 : neutral.p2;
    const action = chooseAutoAction(state, mover, random, wantNeutral ? BASE_WEIGHTS : undefined);
    if (!action) throw new Error("stalled");
    const result = applyGameAction(state, action);
    if (result.errors.length > 0) throw new Error(JSON.stringify(result.errors));
    Object.assign(state, result.state);
  }
  const log = state.log.join("\n");
  const sum = (re: RegExp) => {
    let total = 0;
    for (const m of log.matchAll(re)) total += Number(m[1]);
    return total;
  };
  const countBy = (re: RegExp) => {
    const out: Record<string, number> = {};
    for (const m of log.matchAll(re)) out[m[1]] = (out[m[1]] ?? 0) + 1;
    return out;
  };
  const sumBy = (re: RegExp) => {
    const out: Record<string, number> = {};
    for (const m of log.matchAll(re)) out[m[1]] = (out[m[1]] ?? 0) + Number(m[2]);
    return out;
  };
  const causeBy: Record<string, number> = {};
  for (const m of log.matchAll(/^[a-z-]+ takes (\d+) \((.+)\)\.$/gm)) {
    causeBy[m[2]] = (causeBy[m[2]] ?? 0) + Number(m[1]);
  }
  return {
    dmgBy: sumBy(/^([a-z-]+) takes (\d+) \(/gm),
    causeBy,
    healBy: sumBy(/^([a-z-]+) recovers (\d+)\./gm),
    basicsBy: countBy(/^([a-z-]+) makes a basic attack/gm),
    bracesBy: countBy(/^([a-z-]+) braces /gm),
    alive: Object.fromEntries(state.characters.map((c) => [c.definitionId, c.health > 0 ? 1 : 0])),
    p1: state.winnerId === "p1",
    p2: state.winnerId === "p2",
    draw: state.isDraw,
    ko: log.includes("wins by knockout"),
    cap: log.includes("wins on tiebreakers") || log.includes("Round limit reached"),
    plays: (log.match(/ plays /g) ?? []).length,
    basics: (log.match(/ makes a basic attack/g) ?? []).length,
    braces: (log.match(/ braces /g) ?? []).length,
    playsBy: countBy(/^([a-z-]+) plays /gm),
    dmg: sum(/ takes (\d+) \(/g),
    heal: sum(/ recovers (\d+)\./g) + sum(/ regenerates (\d+)/g),
  };
}

function rate(label: string, tuning: Tuning, neutral = { p1: false, p2: false }) {
  const N = 100;
  const recs = Array.from({ length: N }, (_, i) => sim(HEROES, VILLAINS, i + 1, tuning, neutral));
  const pct = (x: number) => ((100 * x) / N).toFixed(0);
  const heroIds = new Set(HEROES.map((h) => h.id));
  const sideSum = (pick: (r: (typeof recs)[number]) => Record<string, number> | undefined) => {
    let heroes = 0;
    let villains = 0;
    for (const r of recs) {
      for (const [id, n] of Object.entries(pick(r) ?? {})) {
        if (heroIds.has(id)) heroes += n;
        else villains += n;
      }
    }
    return `${(heroes / N).toFixed(1)}/${(villains / N).toFixed(1)}`;
  };
  const causes: Record<string, number> = {};
  for (const r of recs) {
    for (const [c, n] of Object.entries(r.causeBy)) causes[c] = (causes[c] ?? 0) + n;
  }
  const topCauses = Object.entries(causes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([c, n]) => `${c} ${(n / N).toFixed(1)}`)
    .join(", ");
  const perChar = (pick: (r: (typeof recs)[number]) => Record<string, number>) => {
    const totals: Record<string, number> = {};
    for (const r of recs) {
      for (const [id, n] of Object.entries(pick(r))) totals[id] = (totals[id] ?? 0) + n;
    }
    return Object.entries(totals)
      .map(([id, n]) => `${id} ${(n / N).toFixed(1)}`)
      .join(", ");
  };
  console.log(
    `${label}: heroes ${pct(recs.filter((r) => r.p1).length)}% | KO ${pct(recs.filter((r) => r.ko).length)}% | ` +
      `cap ${pct(recs.filter((r) => r.cap).length)}% | draws ${pct(recs.filter((r) => r.draw).length)}% | ` +
      `plays ${(recs.reduce((s, r) => s + r.plays, 0) / N).toFixed(1)} | basics ${(recs.reduce((s, r) => s + r.basics, 0) / N).toFixed(1)} | ` +
      `braces ${(recs.reduce((s, r) => s + r.braces, 0) / N).toFixed(1)} | ` +
      `dmg ${(recs.reduce((s, r) => s + r.dmg, 0) / N).toFixed(1)} | heal ${(recs.reduce((s, r) => s + r.heal, 0) / N).toFixed(1)} | ` +
      `H/V plays ${sideSum((r) => r.playsBy)} basics ${sideSum((r) => r.basicsBy)} braces ${sideSum((r) => r.bracesBy)}\n` +
      `  causes: ${topCauses}\n` +
      `  taken: ${perChar((r) => r.dmgBy)}\n` +
      `  healed: ${perChar((r) => r.healBy)} | alive: ${perChar((r) => r.alive)}`,
  );
}

it("diagnose matchup", () => {
  rate("c4 h0.65 d1.75", { movement: 2, hpScale: 0.65, damageScale: 1.75 });
  rate("c4 h0.62 d1.75", { movement: 2, hpScale: 0.62, damageScale: 1.75 });
  rate("c4 h0.58 d1.75", { movement: 2, hpScale: 0.58, damageScale: 1.75 });
  rate("c4 h0.65 d1.8", { movement: 2, hpScale: 0.65, damageScale: 1.8 });
}, 900000);
