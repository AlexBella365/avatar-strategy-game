# Mechanics Proposals v1 — Economy, Deployment, Initiative

**Status:** design proposals, nothing implemented. One doc, three areas requested: (§1) generating chi & focus, (§2) placing characters at battle start, (§3) determining order of play. Each area: current state (verified against engine/spec), design goals, options with trade-offs, a recommendation, and engine deltas. Measurement hooks cross-reference `specs/balance_testing_plan.md` (probes/experiments).

---

## §1 Generating chi & focus

### 1.1 Current state (verified)

- **Chi** — team-shared, starts 0, uncapped, hidden from opponent (v0.3). Income is *passive*: every round the 2 unassigned cards auto-bank, and assigned-but-unplayed cards auto-scrap at round end (`bankLeftovers`, `turns.ts:110`). Card values 1–3 → typical income ~2–5/round. Spending: Play costs (chiCost 0–6). There is no *active* way to earn chi.
- **Focus** — per-character 0–4, starts 1 (`state.ts:74`). **Sinks:** Evade costs 1 Focus, once/round (`movement.ts:198–227`); card `focusCost` — but **every shipped card has focusCost 0**. **Sources:** 3 cards in the live pool (Sokka's Feint, Precision Strike, Smoke and Mirrors grant +1 Focus) plus any passives. The v0.2 "Prepare" intention (+1 Focus) was replaced by v0.3's face-down assignment, so there is **no natural focus regen**.
- **Energy** — flat 4/round, no carryover (context for both currencies).

**Diagnosis:** chi generation has no decisions in it (you always bank leftovers; the only choice is play-vs-scrap of the assigned card — that part *is* a decision and is good). Focus is close to inert: almost no sinks are live (all cards cost 0), almost no gains exist, and the one real sink (Evade) can permanently starve a character at 1 → 0 with no recovery path — a death spiral against a ranged deck.

### 1.2 Design goals

1. Income is a **decision or a positioning payoff**, not just a trickle.
2. Opponents can infer rough economy state (chi stays hidden by design — so gains should be *visibly caused*: "they banked, they scored first blood").
3. Archetype alignment: aggression and control should each have a natural faucet.
4. Every new faucet is a **named balance lever** the harness can A/B (plan E4).
5. No snowball faucets without a valve (rich-get-richer fails the comeback goal).

### 1.3 Chi options

- **C1 — Bank-scrap engine (status quo, baseline).** Decision = play vs scrap per activation; bluff via face-down assignment.
  *Pros:* built, hidden info intact, already creates tempo-vs-income tension. *Cons:* generation itself is flavorless (discarding = income?) and fully passive; every team's income curve is nearly identical, so it can't differentiate archetypes. *Keeps as the baseline every other option is measured against.*
- **C2 — Objective income ("first blood").** At round end, the team that dealt the round's **first damage** banks +1 chi (tie → no one). Alternative flavor: "takedown" bonus on KO.
  *Pros:* active, visible cause, rewards aggression — gives rushdown a faucet. *Cons:* snowball risk — pair it with C4 (underdog) as the valve; tiny bookkeeping.
- **C3 — Elemental terrain faucet.** End of round: +1 chi if one of your characters stands on **elemental terrain you created** (your Bonfire, your water tile, your raised ground). *Pros:* deepest fantasy fit — bending the map pays; turns terrain cards into economy engines; differentiates archetypes naturally (fire wants Bonfire control, water wants ponds). *Cons:* bookkeeping; weak early; needs terrain density on maps. Best as a **signature-character passive** first (e.g., a firebender's "siphons flame"), not a universal rule.
- **C4 — Underdog trickle (comeback valve).** The team with **fewer living characters** banks +1 chi at round start (+1 per missing character, capped at +2). *Pros:* directly attacks the knockout death spiral; trivially measurable (plan E4); invisible-cause problem doesn't apply because board state shows why. *Cons:* can feel like a pity mechanic if visible — keep it as quiet background math; may subsidize bad play.
- **C5 — Convert other currencies (focus→chi, momentum→chi).** *Reject:* blurs currency identity (focus = per-character reactive timing, chi = team ammo) and makes sinks unspecialized.

### 1.4 Focus options

- **F1 — Card/passive only (status quo).** *Verdict:* insufficient — see starvation diagnosis §1.1; keep as a source, not the only source.
- **F2 — Floor regen (recommended).** At round start, every living character at **0 Focus regains 1**. *Pros:* kills the death spiral without touching focus as a scarce resource (characters at 1–4 don't regen, so Evade timing still matters); one line in the round-start phase. *Cons:* none significant; slight buff to evasive play. Probe: plan P7.
- **F3 — Dodge income.** Gain 1 Focus when your Evade successfully causes a miss. *Pros:* beautiful air/evasion fantasy — dodging feeds more dodging *within the cap*. *Cons:* strong self-sustain; could make ranged matchups endless. Ship only as a **character passive candidate** (air-flavored) and A/B it — not a global rule.
- **F4 — On-hit income.** Gain 1 Focus when your attack hits (not on miss). *Pros:* rewards commitment; mirrors Momentum's existing "successful setup/counter" flavor — actually overlaps Momentum's design space. *Verdict:* redundant with Momentum; fold into Momentum cards instead of adding a second on-hit currency.
- **F5 — Assignment synergy.** Face-down banked cards could grant their assigned character +1 Focus (the character "prepared" while the team banked). *Pros:* ties the v0.3 signature system to focus income — elegant, no new phases. *Cons:* makes focus income invisible-ish and couples two systems; bluff surface gets muddier (is the assigned card a play or a focus-farm?). **Dark-horse candidate — prototype as one character's passive** before considering global.

### §1 Recommendation

1. **Adopt F2** (0-Focus floor regen) — fixes a real starvation bug cheaply; it is a balance-plan probe (P7) and needs one round-start hook + tests.
2. **Run C1 vs (C2 + C4) as an A/B** in the harness (plan E4): baseline vs "first-blood + underdog". Adopt only if the pair moves the strategy matrix (E2) toward multi-strategy health without hurting draw rate.
3. **Park C3/F3/F5** as signature-character passives for the next character-roster pass — they are flavor payoffs, not systemic fixes.
4. **Design rule going forward:** new cards that cost Focus (currently zero in the pool) are how focus becomes a real axis — the next pool pass should ship at least 2–3 cards with focusCost ≥ 1, or focus stays decorative.

**Engine deltas (flagged, not implemented):** round-start hook for F2; optional round-end hooks for C2/C4 with events in the log (plan JSONL fields); tests for each; `types.ts` effect union entries if modeled as effects rather than hard rules.

---

## §2 Placing characters at start of battle

### 2.1 Current state (verified)

Spec v2 §4.2: Team A deploys rows 0–1, Team B rows 5–6 on the 7×7 grid; each team picks **three distinct legal tiles** in its own zone; UI offers default positions; engine must validate (no blocking terrain, no stacking). The two placements are **independent** — no interaction, no order, no stakes beyond personal preference. (Spec note: v2 §3 "Starting values" still says "7 columns × 5 rows" while §4.1 says 7×7 — fix the typo when next editing.)

**Diagnosis:** free simultaneous placement with known teams converges on defaults — the UI literally suggests them. Unless zone tiles *differ meaningfully* (terrain, exposure), placement is a formality, and a formality at game start is a missed decision. Also relevant: round-1 KO rate (plan §2.1) and water-impassable routing (audit §3.5) are both placement-shaped problems.

### 2.2 Design goals

1. Placement must be a **decision with opponent awareness** (teams are chosen pre-game, so you can react to their composition).
2. It must stay **fast** — under ~20 seconds per side; this is setup, not the game.
3. Archetypes express: aggro wants the front edge, control wants cover/back, split wants flanks.
4. Symmetric-fair under every initiative rule chosen in §3.

### 2.3 Options

- **P1 — Simultaneous secret placement (status quo+, recommended base).** Both sides lock placements privately, revealed together. *Pros:* zero added time; mind-game vs the known enemy composition; defaults still available. *Cons:* no direct interaction — if defaults are fine, players stop choosing. Upgrade path: show both locked placements simultaneously so round-1 facing/approach reads start at t=0.
- **P2 — Alternating draft placement.** A places one character, B places one, … A-B-A-B-A-B (six picks). *Pros:* real interaction — deny center columns, counter their tank with a flank; the strongest "decision" option; measured by plan E1 (adaptive-placement bot vs default-placement bot — if the delta is ~0, placement doesn't matter and P2 is waste; if >3pp, it does). *Cons:* +6 decisions and ~30–45s more setup; first-drafter edge needs mitigation (link to §3: the player who places **second** gets first activation — trade board position for tempo).
- **P3 — Formation preset + one flex pick.** Pick a named formation (Line / Wedge / Split / Phalanx) that auto-places 2 characters, then freely place the 3rd. *Pros:* fast (one card click + one tile), readable, still decisionful; formations are great UI furniture. *Cons:* formations become another balance surface to cost and counter; some matchup-dependence hides behind presets.
- **P4 — Stakes via map terrain (recommended alongside P1).** Put cover/water/choke tiles *inside* deployment zones (per-map), so tile choice has inherent value — no flow change at all. *Pros:* cheapest possible fix; makes existing validation meaningful; interacts with water-impassable rule (a pond edge spawn = routing decision at t=0). *Cons:* does nothing for maps with flat zones — needs map authoring discipline.
- **P5 — Reserve deployment (units enter from off-board later).** *Reject for this game:* rewrites the core loop, adds a whole phase, and the 7×7 board is too small for staging areas.

### §2 Recommendation

**P1 + P4 now** (simultaneous lock with defaults, terrain-staked zones per map) — this is a rules-clarification + map-authoring change, near-zero engine cost. **Gate P2 behind plan E1's placement probe:** if default-vs-adaptive placement bots show ≥3pp win delta, promote P2 with the initiative link (place-second ⇒ act-first) to neutralize seat bias. Keep P3 formations as a **UI convenience** built on P1 (suggest presets, allow edits), not as rules content.

**Engine deltas (flagged):** deployment phase state (two locked placement sets + reveal event) or UI-only if kept out of the rules core; zone-terrain map data; validation already specced; tests for simultaneous reveal and illegal-zone rejection.

### 2.4 Adopted design (decision, 2026-10-19) — edge-row secret deployment, random side

Supersedes the open choice above: **P1 in a specific single-row form, with randomized sides** was picked as the direction to spec. Precise rules:

1. **Sides:** at game start, a random roll assigns **north (row 0)** and **south (row 6)** to the two players. Not chosen. (If maps ever become systematically asymmetric, upgrade to "coin winner chooses side" — flagged, not now.)
2. **Zones:** each team deploys **only on its single edge row** — north team on row 0, south team on row 6. This **replaces spec v2 §4.2's two-row zones** (rows 0–1 / 5–6); rows 1–5 are all neutral no-man's-land.
3. **Placement:** three distinct legal tiles anywhere in your edge row — **lateral position is free**. No blocking terrain, no stacking (same constraints as today; only the zone row list changes).
4. **Secrecy:** both players place **simultaneously and hidden**; deployment is revealed only when both sides are locked.
5. **Sequence (recommended):** side roll → secret placement (both lock) → **deployment reveal** → round-1 draw + face-down assignment (card + facing) → play. Reveal *before* round-1 assignment so facing and first-card choices are **informed reads** of where the enemy actually stood, not blind guesses.

**Consequences accepted / intended:**

- **The deployment decision is purely lateral.** Depth choice (front row vs back row) is deliberately gone: all three characters start equidistant from the enemy. What's left is spacing — an adjacent triple eats lateral AoE (Combustion Blast, centered hits), while max spread (columns 0/3/6) gives up lane commitments. ~35 combinations per side before terrain.
- **Row-shared vulnerability:** your whole team shares one row, so row-wide lines (Earth Sweep, Fire Sweep, Gust Wave) and any effect spanning a row become automatically efficient — column spacing is the counter-decision. Added to plan audit §3.5.
- **First contact comes one row later** than the old front-row start (min Manhattan 12 vs 10) → first damage lands later and round-1 KO risk drops (aligns with plan §2.1's round-1 KO band; watch `firstDamageRound`).
- **Edge terrain = the stakes knob (P4):** cover/water on edge rows makes lateral choices matter more; map validation must guarantee **≥3 non-blocking tiles per edge row** or deployment can be illegal — add as a map-audit fail condition (plan §3.5).
- **Independent of initiative:** the side roll stays a *separate* roll from start-initiative — one roll must never stack two first-mover advantages (plan §2.1 first-activation band, §3 O1). Linking them is an open question (§ below).

**Engine/spec deltas (flagged, not implemented):**

- `DEPLOYMENT_ROWS[ti]` (`state.ts:112`) becomes single rows `[0]` / `[6]`, and team index no longer implies a fixed zone — GameState gains a seeded **side mapping** (playerId → north/south), rolled via `state.rng` for replay determinism.
- Spec v2 §4.2 rewrite (single edge rows + random side + simultaneous secret lock); fix the §3 "7 columns × 5 rows" typo in the same pass.
- UI: secret lock/reveal step for both sides (today's defaults become a "confirm suggested columns" shortcut), clear "P1: north/south" indicator; hot-seat camera stays fixed — the *players* swap sides, not the screen.
- Arrival direction sets flavor arrows and a default facing suggestion; facing itself remains a per-round secret chosen at assignment (v0.3), now informed by the revealed deployment.
- Tests: deployment zone cases in `grid.test.ts` (rows 5–6 assertions change), side-roll determinism by seed, ≥3-legal-tiles guard, simultaneous-reveal ordering.
- Probe: plan **E1** compares a default-placement bot vs an adaptive-lateral bot — if their win delta is ≥3pp, lateral placement is a real decision worth deepening (P2 draft remains the escalation path).

**Status (2026-10-19): engine + spec deltas implemented.** `GameState` carries the seeded side mapping (`northPlayerId`), deployment is single edge rows per side (`DEPLOYMENT_ZONE_ROWS` = north 0 / south 6), `rollNorthPlayerId` rolls sides from the match seed for replay determinism, and `createInitialState` validates positions against the assigned side; spec v2 §3/§4.2 rewritten in the same pass. Still open (unchanged, flagged): UI secret lock/reveal step (no interactive placement picker yet), arrival-direction facing suggestions, the ≥3-free-tiles map audit (spec/docs-only until terrain attaches after match creation — recorded in plan §3.5), and plan probe E1.

---

## §3 Determining order of play

### 3.1 Current state (verified in code)

- `initiativePlayerId` is **hardcoded "p1"** at game creation (`state.ts:142`) — player one always has round-1 initiative, every game.
- Initiative **flips every round** (`turns.ts:216`, in `endRound`).
- Within a round, alternation is **UI-enforced only**: `App.tsx:714–718` switches `actingSide` after each activation and stays on the current side when the other has no pending activations (so the side with more living characters takes consecutive acts at the end). Manual P1/P2 override buttons exist (hot-seat).
- **The rules engine does not enforce order:** `canActivate` (`turns.ts:145`) checks only "living and not yet activated" — never which player may act.
- Spec-level: v0.3 says "alternate one living character at a time (initiative swaps each round)" but never specifies the **unequal-living-counts** case, and never says how round-1 initiative is decided.

**Diagnosis:** three problems — (a) seat bias is baked in (p1 always first), (b) a core turn rule lives in the view layer, so any headless balance harness (plan §4) would measure an unenforced game, (c) with unequal teams the order rule is unwritten, and it matters: the losing side both has fewer activations *and* (as written in the UI) acts consecutively only after the opponent exhausts — a double swing that needs an explicit, tested decision.

### 3.2 Design goals

1. **No baked-in seat bias** (or a compensated, chosen one).
2. **Order becomes a skill surface**, not background noise — a player should be able to *play for* initiative at some level.
3. Enforcement lives in the **rules engine** (UI displays; engine decides).
4. Written and tested for the 3v2 / 3v1 / 2v1 cases.
5. Hot-seat readable: one glance shows whose turn it is.

### 3.3 Options

- **O1 — Randomized start, strict alternation (must-do baseline).** Coin-flip/rng `initiativeStart` per game; alternation as today. *Pros:* one-line fix for (a); preserves the symmetric structure that already balances across 10 rounds (5 firsts each if it started even — with random start, each player is first in 5 of 10 rounds only if parity holds; deaths shift this, which is why P6 measures it). *Cons:* still leaves first-activation as an uncompensated edge if it proves >57% (plan §2.1). **Delta:** `state.ts` init + rng seed; test both branches.
- **O2 — Choice with compensation.** Roll a coin; winner **chooses** first activation or **second activation + compensation** (opens round 1 with 5 team Energy instead of 4, or +1 chi bank). Classic first-player-advantage compensation; makes the value of tempo an explicit, tunable number. *Pros:* zero hidden info, choice = decision, knob = directly A/B-able in harness E4/P6. *Cons:* one more pre-game step; compensation size will be wrong at first (that's fine — it's a lever). **Delta:** setup action + energy/chi modifier + tests.
- **O3 — Initiative as a contested resource (flagship v0.4 candidate).** Add `initiativeNextRound`: certain successes — landing a Reaction (e.g., Redirect Lightning), breaking a Bind, winning an Agni-Kai-style exchange — **steal next round's initiative**. *Pros:* turns order-of-play into an earned payoff and deepens the reaction/facing system you already built; creates a genuine "was that worth giving up initiative?" decision every round; rich counterplay (don't trigger their reaction if it steals tempo). *Cons:* largest delta of the three (effect type + display + interaction with the round-flip rule); risk that reaction cards double-dip (defense *and* tempo — price accordingly); needs plan P3's deterrence probe.
- **O4 — Secret activation queue.** At round start, each team secretly orders its own characters' activations (extends the face-down assignment fantasy). *Pros:* planning depth; punishes autopilot. *Cons:* bookkeeping for hot-seat, and with alternation the *team* order matters less than *who acts first/last* — half the depth for real cost. Park it.
- **O5 — Player-controlled pass/hold priority.** *Reject for prototype:* extra state, slow, and hot-seat already strains attention.

**Sub-decision — unequal living counts (must be written regardless of choice):** when one side is exhausted, the side with more living characters takes its remaining activations **consecutively** (matches current UI behavior) — *unless* we adopt the opposite: give the **trailing** side the consecutive acts as a comeback valve. Recommend: keep consecutive-acts for the *leading* side (it is the reward for having more characters — parity of KOs) and compensate the trailing side through chi instead (§1 option C4), rather than muddying two comeback systems at once. Codify whichever we choose in the engine.

### §3 Recommendation

1. **Now:** adopt **O1** (randomized start) **and move enforcement into the rules engine** — engine computes the legal acting player from `initiativePlayerId` + alternating sequence + living counts; UI renders it; `canActivate` gains the player/order check. This is a **pre-req for the whole balance plan** (plan §4.1) and fixes the unequal-counts gap.
2. **Immediately after:** A/B **O2's compensation** in the harness (paired seeds, plan §7); keep it only if first-activation lands >55% without it or if the choice proves fun (human telemetry, plan §5).
3. **v0.4 flagship:** prototype **O3** — it converts "order of play" from setup bookkeeping into an expression of skill, which is what the third brief item deserves. Prototype on 2–3 cards first (Redirect Lightning gaining initiative is already lore-perfect: Iroh's whole teaching was *reading the opponent's move and answering first*).

**Engine deltas (flagged):** `initiativeStart` in state init; order-enforcement function + `canActivate` change + tests (incl. 3v2/3v1); setup flow for O2; optional `initiativeNextRound` field + effect type for O3; log lines for plan JSONL.

---

## §4 One action per activation (decision, 2026-10-19) — one card, basic-action floor

Rule clarification, adopted and implemented (commit `db956bf`; spec v2 §8
Phase 3, docs/rules.md "On your activation"):

1. **One card per activation.** A character plays exactly the one card
   assigned to it — reassigning after a play cannot unlock a second play
   (rejected with `TECHNIQUE_SPENT`). Unplayed cards are discarded/banked
   for chi as before (pass scraps the assigned card; end-of-round
   auto-scrap/auto-bank). The play is spent even on a fizzle (card paid and
   discarded).
2. **Basic actions (cardless floor).** A character with no assigned card is
   never a wasted activation: it may use one very weak free basic action —
   **basic attack** (orthogonally adjacent enemy, 1 damage, no evade
   reaction) or **basic defense** (self shield 1 until next round). One per
   activation, sharing the action slot.

**Implementation:** the shared slot is `techniqueBlockedThisActivation` —
set on card commit, on Avatar State activation, and on either basic action
(`rules/basics.ts`, actions `BASIC_ATTACK`/`BASIC_DEFENSE`). UI shows
"Basic attack / Basic shield" for cardless, unspent characters.

**Consequences accepted / intended:**

- **Anti-dead-turn valve.** The free adjacent strike puts a ~1-damage floor
  under every activation, so boards stall less; real cards must stay
  strictly stronger per cost or they are outclassed by a free action.
- **Brace economy watch.** Shield 1 per activation is deliberately minimal,
  but per-round brace stacking could grind matches longer — watch round
  reached and damage-per-activation metrics (plan §2.1); if brace meta
  emerges, gate the basic defense or decay shields (plan §3.5).
- **AI follow-up (flagged, not implemented):** bots currently pass when the
  slot is spent and never evaluate basic actions — worth a E-harness probe
  later; not a correctness issue (pass is always legal).

---

## Open questions (deliberately deferred)

1. Does placement-draft order link to initiative (P2 place-second ⇒ act-first), or does each area carry its own mitigation?
2. O2 compensation currency: Energy round-1 vs chi bank — which reads clearer to a first-time player?
3. O3 initiative-steal: does it stack (max one steal per round)? Presumably yes — cap at one to avoid initiative ping-pong.
4. §1 C4 (underdog chi) and §3 consecutive-acts are *two* comeback systems — ship at most one, measure both in E4 before choosing.
5. Should round-1 facing (secret, assigned pre-battle) interact with placement reveal? Deferred until placement settles.
