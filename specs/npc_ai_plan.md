# NPC AI Plan — Track A: Utility AI (active) + Track B: LLM Layer (roadmap)

**Status:** working plan, non-normative. Branch: `feature/npc-ai`. Based on the preliminary research in `specs/ai_setup_research.md` (utility AI vs. behavior trees vs. GOAP) adapted to *this* codebase.
**Scope:** **Track A (§2) is the active work** — a self-contained, zero-dependency utility policy. **Track B (§3) is a roadmap stub**: designed enough to keep the seams honest, not scheduled, and deletable without touching the engine.

---

## 0. What already exists (integration seams)

The game is closer to an AI-ready state than it looks. These seams are fixed constraints on the design:

| Seam | Location | What it gives us |
|---|---|---|
| Single action entry point | `applyGameAction(state, action)` in `src/game/rules/cards.ts` | Clones state, validates, resolves. **The AI only ever proposes a `GameAction`; the engine is the authority.** |
| AI placeholder | `chooseAutoAction(state, playerId, random)` in `src/game/auto.ts` | Returns one authorized action or `null`. Its header says *"A real AI policy lands later"* — this is the function we replace the insides of. Same signature = App.tsx loop unchanged. |
| Turn loop | `useEffect` auto loop in `src/App.tsx` (~L256) | Drives auto sides with a 500 ms tick, falls back to `PASS_ACTIVATION` on validation errors. Already async-friendly for Track B. |
| Candidate helpers | `getLegalTargets`, `reachableTiles`, `movementAllowance`, `blockingTiles`, `difficultTiles`, `terrainAt`, `hasLineOfSight`, `hasStatus` | Legal-move/legaltarget enumeration is done; the AI scores what these return. |
| Outcome math | `calculateDamage`, `rawDamage`, `attackVsEvasion` in `rules/damage.ts` | Expected-damage scoring uses the *engine's own* formulas — no shadow arithmetic. |
| Determinism | `cloneState` + `nextRandom` (mulberry32, `state.rng`) | Pure simulation is one `structuredClone` away; seeded tie-breaks make every match replayable. |
| Test harness | `src/game/rules/auto.test.ts` (full auto-vs-auto match) | The invariant test every new policy must keep passing. |

Game-shape facts that matter for scoring: activation = *assign a face-down card → optional move (MP pool) → optional technique play → pass*; per-side 4 energy/round, focus 0–4, chi bank, cover/hazard terrain, heal-over-time regeneration, Avatar State risk/reward, round-10 tiebreakers.

## 1. Design principles (non-negotiable)

1. **Propose, never resolve.** The AI emits `GameAction`s through `applyGameAction`. If an action is rejected, the policy falls back (existing pass-on-error behavior) — we never bypass validation.
2. **Pure simulation.** Scoring reads `cloneState(...)` copies; zero mutation of live state. Debug overlay and replay come free.
3. **Deterministic by default.** All randomness flows through the seeded `random` parameter already in `chooseAutoAction`'s signature. Same seed + same state ⇒ same decisions. Track B must restore this property (see §B.5).
4. **Scores normalized ≈ 0–1**, weights interpretable (the tuning workflow in the research doc depends on it).
5. **One policy codebase, many personalities** — behavior differences are weight vectors, not branches.
6. **No new runtime dependencies for Track A.** Track B adds *none* either: the LLM client is a `fetch` wrapper (repo currently depends only on React).
7. **The engine stays LLM-free.** An LLM never produces a raw `GameAction` that reaches `applyGameAction` without passing the same legal-set filter a human click passes (§B.3).

---

## 2. Track A — Utility AI, zero LLM (the baseline; ships alone)

**Status:** **A1 + A2 implemented** (milestones M1/M2, engine side). A3/A4 pending; the debug *overlay UI* is the one remaining M2 item (the trace data + ring buffer already ship). See §A.7.

### A.1 File layout

```
src/game/ai/
  types.ts            // Weights, PersonalityId, Scored<T>, DecisionTrace, ChooseAiOptions
  scoring.ts          // candidate scoring: position/threat/cover + simulation-backed play
  personalities.ts    // BASE_WEIGHTS + archetype deltas + character -> archetype map
  policy.ts           // chooseAiAction(state, playerId, opts) -> { action, trace }; step logic
  traceLog.ts         // DecisionTrace ring buffer (cap 200) for the debug overlay
  policy.test.ts      // scripted scenarios (§A.8)
```

