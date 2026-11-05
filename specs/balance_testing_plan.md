# Balance Testing Plan — Avatar Tactical Card Game

**Status:** working plan, non-normative. Companion to `specs/card_roster.md` (what cards exist) and `specs/card_design_prototypes.md` (layouts). Companion mechanics proposals live in `specs/mechanics_proposals_v1.md`.
**Purpose:** define — *before any data exists* — what "balanced" means for this game, what we measure, what we build to measure it, and when a version may be called balanced. Thresholds below are declared up front so we never rationalize a number after seeing it. Changing a threshold is a decision that must be written down, not a reaction to a red cell.

---

## 1. Definition of done: what "balanced" means here

1. **Every character** pools to roughly **45–55%** win rate across the field; every **type** (Water/Earth/Fire/Air/Non-bending) within the same band.
2. **No polarized matchup.** No pairing that one side wins more than 65% of the time (at decision-grade sample sizes). Aggregate rates can look perfect while one matchup is a coin-flip-free loss — pair tables are the real test.
3. **Multiple strategies win.** Rushdown, save-up/bank control, and positional play each produce wins. If "bank chi, drop Comet Strike / Lightning Bolt" beats everything, tempo is mispriced and every game is a race to 3 chi.
4. **Every loss traces to a decision** (or a readable, counterable gamble) — not to an unavoidable matchup, a seat coin flip, or an auto-include staple.
5. **Guardrails hold under load:** villain-tier tools (bloodbending, combustion, suffocation-tier) stay counterable at their tuned costs; nothing permanently disables a character (roster v2 rule); Avatar State risk/reward lands inside its activation band (§2).
6. **Seat order does not decide games** — first-activation advantage stays inside its band (§2), which depends on the initiative mechanics in `mechanics_proposals_v1.md` §3.

## 2. Metrics, thresholds, actions

Thresholds are v1 defaults. "Flag" = investigate in the next batch. "Fail" = blocks calling the version balanced.

### 2.1 Core metrics

| Metric | Healthy | Flag | Fail | Likely action if flagged |
|---|---|---|---|---|
| Character win rate (pooled) | 45–55% | <42% or >58% | <38% or >62% | re-cost that character's pool staples; check slot pressure |
| Type win rate (pooled) | 45–55% | <43% or >57% | <40% or >60% | cross-class card pass for the weak type |
| Matchup (per pair, n ≥ 200) | 45–55% | beyond ±12pp | beyond ±20pp | give the loser type a targeted answer; check map interaction |
| First-activation win rate (randomized start) | 50–55% | >57% | >60% | adopt compensation rule (mechanics doc §3, option O2) |
| Staple inclusion rate (of legal loadouts) | <70% | >85% | >95% | re-price or print a rival at that slot |
| Card play-win delta (n ≥ 100 plays) | within ±10pp of baseline | ±10–15pp | ±15pp+ | re-cost; check if it has no counter (audit §3.1) |
| Bank-vs-play ratio (chi actions) | mixed by archetype | >80% of actions are banks *and* banks correlate with winning | >90% | tempo underpriced — raise effect per chi on cheap cards, or lower bank values |
| Avg team Energy spent / round | 2.5–4.0 of 4 | <2.0 or >3.9 | — | <2: cheap plays weak / banks dominate; >3.9: energy is not a constraint, cost axis is dead |
| Games reaching round 10 (time) | 30–70% | >85% or <10% | >95% or <5% | >85% grindy: raise lethality; <10% bursty: cut top-end damage or raise health |
| Round-1 KO rate | ~0% | >3% | >7% | deployment/burst problem (see placement doc §2) |
| Avatar State activation (games where meter filled) | 20–80% | <10% or >90% | — | <10% overpriced (nobody accepts instant-loss risk); >90% underpriced |
| Max disable chain (player-tier, no out in losing deck) | ≤ 1 round | 2 rounds | ≥3 rounds | re-gate lockdown cards; villain tier reviewed separately |
| Draw rate | <10% | >20% | >30% | tiebreaker too tight / lethality too low |

### 2.2 Descriptive metrics (watch, no threshold yet)

- **Turn/activation count per game** and its variance (catches stall strategies even if win rates look fine).
- **Focus economy:** focus gained vs spent per game; count of characters ending a round at 0 Focus for the 3rd+ time (starvation signal — probe P7).
- **Slot fill rate:** how often each slot type (gear/attack/defense) hits its 2-cap; a slot nobody fills is a dead constraint.
- **Assignment behavior:** share of assigned cards that are played vs auto-banked (shows whether the face-down system creates real bluff decisions or is perfunctory).
- **Facing accuracy:** how often a defender's facing matched the attack that actually arrived (see probe P6).

