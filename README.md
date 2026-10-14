# Avatar Tactical Card Game — Prototype (MVP v0.1)

Fan prototype inspired by Avatar: The Last Airbender. Original code/data, no affiliation.
Full rules: `specs/avatar_tactical_card_game_spec.md`.
Character pool: `specs/avatar_character_roster.md`.

## Tech stack

- **Vite + React + TypeScript (strict)** — minimal browser prototype per spec §20.3
- **Vitest** (`npm test` / `make test`) — deterministic rules tests, no animation timing
- **Plain CSS** — lightweight test UI, no component framework / no Pixi (visuals out of scope)
- **No backend** — local hot-seat state; single authoritative engine `applyGameAction(state, action)`

## Layout (spec §15)

- `src/game/types.ts` — data shapes only
- `src/game/state.ts` — init + immutable helpers
- `src/game/rules/` — targeting, movement, damage, statuses, terrain, cards, turns
- `src/game/content/` — characters, cards
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

25-character pool across five classes (Water / Earth / Fire / Air / Non-bending, 5 each),
drawn from ATLA + LOK — see `specs/avatar_character_roster.md`.
MVP starts with the core six: Aang, Katara, Toph, Zuko, Sokka, Azula.
Aang is currently the only Avatar State–capable character; Resonance/activation/duration
and the active-Avatar instant-loss rule live in the shared engine, not in card data.

## Roadmap (spec §18)

1. ✅ Types + state skeleton
2. ⬜ Pure rules fns (adjacency, movement, targeting)
3. ⬜ Card resolution (single-target, AoE, reactions, terrain, statuses)
4. ⬜ Round loop + victory
5. ⬜ Minimal UI interactions
6. ⬜ 6 characters + 12 cards complete data
7. ⬜ Full test suite (§17) + Avatar State tests (§12A.9)