Candidate generation and trace construction live in `policy.ts` (the board is 7×7; a separate
`candidates.ts` would be indirection without benefit). `Scored<T>` in `types.ts` carries the
per-component breakdown that the overlay renders.

`src/game/auto.ts` keeps its public signature (`chooseAutoAction`, `evadeEscapes`) but delegates to
`src/game/ai/policy.ts`; it also exposes `chooseAutoActionTraced` for the overlay. The old random
heuristics are gone — the policy replaces them wholesale.

### A.2 Candidate generation (`candidates.ts`)

Enumerate *macro-actions for the current activation step*, reusing engine helpers so everything is legal by construction:

| Step | Candidates | Source helper |
|---|---|---|
| Assign | each `teamHand` card whose restrictions pass and that fits the character's likely play | `restrictionSatisfied`, affordability mirror of `canAfford` |
| Move | every `reachableTiles(...)` entry (bounded: sample at most ~N tiles, e.g. keep only tiles that are strictly better than current on some signal) | `reachableTiles`, `movementAllowance` |
| Technique | `PLAY_CARD` × every legal `TargetSelection` from `getLegalTargets(...).filter(isLegal)` | `getLegalTargets` |
| Utility | `PASS_ACTIVATION`, `SCRAP_ASSIGNED`, `ACTIVATE_AVATAR_STATE` when eligible | engine validation |

### A.3 Scoring signals (`scoring.ts`) — mapped to this game

Each signal returns 0–1; the total is `Σ wᵢ · sᵢ`, weights from `personalities.ts`.

| Signal | Encourages | Implementation sketch |
|---|---|---|
| Expected damage | aggression | `calculateDamage` on a `cloneState` copy with `attackVsEvasion` hit chance folded in; 0 for non-damage plays |
| Net board delta | action economy | (damage dealt + shields/heals granted − incoming damage taken) over the projected state |
| Target distance | closing / kiting | `manhattan` to nearest *or* focus target |
| Incoming threat | caution | enemy reachability ∩ attack ranges covering the candidate tile (reuses `reachableTiles` per enemy, `hasLineOfSight`) |
| Cover / terrain | tactical positioning | `terrainAt(...).cover` vs. incoming attack class; hazard/`onEntryStatus`/water penalties |
| HP ratio | self-preservation | `health / maxHealth` of the projected state |
| Focus fire | coordination | damage on the enemy lowest-HP among those allies can also hit |
| Economy discipline | resource play | energy/chi/focus efficiency; save expensive cards for clustered or wounded targets |
| Status synergy | combo play | `bonusVsStatus`/`bonusIfTargetDisplaced`/water-empowered conditions evaluated as stated (never card-name checks) |
| Avatar timing | risk management | resonance vs. threshold, own HP, opponent board — Avatar State activation is instant-loss-if-KO'd, so score it as *risk × payoff*, not a flat 0.7 random |

**Simulation rule:** score *outcomes*, not intents — `simulate(state, action)` = `cloneState` + `applyGameAction` on the clone, then read the result. Errors ⇒ candidate dropped. This automatically stays correct as cards/rules change.

### A.4 Personalities (`personalities.ts`)

Weight vectors, not code branches. Initial archetypes (tuned in §A.7):

```ts
// shape only — actual weights are data, tuned via scripted scenarios
{ aggressive: {...}, cautious: {...}, sniper: {...}, berserker: {...}, support: {...} }
```

Resolution order: explicit per-instance override → character-definition archetype (e.g. `role`/element heuristics) → `default`. Balance-testable: a personality change is a one-line data diff.

### A.5 Selection

1. Score all candidates on the projected state.
2. Argmax with **seeded** tie-break.
3. Near-tie variety: uniformly among candidates within 5% of the best score (seeded `random`).
4. Emit `DecisionTrace` (`unit, step, top-5 candidates, component scores, chosen`) for the debug overlay and balance logs.

### A.6 Debug overlay & logging

