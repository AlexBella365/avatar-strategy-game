# Project Log & Roadmap

Development history, completed milestones, measured snapshots, and open work for
the Avatar Tactical Card Game prototype. The README keeps only the current
overview and quick start; this file is the long-form record.

## Status snapshot

- **Engine:** deterministic 3v3 hot-seat on a 7×7 grid, driven by
  `applyGameAction(state, action)`.
- **Match rule:** play continues until one team is fully knocked out; reaching
  round 30 is a draw, with no health-share tiebreaker.
- **Roster:** 20 playable fighters plus Appa, Momo, Naga, and Pabu as companions.
  Non-benders (Sokka, Suki, Ty Lee, Mai, Asami) are first-class picks.
- **Avatar State:** shared by Avatar characters (currently Aang and Korra).
- **AI:** Track A utility opponent by default; optional local-LLM stance advisor
  (Track B, Mode 1) behind `VITE_AI_LLM=1`.
- **Verification:** `npm run typecheck` clean; 271 tests passed, 5 skipped.

### Latest balance snapshot

Committed in `specs/balance_sweep_baseline.txt`, Track A policy, n=100 per cell:

| Matchup | Result | KO finish | Round-cap draws |
|---|---|---|---|
| Shipped — heroes vs villains | heroes 42% / villains 58% | 96% | 0% |
| Mirror heroes | 53 / 47 | 89% | 0% |
| Mirror villains | 49 / 51 | 100% | 0% |

Average match length is 8.3–11.0 rounds, so the 30-round cap is a safety net
rather than a normal ending. Full interpretation:
`specs/balance_testing_plan.md` §10.

## Completed milestones

1. ✅ **Types + state** — grid coordinates, deployment, occupancy.
2. ✅ **Pure geometry** — bounds, Manhattan distance, line of sight, paths, AoE shapes.
3. ✅ **Movement + terrain** — normal moves, Evade, push/pull/swap, entry and expiry.
4. ✅ **Card resolution** — focused/tile/directional/AoE targeting, reactions, statuses.
5. ✅ **Round loop + victory + Avatar State** — Resonance buildup, activation, risk.
6. ✅ **v0.3 economy** — chi bank, draw/assign/scrap, restrictions, slots, gear.
7. ✅ **Starter content + hot-seat UI** — core six, 18 cards, versus draft, pucks,
   character sheets, hands, legend, card-fit hints, e2e coverage.
8. ✅ **Demo tooling** — Auto P1/P2 toggles, UI smoke test, auto-vs-auto match sim.
9. ✅ **Demo visuals** — painterly terrain tiles and connected roads, redesigned
   pucks, terrain legend, CSS-variable theme.
10. ✅ **Combat feedback** — per-element attack FX (fire/water/air/earth/slash) and
    floating damage/heal numbers in a board overlay so tiles do not clip them.
11. ✅ **Card presentation** — 5:7 faces with verbatim rules text, gear/ability
    sheet slots with hidden card backs, balanced P1/P2 columns, hand under the
    owner's sheets.
12. ✅ **NPC opponent** — Track A utility AI in `src/game/ai/`, no dependencies;
    `src/game/auto.ts` drives automated matches.
13. ✅ **Lethality + roster-parity + match-length pass** — shipped tuning is data
    in `src/game/content/balance.ts`: movement 2, HP ×0.58, deployment rows 1/5,
    damage ×1.75. The villain lineup is the lore trio Zuko, Azula, Ozai; Sokka is
    a hero. Full results: `specs/balance_testing_plan.md` §10.

## Open work

| Priority | Item | Notes |
|---|---|---|
| 1 | **NPC AI debug overlay** | Finish Track A M2 by surfacing existing decision traces in the UI; see `specs/npc_ai_plan.md` §A.6–A.7. |
| 2 | **Balance hardening** | Re-baseline at n≥200, investigate the villain mirror's burst (8% cap-reach), then run the counterplay/efficiency audits in `specs/balance_testing_plan.md` §3 under the tuned numbers. |
| 3 | **End-to-end polish** | Roster is at 20 fighters; mechanical passives are still descriptive only. |
| 4 | **Experimental LLM advisor (Track B, Mode 1)** | Off by default (`VITE_AI_LLM=1` to enable); evaluation against Track A is pending. Mode 2 (LLM top-k choice) remains deferred; see `specs/npc_ai_plan.md` §3–5. |

## Design references

- Player-facing rules: `docs/rules.md`
- Engine / card specs: `specs/avatar_tactical_card_game_spec_v2.md` and the
  v0.3 amendment
- Roster: `specs/avatar_character_roster_v2.md`
- Cards: `specs/card_roster.md`
- Balance method and measured results: `specs/balance_testing_plan.md`
- NPC AI plan: `specs/npc_ai_plan.md`
