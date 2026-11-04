// Balance self-play harness (specs/balance_testing_plan.md §4).
//
// NOT part of the normal test suite: this file is skipped unless SWEEP_N is
// set, so `npm test` stays fast. Run it explicitly:
//
//   SWEEP_N=100 npx vitest run src/game/ai/balanceSweep.test.ts
//   SWEEP_N=60 SWEEP_OUT=/tmp/balance.txt npx vitest run src/game/ai/balanceSweep.test.ts
//
// It drives the Track A policy (src/game/auto.ts -> ai/policy.ts) headless over
// seeded matches and dumps an aggregate report (Wilson CIs, KO/cap/draw rates,
// healing, and a lethality tuning grid) to SWEEP_OUT (default /tmp/balance_sweep.txt).
//
// Caveat (§4.1) — resolved: alternating activations are now enforced by the
// engine itself (activationOwner/applyGameAction, rules §3), so the harness
// simply asks the engine who holds the turn. Tables here are decision-grade
// for turn order; the remaining harness caveat is deployment/secrecy only.
//
// This file is excluded from tsconfig (it uses Node stdlib types the browser
// target doesn't ship); vitest transpiles it directly, no type-check needed.
import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { createInitialState, type TeamSetup } from "../state";
import { CHARACTERS } from "../content/characters";
import { DEFAULT_MATCH_TUNING } from "../content/balance";
import { ECONOMY_TUNING } from "../content/economy";
import { chooseAutoAction } from "../auto";
import { applyGameAction } from "../rules/cards";
import { activationOwner, drawCards, endRound, teamHealthShare } from "../rules/turns";
import type { CharacterDefinition, GameState, Position } from "../types";

const RUN = process.env.SWEEP_N !== undefined;
const N = Number(process.env.SWEEP_N ?? 40);
/** Per-cell size for the (wide) tuning grid; defaults to the baseline N. */
const GRID_N = Number(process.env.SWEEP_GRID_N ?? N);
const OUT_PATH = process.env.SWEEP_OUT ?? "/tmp/balance_sweep.txt";

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
/** Deployment slots for an inset (0 = edge rows 0/6, 1 = rows 1/5, ...). */
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
const HEROES: CharacterDefinition[] = [byId("aang"), byId("katara"), byId("toph")];
const VILLAINS: CharacterDefinition[] = [byId("zuko"), byId("sokka"), byId("azula")];

interface Opts {
  rounds?: number;
  /** Lower HP ≈ a more lethal game (approximation of more damage). */
  hpScale?: number;
  /** Base movement points per activation. */
  movement?: number;
  /** Team energy refreshed each round. */
  energyPerRound?: number;
  /** Deployment rows are inset this far from the board edges. */
  deploymentInset?: number;
  /** Multiplier on card healing. */
  healingScale?: number;
  /** Multiplier on all incoming damage. */
  damageScale?: number;
}

interface MatchRecord {
  seed: number;
  northPlayerId: "p1" | "p2";
  winnerId: string | null;
  isDraw: boolean;
  round: number;
  decision: "ko" | "tiebreak" | "limit-draw" | "ko-draw" | "unresolved";
  kos: number;
  firstKOround: number | null;
  logLen: number;
  instantHeal: number;
  regenApplied: number;
  spikePlays: number;
  cardPlays: number;
  damageTotal: number;
  shareP1: number;
  shareP2: number;
}