- `DecisionTrace` appended to a ring buffer (cap ~200) behind a dev-only flag.
- Overlay answering *"why did the NPC do that?"*: chosen action + component breakdown, same shape as the trace table.
- Optional `?ai=trace` URL flag in dev builds.

### A.7 Phases and exit criteria (from the research hierarchy, mapped to this repo)

| Phase | Scope | Exit criteria |
|---|---|---|
| ✅ **A1 — v1** | `chooseAutoAction` delegates to the policy: candidates + approach/safety/cover signals + simulation-backed damage; seeded tie-breaks; trace plumbing | **done** — `auto.test.ts` passes unchanged; `policy.test.ts` scenarios pass; determinism test green |
| ✅ **A2 — v2** | Threat map, cover, focus fire, energy/chi economy, Avatar-timing risk scoring, archetype weight vectors | **done (logic)** — archetypes measurably differ (`personality`-weighted `scorePlay` test); remaining: debug overlay UI |
| ◻ **A3 — v3** | One-ply lookahead: for top-k candidates, simulate opponent's best reply on the clone and score the *resulting* state | no regressions on A2 scenarios; measurable survival gain in the "punish overextension" scenario |
| ◻ **A4 — v4** | Squad coordination (focus-fire agreement, no body-blocking allies) | only if A3 matches visibly lack teamwork; default = skip |

Explicitly **out of scope**: RL, MCTS, GOAP, behavior-tree libraries (research doc §"Avoid overengineering"; nothing here needs them).

### A.8 Testing strategy (Track A)

1. **Scripted scenarios** (`policy.test.ts`): each is a hand-built `GameState` + expected property (e.g. "at 3 HP vs. full-HP melee enemy, the chosen move increases distance" — property assertions, not golden actions).
2. **Determinism**: same seed ⇒ identical decision sequence; different seeds ⇒ only near-tie outcomes differ.
3. **Invariant**: full auto-vs-auto match completes with zero validation errors (extend `auto.test.ts` to N seeds × personality matchups).
4. **Balance hook**: policy-vs-policy win rates feed `specs/balance_testing_plan.md` §2 (bots are the sample generator that doc already assumes).
5. **Cost guard**: scoring must stay O(candidates × board) with the 7×7 grid — trivial, but add one timing assertion in CI (full match ≤ a few hundred ms) so future lookahead never creeps.

---

## 3. Roadmap (deferred) — Track B, lightweight LLM layer

**Status:** not scheduled. Capture-only: these notes exist so Track A's interfaces (digest, candidate list, trace, deterministic `random` seam) stay compatible if/when Track B is picked up. Nothing here is built now, and the design deliberately keeps it removable: deleting `src/game/ai/llm/` and the feature flag must leave Track A fully functional.

### B.0 Principle

**The LLM advises the utility policy; it never replaces the engine-validated action path.** Every LLM output is either (a) a *modifier* to weights/stance or (b) a *choice within the already-legal candidate set*. Invalid, late, or missing output ⇒ Track A argmax. Consequences: offline play works, cost is bounded and tunable, determinism is restorable, and deleting Track B deletes one directory.

### B.1 Mode 1 — Round-level strategy advisor *(cheapest, recommended first)*

**Granularity:** once per round per LLM-controlled side (≤ 8 calls/match).

- Serialize a compact state digest: positions, HP/focus/energy/chi, hands *as card-type summaries* (no hidden info: only what that side can see), terrain highlights, resonance.
- Prompt returns strict JSON: `{ stance: "aggressive"|"standard"|"cautious"|"turtle", focusTarget, riskTolerance, notes }`.
- Output maps to **weight deltas** on the personality vector (clamped, e.g. ±0.3) plus a stance string shown in the UI/log ("Azula is pressing the attack").
- Failure ⇒ keep previous stance (last known good, else default).

### B.2 Mode 2 — Top-k action chooser *(the "flavor" call)*

**Granularity:** at most once per technique play (the interesting decision), not per move/assign.

- Track A scores all candidates and passes the **top 5** as `{ id, label, componentScores }` + a ~1-screen state digest.
- LLM returns `{ choiceId, rationale }`; rationale is stored on the `DecisionTrace` and shown in the overlay/log — it doubles as NPC flavor text for free.
- **Hard constraints:** choice must exist in the offered set (index/id validated); anything else ⇒ argmax fallback, counted in a `llmFallbacks` metric.
- Never sent when: top-2 gap > threshold (the utility scorer is confident), flag off, timeout, or budget exhausted.