## 3. Paper audits — run before any simulation

Cheap, deterministic, and they catch design bugs no bot will ever surface deliberately. Every roster change re-runs all five.

### 3.1 Counterplay matrix
For every card in `card_roster.md`, write down the named answer(s) available to each opposing type (a card, a terrain rule, or a universal like Evade). **Fail** = a card whose only answer is "out-stat it", or a villain-tier card with no visible tell. This makes roster §4's "counterplay over hard-gating" a literal checklist.

### 3.2 Efficiency ordering
Build the table: damage/shield/heal/chi **and** per Energy for every card, grouped by element. Expected ordering: **signature (element) cards ≥ universal cards ≥ cross-class** efficiency, and cost tier must track effect tier (Comet Strike is the ceiling anchor at 2⚡+3💠). **Fail** = a cheaper card matching or beating a strictly more expensive card's output with no upside (today's near-tie: Blue Flame 4 dmg @2+2 vs Lightning Bolt 4 dmg @2+3 — the expensive card needs a rider or a discount).

### 3.3 Slot pressure ("the obvious 8")
Per character, list the best cards at each slot type under the 2/2/2-within-4 cap. **Fail** = a character whose best 4 are always the same 4 across all plausible matchups — its pool needs competitors at those slots, not more cards overall.

### 3.4 Guardrail audit
Every Villain/tier-gated card (bloodbending, combustion beams, suffocation-tier, flight): visible tell, counter available, cost ≥ ceiling anchor, duration ≤ 1 round of hard disable. **Fail** = any locked-down opponent with no possible out (ties to roster v2 "nothing permanently disables").

### 3.5 Rule-interaction audit
Walk the cross-cutting rules: water-impassable routing (does every map have ≥2 meaningful routes without Water Shoes?), facing, reaction windows, forced movement vs blocking terrain, activation order with unequal living counts (currently only implicit — see mechanics doc §3.1). **Deployment audit (edge-row zones, mechanics §2.4 adopted):** every map leaves **≥3 free (non-blocking) tiles in each edge row** (rows 0 and 6) — fail any map where a legal deployment doesn't exist; check row-spanning line shapes make row-wide AoE auto-efficient against a shared edge row (column spacing must be a real counter-decision); confirm the side roll is independent of the initiative roll (one roll must never stack two first-mover advantages); check the basic-action floor (free adjacent 1-dmg strike / shield-1 brace) — fail any cheap card the free action outclasses, and flag brace-stacking if round-reached metrics inflate. **Fail** = a map or board state with only one viable line of play.

## 4. Self-play harness (implemented — `src/game/ai/balanceSweep.test.ts`)

### 4.1 Foundation
The engine is already harness-friendly: deterministic `state.rng`, a full rules core, and an existing bot entry point — `chooseAutoAction(state, playerId, random)` in `src/game/auto.ts` with tests that already loop complete games (`auto.test.ts`). The harness is a batch runner around that loop, no UI.

**Implemented.** `src/game/ai/balanceSweep.test.ts` drives the Track A policy headless over seeded matches. It is **skipped unless `SWEEP_N` is set**, so `npm test` stays fast; run it explicitly:

```bash
make sweep                 # SWEEP_N=100 -> /tmp/balance_sweep.txt (SWEEP_N=/SWEEP_OUT= to override)
make sweep-baseline        # regenerate the committed specs/balance_sweep_baseline.txt
# or directly:
SWEEP_N=100 npx vitest run src/game/ai/balanceSweep.test.ts
```

It reports §2.1 core metrics (Wilson CIs, KO/cap/draw rates, HP-share margin, healing) for the shipped roster, hero-mirror, and villain-mirror matchups, plus a lethality tuning grid (`movement` × `hpScale` × `deploymentInset` × `damageScale`; energy is held at 4). Tuning is per-match data (`src/game/content/balance.ts`), so the harness overrides it without touching engine logic. It is T1-equivalent (greedy utility, full `GameState` — see §4.3). Results: **§10**.

**Pre-req fix — implemented.** Turn order is now enforced by the engine itself: `activationOwner(state)` in `turns.ts` derives who holds the activation (alternating, initiative first, rules §3), and `applyGameAction` rejects activation-scoped actions out of turn with `NOT_YOUR_TURN` (assignment/scrapping stay free, since they are secret preparation). The harness asks the engine who acts instead of alternating p1/p2 itself, so matchup tables here are decision-grade for turn order. The remaining harness simplification is deployment/secrecy only: both sides' assignments are visible to the policy, which the real game keeps hidden.

