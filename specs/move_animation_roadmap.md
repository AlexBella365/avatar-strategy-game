# Move Animation Roadmap

**Status:** active implementation. **Design target:** subtle, tactical motion that clarifies targeting and displacement, with a light elemental flavor. Effects are reusable by move shape; card-specific tuning comes later.

## Principles

- Show the actual origin, route, target area, and resolved destination when those are known.
- Keep the board and combat text readable. Prefer thin trails, soft rings, tile pulses, and short afterimages over full-screen flashes or large particles.
- Share shape animations across cards. Element changes color and surface treatment, not the movement grammar.
- Let duration follow the action: quick contact for a single target, travel time for a path, and a slightly longer cue for area or forced movement.
- Keep rules resolution authoritative and immediate. Effects are presentation only and never delay or change a game action.
- Respect `prefers-reduced-motion`; preserve static target/result cues when motion is reduced.

## Shape vocabulary

| Shape | Visual grammar | Initial timing target |
|---|---|---:|
| Projectile | Origin-to-target trace and a small traveling element mark; brief impact at endpoint | 300–520 ms |
| Line | Ordered path trace from source outward, then one restrained pulse across affected tiles | 360–600 ms |
| Area | Soft boundary/ring at the selected center; affected tiles pulse together or center-out | 400–650 ms |
| Push / pull | Directional trail from the displaced character's old tile to its resolved tile | 300–500 ms |
| Dash / leap | Short route trace and fading afterimage from old position to new position | 260–440 ms |
| Shield / block | Thin guard arc at contact, with a brief held highlight if damage is prevented | 220–420 ms |
| Heal / restore | Small rising pulse and soft recipient glow | 320–520 ms |
| Status / setup | Compact icon or aura anchored to the affected character or tile | 300–550 ms |

Durations are starting ranges, not a promise that an effect must fill the full interval. Per-shape timing will live in `src/ui/animationTiming.ts` and be tuned after visual review.

## Delivery plan

1. **Animation event model:** carry shape, element, source, endpoint, path, affected tiles, and sequence id into the board overlay. Derive it from before/after game state; do not infer a hit from card names.
2. **First playable set:** implement projectile, line, area, push/pull, and dash/leap with shared SVG path cues and existing per-tile impact effects.
3. **Support set:** add shield/block and heal/restore feedback; distinguish successful prevention from an ordinary shield grant where the engine outcome allows it.
4. **Status/setup set:** add concise cues for status changes and terrain creation, anchored to resolved targets.
5. **Review and tune:** inspect desktop and narrow layouts, confirm path alignment on the 7×7 board, tune per-shape/per-element timings, and reduce visual overlap when effects stack.
6. **Complexity gate:** keep paths and low-count marks in the current DOM/SVG overlay. Add a canvas layer only if later work needs many particles, curved motion, or performance that SVG cannot meet. No WebGL dependency is planned.

## Implementation log

### 2026-11-04 — Roadmap and first implementation

- Recorded the move-shape vocabulary, visual constraints, timing targets, sequencing, and the SVG-to-canvas complexity gate.
- Added a board-coordinate SVG path layer for projectile, line, area, displacement, and dash cues; element tint is shared with the existing per-tile impact effects.
- Connected resolved PLAY_CARD, BASIC_ATTACK, and MOVE actions to the animation event builder. Push/pull vectors use before/after target positions; normal actions keep game-state resolution immediate.
- Added per-shape timings and reduced-motion behavior. SVG keeps the implementation lightweight; no canvas dependency is needed for this first set.
- Review status: implementation is ready for visual playtesting. Automated tests were not run in this pass.