### B.3 Mode 3 — Free-form action generation → **explicitly rejected**

Letting the LLM emit a `GameAction` directly needs generation → validation → retry loops, has the highest token cost, worst latency, and adds no capability Track A/B1–B2 lack. Revisit only for scripted single-player boss moments, never for routine turns.

### B.4 The TypeScript client (`src/game/ai/llm/`)

Zero-dependency, ~150 lines, OpenAI-compatible wire format so one client covers hosted *and* local:

| File | Responsibility |
|---|---|
| `client.ts` | `postChatJSON({ messages, schema, timeoutMs })` via `fetch`; `baseUrl`/`model`/`apiKey` from `import.meta.env` (`VITE_LLM_BASE_URL`, `VITE_LLM_MODEL`, `VITE_LLM_KEY`) — works against OpenAI, Azure OpenAI, OpenRouter, or a **local Ollama/LM Studio server** (free, fully offline option) |
| `schema.ts` | tiny hand-rolled validators (no zod): `object({ stance: enum([...], ...) })` etc.; fail ⇒ fallback path |
| `strategy.ts` | Mode 1: digest builder, prompt, response → clamped weight deltas |
| `chooser.ts` | Mode 2: top-k serialization, response → candidate index, fallback wiring |
| `budget.ts` | hard caps: max calls/match, max calls/round, token ceiling, kill switch |
| `cache.ts` | `Map<stateHash + mode, response>` — repeated/identical situations cost 0 calls |
| `*.test.ts` | mock-transport tests; **no test hits the network** |

Transport rules: `AbortSignal.timeout(...)`, one retry on network error (never on parse error), `response_format: json_object` where supported, `temperature` low, `max_tokens` small (~150).

### B.5 Async integration (the one real hazard)

App.tsx's auto loop is a synchronous `useEffect` tick; an LLM call is not. Required protocol:

1. When a decision is needed: compute Track A result **immediately**, stash the live `stateHash`, set `pendingLlm` and apply the LLM request on top.
2. On response: apply **only if** `stateHash` still matches; otherwise discard silently (state moved on — stale advice is worse than no advice).
3. Hard deadline (e.g. 1.5 s): on timeout the tick proceeds with the Track A argmax; the UI never stalls on a model.
4. Determinism: with the LLM disabled (default), decisions are exactly Track-A-seeded. With it enabled, the response is recorded in a decision journal so a match can be replayed without the network (replay reads the journal instead of re-calling).

### B.6 Cost & latency budget (verify current pricing before shipping)

| Mode | Calls/match | ~Tokens (in/out) | Notes |
|---|---|---|---|
| B1 strategy | ≤ 8 | ~700 / ~80 | tiny; cheapest possible use of a model |
| B2 chooser | ≤ #technique plays | ~500 / ~60 | confidence-gap gate should cut this further |
| Local model | unbounded | 0 | Ollama/LM Studio: free + offline; quality gate per §B.8 |

Guardrails: per-match call cap (default ~12), per-round cap, total-token ceiling, and a single `LLM_ENABLED` flag — all kill-switchable at runtime.

### B.7 Testing (Track B)

- Mock transport returns valid/invalid/stale/timeout fixtures → assert fallback to argmax in every failure case.
- Budget tests: cap enforced, cache hit avoids a call.
- Staleness: response arriving after state change is discarded.
- Journal replay: a match recorded with LLM calls replays to identical states with the network off.
- All Track A tests run with the LLM disabled — the default CI configuration.

### B.8 Model selection & quality gate

- Start with the cheapest available small model on the chosen endpoint; if local, any ~7–8B instruct model.
- **Gate:** B2's choices must beat argmax on a held-out scenario suite ≥ 55% of the time, else B2 stays disabled (B1 stance flavor may ship purely cosmetically).
- Never let a model choice change engine state directly — only weights/candidate selection downstream of Track A.

---

## 4. Sequencing, flags, and definition of done

### Active — Track A

