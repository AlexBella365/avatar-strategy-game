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

- `src/game/types.ts` — data shapes only (7×5 grid model)
- `src/game/state.ts` — match init, deployment validation, occupancy helpers
- `src/game/rules/` — grid geometry, movement, damage, statuses, terrain, cards, turns
- `src/game/content/` — characters, cards (data-driven, no hard-coded IDs in the engine)
- `src/App.tsx` — 7×5 grid board, hands (next), battle log

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

## Roadmap (grid model)

1. ✅ Types + state (grid coords, deployment, occupancy)
2. ✅ Pure geometry (bounds, Manhattan, LOS, paths, AoE shapes)
3. ✅ Movement + terrain (normal moves, Evade, push/pull/swap, entry/expiry)
4. ✅ Card resolution (focused/tile/directional/AoE, reactions, statuses)
5. ⬜ Round loop + victory
6. ⬜ Minimal UI interactions (movement/path previews, target previews)
7. ⬜ 6 characters + 12 cards complete data
8. ⬜ Full test suite (geometry, movement, terrain, reactions, Avatar State, end-to-end)
