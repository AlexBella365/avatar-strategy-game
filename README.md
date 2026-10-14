# Avatar Tactical Card Game — Prototype (MVP v0.3)

> **Unofficial fan project.** This is a non-commercial prototype made by fans, for
> learning and playtesting only. It is not affiliated with, endorsed by, or connected
> to Nickelodeon, Avatar Studios, or any rights holders. All code, rules text, and
> game design here are original. Please do not use this project commercially.

A lightweight 3v3 tactical card-game prototype inspired by the Avatar universe
(ATLA + LOK). The goal is a playable, deterministic rules engine with a minimal
test UI — mechanics first, visuals later.

Player-facing rules live in `docs/rules.md`. Engine spec: local `specs/` (not pushed).

## Tech stack

- **Vite + React + TypeScript (strict)** — minimal browser prototype
- **Vitest** (`npm test` / `make test`) — deterministic rules tests, no animation timing
- **Plain CSS** — lightweight test UI, no component framework / canvas library (visuals out of scope)
- **No backend** — local hot-seat play; a single authoritative engine exposes
  `applyGameAction(state, action)` and the UI never mutates game state directly

## Layout

- `src/game/types.ts` — data shapes only (7×7 grid model + v0.3 economy)
- `src/game/state.ts` — match init, deployment validation, seeded decks, occupancy helpers
- `src/game/rules/` — grid, movement, damage, statuses, terrain, cards, turns, avatar, economy
- `src/game/content/` — characters, cards, terrain, economy tuning (single source of truth)
- `src/App.tsx` + `src/ui/` — hot-seat UI: grid board, hands with assign/scrap, activation panel, battle log, icon legend

## Run

With Make:

```sh
make install
make dev        # UI prototype
make test       # rules tests
make typecheck
make build
```

Or directly with npm (`npm install`, `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`).
Run `make help` for all targets.

## Roster

A 30-character fan pool across five classes (Water / Earth / Fire / Air / Non-bending),
drawing on characters from both animated series, with series/role/class metadata for
alignment restrictions. The demo drafts 10 fighters (core six + Iroh, Ozai, Suki,
Ty Lee); Appa and Momo are flagged companions, not fighters. Aang is currently
the only Avatar State–capable character; Resonance buildup, activation cost,
duration, and the active-Avatar instant-loss rule live in the shared engine, not in card data.

## Cards (18)

12 starter techniques + 2 signature gear (Glider, Boomerang) + Comet Strike bomb +
3 universal cards anyone can take: **Travel Rations** (food = healing),
**Smoke Bomb** (shield + Focus), **Dust Toss** (chip + Exposed). Every character
fits at least 6 cards; the hand list shows each card's requirement and who fits.

## Roadmap (grid model + v0.3 economy)

1. ✅ Types + state (grid coords, deployment, occupancy)
2. ✅ Pure geometry (bounds, Manhattan, LOS, paths, AoE shapes)
3. ✅ Movement + terrain (normal moves, Evade, push/pull/swap, entry/expiry)
4. ✅ Card resolution (focused/tile/directional/AoE, reactions, statuses)
5. ✅ Round loop + victory + Avatar State (resonance, activation, risk)
6. ✅ v0.3 economy (chi bank, draw/assign/scrap, restrictions, slots, gear)
7. ✅ Starter content (core six + 18 complete cards) + playable hot-seat UI (versus draft, pucks, sheets, playing cards, legend, fits, e2e)
8. ✅ Demo tooling (Auto P1/P2 test toggles, UI smoke test, auto-vs-auto match sim)
9. ⬜ End-to-end polish (passives, real AI opponent, animations, roster waves)
