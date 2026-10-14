# Avatar Tactical Card Game — Prototype (MVP v0.1)

> **Unofficial fan project.** This is a non-commercial prototype made by fans, for
> learning and playtesting only. It is not affiliated with, endorsed by, or connected
> to Nickelodeon, Avatar Studios, or any rights holders. All code, rules text, and
> game design here are original. Please do not use this project commercially.

A lightweight 3v3 tactical card-game prototype inspired by the Avatar universe
(ATLA + LOK). The goal is a playable, deterministic rules engine with a minimal
test UI — mechanics first, visuals later.

## Tech stack

- **Vite + React + TypeScript (strict)** — minimal browser prototype
- **Vitest** (`npm test` / `make test`) — deterministic rules tests, no animation timing
- **Plain CSS** — lightweight test UI, no component framework / canvas library (visuals out of scope)
- **No backend** — local hot-seat play; a single authoritative engine exposes
  `applyGameAction(state, action)` and the UI never mutates game state directly

## Layout

- `src/game/types.ts` — data shapes only
- `src/game/state.ts` — match init + immutable helpers
- `src/game/rules/` — targeting, movement, damage, statuses, terrain, cards, turns
- `src/game/content/` — characters, cards (data-driven, no hard-coded IDs in the engine)
- `src/App.tsx` — board (3 lanes × front/rear), hands (next), battle log

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

A 25-character fan pool across five classes (Water / Earth / Fire / Air / Non-bending,
5 each), drawing on characters from both animated series. The MVP starts with a core
six: Aang, Katara, Toph, Zuko, Sokka, Azula. Aang is currently the only Avatar
State–capable character; Resonance buildup, activation cost, duration, and the
active-Avatar instant-loss rule live in the shared engine, not in card data.

## Roadmap

1. ✅ Types + state skeleton
2. ⬜ Pure rules functions (adjacency, movement, targeting)
3. ⬜ Card resolution (single-target, AoE, reactions, terrain, statuses)
4. ⬜ Round loop + victory
5. ⬜ Minimal UI interactions
6. ⬜ 6 characters + 12 cards complete data
7. ⬜ Full test suite (core rules, Avatar State, end-to-end determinism)