function sim(state: GameState, seed: number): MatchRecord {
  const random = mulberry(seed);
  const koRound = new Map<string, number>();
  const noteKOs = () => {
    for (const c of state.characters) {
      if (c.health <= 0 && !koRound.has(c.id)) koRound.set(c.id, state.round);
    }
  };
  let guard = 0;
  while (state.winnerId === null && !state.isDraw && state.round <= state.maxRounds && guard < 5000) {
    guard += 1;
    const mover = activationOwner(state);
    if (!mover) {
      endRound(state);
      noteKOs();
      continue;
    }
    const action = chooseAutoAction(state, mover, random);
    if (!action) {
      throw new Error(`seed ${seed}: stalled (no action for mover ${mover})`);
    }
    const result = applyGameAction(state, action);
    if (result.errors.length > 0) {
      throw new Error(`seed ${seed}: ${action.type} rejected: ${JSON.stringify(result.errors)}`);
    }
    Object.assign(state, result.state);
    noteKOs();
  }

  const log = state.log.join("\n");
  const sum = (re: RegExp): number => {
    let total = 0;
    for (const m of log.matchAll(re)) total += Number(m[1]);
    return total;
  };
  let decision: MatchRecord["decision"] = "unresolved";
  if (log.includes("wins by knockout")) decision = "ko";
  else if (log.includes("wins on tiebreakers")) decision = "tiebreak";
  else if (log.includes("All characters knocked out")) decision = "ko-draw";
  else if (log.includes("Round limit reached — draw")) decision = "limit-draw";

  return {
    seed,
    northPlayerId: state.northPlayerId as "p1" | "p2",
    winnerId: state.winnerId,
    isDraw: state.isDraw,
    round: state.round,
    decision,
    kos: state.characters.filter((c) => c.health <= 0).length,
    firstKOround: koRound.size > 0 ? Math.min(...koRound.values()) : null,
    logLen: state.log.length,
    instantHeal: sum(/ recovers (\d+)\./g),
    regenApplied: sum(/ regenerates (\d+)/g),
    spikePlays: (log.match(/ plays (Miraculous Balm|Healing Waters|Second Wind) /g) ?? []).length,
    cardPlays: (log.match(/ plays /g) ?? []).length,
    damageTotal: sum(/ takes (\d+) \(/g),
    shareP1: teamHealthShare(state, "p1"),
    shareP2: teamHealthShare(state, "p2"),
  };
}

function build(
  rosterP1: CharacterDefinition[],
  rosterP2: CharacterDefinition[],
  northPlayerId: "p1" | "p2",
  opts: Opts,
  seed: number,
): GameState {
  const inset = opts.deploymentInset ?? DEFAULT_MATCH_TUNING.deploymentInset;
  const [north, south] = slots(inset);
  const teams: [TeamSetup, TeamSetup] = [
    { playerId: "p1", characterDefs: rosterP1, positions: northPlayerId === "p1" ? north : south },
    { playerId: "p2", characterDefs: rosterP2, positions: northPlayerId === "p1" ? south : north },
  ];
  // The match seed drives BOTH deck shuffles (state.ts offsets per team), so
  // it must vary per match: otherwise every game in a cell replays the same
  // opening hands and n only samples the policy's tie-break rolls.
  const state = createInitialState(teams, seed, {
    northPlayerId,
    tuning: {
      hpScale: opts.hpScale ?? DEFAULT_MATCH_TUNING.hpScale,
      movement: opts.movement ?? DEFAULT_MATCH_TUNING.movement,
      energyPerRound: opts.energyPerRound ?? DEFAULT_MATCH_TUNING.energyPerRound,
      deploymentInset: inset,
      healingScale: opts.healingScale ?? DEFAULT_MATCH_TUNING.healingScale,
      damageScale: opts.damageScale ?? DEFAULT_MATCH_TUNING.damageScale,
    },
  });
  if (opts.rounds) state.maxRounds = opts.rounds;
  return state;
}

function run(
  rosterP1: CharacterDefinition[],
  rosterP2: CharacterDefinition[],
  seed: number,
  opts: Opts = {},
  northPlayerId: "p1" | "p2" = seed % 2 === 0 ? "p2" : "p1",
): MatchRecord {
  const state = build(rosterP1, rosterP2, northPlayerId, opts, seed);
  drawCards(state, "p1", ECONOMY_TUNING.drawPerRound);
  drawCards(state, "p2", ECONOMY_TUNING.drawPerRound);
  return sim(state, seed);
}

function wilson(wins: number, n: number): [number, number] {
  const z = 1.96;
  const p = wins / n;
  const d = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(centre - margin) / d, (centre + margin) / d];
}