**Track B cannot move these numbers.** The sweep calls `chooseAutoAction` with no weights, so `VITE_AI_LLM` (the optional LLM advisor, `npc_ai_plan.md` §3) never appears in any result here — every table in §10 is pure Track A. Deliberate: balance baselines must reproduce with the network off. It also means LLM advice is currently unmeasured (`npc_ai_plan.md` §7.7) — never compare a §10 table against an LLM-enabled run.

### 4.2 Bot tiers
- **T0 — random legal action.** Sanity + engine fuzz (finds crashes, infinite loops, illegal states).
- **T1 — greedy value.** Play the biggest affordable damage/shield; otherwise bank; move toward nearest enemy. Catches gross pricing errors.
- **T2 — archetype bots.** Rush (always play attacks, never bank for bombs), Banker (save for Comet Strike/Lightning), Control (walls/statuses, hold center), Kite (avoid, poke with ranged). Run mirror-vs-mirror and cross pairs: **if Banker beats Rush >60% both directions, tempo is mispriced** (definition-of-done #3).
- **T3 — lookahead (later).** Depth-2 search on the top-N actions; only needed once T1/T2 stop discriminating.

### 4.3 Information rules
Bots may only read what a human player could see: own hand/chi/assignments; opponent's played cards, board, revealed facing. **Omniscient bots (full `GameState`) are allowed only for T0/T1 gross-degeneracy screens and must be labeled as such** — otherwise the harness measures perfect-information play, not this game (chi totals and face-down assignments are hidden by design, v0.3).

### 4.4 Log schema (JSONL, one line per game)
`seed, mapId, teamA{characters,loadouts}, teamB{...}, initiativeStartRule, winner, rounds, firstDamageRound, round1Kos, chiBanked{A,B}, energySpentAvg, focusGained, cardsPlayedCount, activationsOrder, resonanceActivated, maxDisableChainRound, endReason`
Everything in §2 must be derivable from these fields plus optional per-event logs.

### 4.5 Experiment suite
- **E1 — pooled rates:** every character in a fixed probe lineup (and type-mirror lineups) × N seeds. Feeds the first four rows of §2.1.
- **E2 — strategy probes:** T2 archetype cross-matrix.
- **E3 — economy curves:** bank:play ratios, energy spend, chi distribution over rounds; correlate with winning.
- **E4 — rule A/B:** same seeds, one variable changed — initiative rule (hardcoded p1 vs random vs compensation), water maps ±Water Shoes, reaction cards in pool vs removed.
- **E5 — stress tests:** degenerate loadouts (all-bombs, all-gear, 0-cost spam) to find dominant shapes.
- **E6 — fuzz:** T0 for a few thousand games as an engine-correctness gate.

Batch size: **10,000 games per experiment** (cheap headless), unless a metric's sample target (§7) is met sooner.

## 5. Human playtest telemetry

- Same JSONL schema per hot-seat game, plus **who sat which seat**.
- **Per-card:** assignment rate, play rate when affordable, play-win delta, bank rate.
- **Staple check:** inclusion across legal loadouts.
- **15-second post-game note** in the log: "what felt unfair?" — at small n, qualitative signal beats statistics.
- Discipline: never discuss a number from **< 10 human games**; call it a pattern only at **≥ 20**.

## 6. Targeted probes (our specific levers)

- **P1 — Water routing:** pond-heavy maps, teams ±Water Shoes. Metric: win rate of the side fielding Water Shoes on water-heavy maps. Flag >60% (water control too central) or <42% (card dead).
- **P2 — Avatar State risk/reward:** activation rate among games where the meter filled (band in §2.1); also: how often activation *changed* the winner (if it never changes outcomes, it's cosmetic; if it always does, it's a coin-flip button).
- **P3 — Reaction deterrence:** attack-declaration rate with strong reaction cards legal vs removed from the card pool. If reactions stop attacks entirely (>50% drop in attacks), they're a pacifier, not a bluff.
- **P4 — Lockdown:** longest consecutive disable chain observed; compare player-tier vs villain-tier (fail conditions §2.1).
- **P5 — Face-down info:** with assignments/facing hidden, how often does the defender place facing *toward the attack that arrives*? <chance+10pp = facing is noise; >chance+30pp = reads are solved and it telegraphs.
- **P6 — Seat/initiative A/B:** first-activation win rate under each rule in `mechanics_proposals_v1.md` §3 (feeds the compensation decision).
- **P7 — Focus starvation:** frequency of characters sitting at 0 Focus for ≥3 rounds (mechanics doc §1, option F2). Evade costs 1 Focus and the live pool's only focus gains are three cards — starvation is plausible today.

## 7. Statistics discipline

- Report **Wilson 95% intervals, never bare percentages.** At p≈0.5: n=40 → ±15.5pp, n=100 → ±9.8pp, n=200 → ±6.9pp, n=400 → ±4.9pp.
- **Sample tiers:** n=40/pair = screen (only gross blowouts mean anything); n=200/pair = decision-grade (this is what §2.1 matchup thresholds assume); pooled metrics get huge n automatically from every batch — use them as the primary dashboard.
- **Multiple comparisons:** 30 characters ≈ 435 pairs — some will flag by luck. Rule: a pair must **repeat as flagged in two independent batches** before acting on it.
- **A/B changes use paired seeds:** same seed set, one variable changed; compare paired differences (much lower variance than independent batches).
- **Elo/Glicko is a dashboard summary only.** Design decisions come from matchup tables — a single rating hides exactly the polarization we're hunting.

## 8. Cadence

1. **Every roster/tuning change:** §3 paper audits → E1+E3 sim batch → review flags → 3–5 human smoke games.
2. **Weekly (during active balancing):** full suite E1–E4, update the §2.1 table, log threshold changes (if any) with justification.
3. **Milestone gate before "balanced" is claimed:** all §2.1 rows non-fail across **two independent sim batches**, plus **20+ human games** with no unexplained "felt unfair" cluster, plus §3 audits green.

## 9. Automatic fail conditions (version gate)

A version may **not** be called balanced if any of these hold:

1. Any matchup fails the ±20pp bar at n≥200, or the same pair flags twice.
2. First-activation win rate >60% (random start) — the game is decided at the coin flip.
3. A villain-tier card has no visible tell/counter, or any disable chain ≥3 rounds with no out.
4. One strategy (T2 archetype) beats all others >60% in both directions.
5. Staple inclusion >95% — deck construction is an illusion.
6. Draw rate >30% — the round-limit tiebreaker is doing too much work.
7. Any threshold in §2.1 changed without a written decision note in this file.

---

## 10. Lethality + roster-parity pass — results and next steps (v0.3 engine + shipped tuning)

Third harness run (§4), Track A policy, **n = 100 per cell** (Wilson ±9.8pp at p≈0.5). Harness: `src/game/ai/balanceSweep.test.ts`. The shipped match runs on the defaults in `src/game/content/balance.ts`; **raw baseline cells are committed at `specs/balance_sweep_baseline.txt`** (regenerate with `make sweep-baseline`; the unfiltered harness also emits the tuning grid). Turn order is engine-enforced (§4.1); the remaining harness caveat is deployment/secrecy.

### 10.1 Measured

| Matchup | result | cap-reach | KO finish | draws | HP-share margin |
|---|---|---|---|---|---|
| Shipped — heroes (p1, north) vs villains (p2) | **heroes 46%** (46–51) | 20% | **76%** | 3% | 0.254 |
| Mirror heroes (seat alternated) | p1 45 / p2 55 | 50% | 39% | 0% | 0.289 |
| Mirror villains (seat alternated) | p1 46 / p2 52 | 8% | **92%** | 2% | 0.203 |

First KO lands at **round 3.2** on average in the shipped matchup (min 1). Round-1 KOs: 1% shipped, 0% hero mirror, 2% villain mirror. The shipped "unresolved 4" rows are Avatar-State instant losses, not missing results.

### 10.2 Gate verdict against §2.1

- **Lethality — PASS:** cap-reach 20% (≤70%), KO finish 76% (≥40%), draws 3% (<10%). KO has ~36pp of headroom rather than sitting on the threshold.
- **Matchup — PASS:** heroes 46% / villains 51%, inside the ±12pp flag band. (Was 25/75.)
- **Time — mixed:** shipped cap-reach 20% sits between the healthy 30–70% band and the <10% bursty flag; hero mirror is healthy at 50%; **villain mirror is 8% → FLAG** (<10% is bursty). The 90%-cap hero mirror from the lethality pass is gone.
- **Round-1 KO:** 1% shipped, 0% hero mirror, 2% villain mirror → OK (flag is >3%, fail >7%).
- **Draws:** 3% / 0% / 2% → OK (fail is >30%).
- **Seat:** north/first-mover 46% shipped, 53% hero mirror, 52% villain mirror — all CIs include 50%.
- Not yet measured: avg team Energy spent/round, Avatar State *activation* rate, staple rates, bank:play, per-character win rates.

### 10.3 What moved (three passes)

All knobs are per-match data (`MatchTuning` in `src/game/types.ts`, defaults in `src/game/content/balance.ts`), so the harness can re-run any cell without engine edits.

| Knob / rule | Original | Shipped | Why |
|---|---|---|---|
| `movement` | 1 | **2** | Contact happened in round 3–4; two tiles makes it round 1–2. |
| `hpScale` | 1 | **0.58** | 14–20 HP pool → 8–12, so focused fire finishes inside 10 rounds. |
| `deploymentInset` | 0 | **1** | Start on rows 1/5 instead of 0/6: one row closer without changing the board. |
| `damageScale` | 1 | **1.75** | Applied in `dealDamage` after the rulebook formula. 1.75 is the step where printed 2-damage staples deal 4; it gives hero sustain decks finishing power. |
| Cardless basic attack | scales | **exempt** | The free fallback stays at its printed 1 damage (rules §8 Phase 3). At ×1.5 it silently dealt 2 and was ~20% of all damage, favouring aggression-5 villains. |
| `comet-strike` | 5 | **4** | Largest single damage source (~14/match, no hero equivalent); 4 keeps it the ceiling anchor without deciding matchups. |
| Villain roster | Zuko, **Sokka**, Azula | **Zuko, Azula, Ozai** | Sokka is `role: "hero"` and was filling a villain slot; Ozai (the lore villain) was unused. |

Rejected during the pass: **+1 printed damage on each hero attack card** (Earth Sweep / Air Blast / Water Whip 2→3). At ×1.5 that rounds to +2 effective per hit and pushed hero win rates far outside the band. The lesson: under an integer damage multiplier, printed-damage changes compound; prefer roster/tuning levers and check rounding cliffs (`1.5` and `1.6` produce identical outcomes; `1.75` is a step change).

### 10.4 Key dynamics

1. **Parity came from roster + rounding, not a new mechanic.** Removing the hero-flavoured Sokka from the villain team and giving heroes a damage step they can actually use (4-damage staples) closed the 25/75 gap; the villain trio now wins its mirror 92% by KO.
2. **Heroes are no longer the grindy side.** The hero mirror moved from 5% KO / 90% cap to 39% KO / 50% cap. The remaining pacing flag is the *villain* mirror at 8% cap — bursty rather than grindy.
3. **Integer cliffs matter more than knob precision.** `damageScale` and `hpScale` both round; report the *effective* damage/HP values, not just the multipliers, when proposing changes. `1.5` and `1.6` can produce identical outcomes while `1.75` is a step change.
4. **Seat is fine** in all three cells.
5. **Avatar-State instant loss is a live outcome** (~4% of shipped games after this pass). It is working as designed; treat it as a separate risk axis when reading win rates.

### 10.5 Next steps (prioritized)

1. **Re-baseline at n≥200.** The current n=100 cells are ±9.8pp; run `make sweep-baseline` and add per-character/type win rates to the harness before treating pair tables as decision-grade.
2. **Investigate the villain mirror's 8% cap-reach.** Villain games end by KO almost always; confirm this is acceptable burst (Ceasefire/Comet trades) rather than a missing defensive option. If it needs calming, raise `hpScale` slightly rather than cutting damage.
3. **Counterplay/efficiency audits (§3.1–3.2) under the tuned numbers.** Every printed value now resolves through ×1.75; recompute damage-per-Energy tables and confirm the signature > universal > cross-class ordering still holds.
4. **Watch the villain basic-attack share.** Ozai (aggression 5) is now in the villain lineup and the AI leans on the free strike; the cardless-floor audit stays open even though it no longer scales.
5. **Keep the gates fixed.** KO 76% / cap 20% has headroom, but any roster edit can move it; compare paired seeds and log the decision note required by §2.
6. **Harness follow-ons:** emit the §4.4 JSONL per-game log; add T2 archetype bots (§4.2) now that pacing is usable.


### 10.6 Follow-ups (not balance)

- Track A M2 remainder: debug overlay (`chooseAutoActionTraced` + `ai/traceLog.ts` already exist; hook near `src/App.tsx` auto loop), tracked in `npc_ai_plan.md` §A.7.
- Optional `VITE_AI_POLICY=random` A/B baseline flag (npc_ai_plan.md §4); useful for policy comparisons, but not a prerequisite for the current balance work.