| Milestone | Content | Depends on |
|---|---|---|
| **M1** | Track A1: candidates + core scoring + trace, wired through existing `chooseAutoAction`; scenario & determinism tests | — |
| **M2** | Track A2: threat/cover/focus-fire/economy signals + personalities + debug overlay | M1 |
| **M3** | Track A3: one-ply lookahead; balance scenario suite runs policy-vs-policy | M2 |

### Roadmap (deferred) — Track B

| Milestone | Content | Depends on |
|---|---|---|
| **M4** | Track B client + Mode 1 (strategy advisor), feature-flagged off | M2 (stable digest format) |
| **M5** | Track B Mode 2 (top-k chooser) + journal replay + quality gate §B.8 | M4, M3 |

- **Flags (Track A):** currently no env flag — the utility policy *is* `chooseAutoAction` (the old random player is gone). A `VITE_AI_POLICY=random` A/B baseline is still a TODO. Track B's `VITE_AI_LLM=off` default is recorded in §3 but not implemented while Track B is deferred.
- **Definition of done for Track A (active):** phases A1–A2 green in CI, trace explains any decision (overlay is the last M2 item), personalities measurably distinct, no new runtime deps, `auto.test.ts` untouched and passing.
- **Roadmap exit criteria (Track B, deferred):** every failure path falls back cleanly, budget enforced, journal replay deterministic, quality gate recorded in §B.8.
- **Non-goals:** GOAP/planners, behavior-tree libraries, RL, per-action free-form LLM generation, any engine change required by the AI.

## 5. Open questions (to settle during M1/M2)

1. Does the AI get its own UI "side" (3rd seat) or only drive p1/p2 (today's `autoSides`)? *(Start: p1/p2 only — no UI work needed.)*
2. Should personality live on `CharacterDefinition` (data) or on a separate AI-profile table keyed by definition id? *(Leaning: separate table — keeps `types.ts` engine-facing.)* — **Resolved: separate table** (`ai/personalities.ts::PERSONALITY_BY_CHARACTER`, element fallback). Engine types untouched.
3. Reactions/Evade decisions (defender-side) are currently `reactions: []` in auto play — in scope for A2 (Evade is a scored move too) or deferred? *(Leaning: A2, since `evadeEscapes` already exists as the outcome check.)* — **Deferred to A3**: defender reactions need the opponent's reply simulation, which is exactly A3's lookahead.
4. For Track B: hosted vs. local endpoint for development? *(Leaning: local Ollama for dev, hosted for the shipped default-off flag.)*

## 6. Observations from the first implementation pass (M1/M2)

Findings from 20 seeded policy-vs-policy matches (`setup()` rosters). These are **not AI bugs**; they are inputs to the balance plan:

- **Matches run to the round limit and are decided on tiebreakers.** With movement = 1 tile/activation and 4 energy/round, a 14–18 HP roster is hard to deplete inside the limit. This is engine pacing, not passivity. *Attempted fix (round cap 8→10 + slower/weaker healing) did **not** resolve it:* a fresh n=100 harness run (`balance_testing_plan.md` §10) still shows **100% cap-reach, 0% KO finishes**, first KO ≈ round 7. Lethality (damage/HP ratio + engagement speed), not the round count, is the lever.
- **Seat is fine; the roster matchup is not.** First-activation win rate is 38–52% (CIs include 50%) — no systematic p1/north win. But the shipped cross-roster matchup is now **villains 100% vs heroes** (n=100): the one-card-per-activation + cardless basic-action engine change (`db956bf`) appears to have flipped hero/villain dominance. Roster/`balance_testing_plan.md` issue, not policy; tracked in §10.5 there.
- **Healing is inert in AI play.** ~3–5 instant HP + ~2–3 regeneration HP per match; the new spike-heal cards are played ~0.1×/match. The policy rarely chooses heals, so the heal-model rebalance is not exercised by self-play (see `balance_testing_plan.md` §10.5 item 5).
- **Focus fire works.** Damage consistently collapses one enemy (azula commonly ends at 3–4 HP), confirming the `focusFire` signal reaches target selection.
- **Open for A3:** the AI cannot *finish* a wounded-but-out-of-range target, and never retreats a low-HP ally out of enemy range — both want one-ply lookahead.