const OUT: string[] = [
  "# Balance sweep — baseline report (v0.3 engine)",
  "",
  "Raw output of the self-play harness `src/game/ai/balanceSweep.test.ts`.",
  `Generated with SWEEP_N=${N}: Track A utility policy, seeds 1..${N} per cell.`,
  "Turn order is engine-enforced (alternating activations, rules 3), so the",
  "driver asks the engine who holds the turn — tables here are decision-grade",
  "for order (specs/balance_testing_plan.md 4.1).",
  "Interpretation + prioritized next steps: specs/balance_testing_plan.md 10.",
  "",
  "Regenerate with:  make sweep-baseline",
  `  (or) SWEEP_N=${N} SWEEP_OUT=specs/balance_sweep_baseline.txt npx vitest run src/game/ai/balanceSweep.test.ts`,
  "",
  "---",
];
const emit = (line: string) => OUT.push(line);

function summarise(label: string, records: MatchRecord[]) {
  const n = records.length;
  const pct = (x: number) => `${((100 * x) / n).toFixed(1)}%`;
  const winsP1 = records.filter((r) => r.winnerId === "p1").length;
  const winsP2 = records.filter((r) => r.winnerId === "p2").length;
  const draws = records.filter((r) => r.isDraw).length;
  const northWins = records.filter((r) => r.winnerId === r.northPlayerId).length;
  const [lo, hi] = wilson(northWins, n);
  const by = (d: MatchRecord["decision"]) => records.filter((r) => r.decision === d).length;
  const avg = (f: (r: MatchRecord) => number) =>
    (records.reduce((s, r) => s + f(r), 0) / n).toFixed(2);
  const reachedCap = records.filter((r) => r.decision === "tiebreak" || r.decision === "limit-draw").length;
  const koRounds = records.map((r) => r.firstKOround).filter((x): x is number => x !== null);
  const round1KO = records.filter((r) => r.firstKOround === 1).length;
  const margins = records.map((r) => Math.abs(r.shareP1 - r.shareP2)).sort((a, b) => a - b);
  const med = margins[Math.floor(margins.length / 2)] ?? 0;

  emit(`\n===== ${label} (n=${n}) =====`);
  emit(`p1 ${winsP1} (${pct(winsP1)}) | p2 ${winsP2} (${pct(winsP2)}) | draws ${draws} (${pct(draws)})`);
  emit(`north/first-mover ${pct(northWins)}  95% CI [${(lo * 100).toFixed(1)}%, ${(hi * 100).toFixed(1)}%]`);
  emit(
    `decision: KO ${by("ko")} (${pct(by("ko"))}) | tiebreak ${by("tiebreak")} (${pct(by("tiebreak"))}) | ` +
      `limit-draw ${by("limit-draw")} | ko-draw ${by("ko-draw")} | unresolved ${by("unresolved")}`,
  );
  emit(
    `cap-reach ${pct(reachedCap)} | avg rounds ${avg((r) => r.round)} | avg KOs ${avg((r) => r.kos)} | ` +
      `round-1 KO ${round1KO} (${pct(round1KO)})`,
  );
  if (koRounds.length) {
    emit(`first KO round: min ${Math.min(...koRounds)} | avg ${(koRounds.reduce((a, b) => a + b, 0) / koRounds.length).toFixed(1)}`);
  }
  emit(`damage/match ${avg((r) => r.damageTotal)} | HP-share margin avg ${(margins.reduce((a, b) => a + b, 0) / n).toFixed(3)} median ${med.toFixed(3)}`);
  emit(`plays/match ${avg((r) => r.cardPlays)} | spike-heal plays ${avg((r) => r.spikePlays)} | instant heal ${avg((r) => r.instantHeal)} | regen ${avg((r) => r.regenApplied)}`);
}

/** One compact tuning row: does this lethality knob clear the §2.1 gates? */
function gridRow(label: string, records: MatchRecord[]) {
  const n = records.length;
  const pct = (x: number) => ((100 * x) / n).toFixed(0);
  const cap = records.filter((r) => r.decision === "tiebreak" || r.decision === "limit-draw").length;
  const ko = records.filter((r) => r.decision === "ko").length;
  const draws = records.filter((r) => r.isDraw).length;
  const margins = records.map((r) => Math.abs(r.shareP1 - r.shareP2));
  const margin = margins.reduce((a, b) => a + b, 0) / n;
  const ok = cap / n <= 0.7 && ko / n >= 0.4 && draws / n < 0.1;
  return `${ok ? "PASS" : "    "}  ${label.padEnd(26)} cap ${pct(cap)}%  KO ${pct(ko)}%  draws ${pct(draws)}%  margin ${margin.toFixed(3)}`;
}

describe.skipIf(!RUN)("balance sweep", () => {
  it("baseline + mirrored matchups", () => {
    const shipped: MatchRecord[] = [];
    const mirrorH: MatchRecord[] = [];
    const mirrorV: MatchRecord[] = [];
    for (let s = 1; s <= N; s++) {
      shipped.push(run(HEROES, VILLAINS, s, {}, "p1")); // as shipped: heroes are p1 + north
      mirrorH.push(run(HEROES, HEROES, s));
      mirrorV.push(run(VILLAINS, VILLAINS, s));
    }
    summarise("shipped: heroes(p1, north) vs villains(p2)", shipped);
    summarise("mirror heroes (seat alternated)", mirrorH);
    summarise("mirror villains (seat alternated)", mirrorV);
    emit("\nLethality gates on the shipped defaults:");
    emit(gridRow("SHIPPED DEFAULTS", shipped));
    emit(`tuning: ${JSON.stringify(DEFAULT_MATCH_TUNING)}`);
  }, 900000);

  it("lethality tuning grid (movement x hp x deployment inset x damage)", () => {
    // Energy was explored at 4/6 in the first pass; 4 was kept (it changes how
    // often cards are played, not whether contact is lethal) so the grid can
    // spend its cells on the knobs that matter: movement (contact timing), HP
    // (kill window), inset (starting distance), and the damage multiplier.
    const movements = [1, 2];
    const hpScales = [1, 0.8, 0.65];
    const insets = [0, 1];
    const damageScales = [1, 1.5];
    const emitGrid = (rosterLabel: string, a: CharacterDefinition[], b: CharacterDefinition[]) => {
      emit(`\n===== tuning grid: ${rosterLabel} (n=${GRID_N} per cell) =====`);
      for (const movement of movements) {
        for (const hpScale of hpScales) {
          for (const deploymentInset of insets) {
            for (const damageScale of damageScales) {
              const opts = { movement, hpScale, deploymentInset, damageScale, rounds: 10 };
              const recs: MatchRecord[] = [];
              for (let s = 1; s <= GRID_N; s++) recs.push(run(a, b, s, opts));
              emit(
                gridRow(
                  `mv${movement} hp x${hpScale} in${deploymentInset} dmg x${damageScale}`,
                  recs,
                ),
              );
            }
          }
        }
      }
    };
    emitGrid("shipped heroes vs villains", HEROES, VILLAINS);
    emitGrid("mirror heroes", HEROES, HEROES);
    emit("\nPASS = cap-reach <=70% AND KO-finish >=40% AND draws <10% (balance_testing_plan §2.1).");
  }, 1800000);

  it("writes the report", () => {
    writeFileSync(OUT_PATH, OUT.join("\n"));
  });
});
