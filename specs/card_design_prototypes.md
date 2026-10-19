# Card Design Prototypes — Art-Forward Layouts

**Status:** Design spec for future implementation. Non-normative for engine rules.
**Sources:** `specs/avatar_tactical_card_game_spec_v2.md` (§§6,9,10,13,14), `specs/avatar_tactical_card_game_spec_v0.3_amendment.md` (economy, facing, talents, companions), `docs/rules.md`, `src/game/types.ts` (`CardDefinition`, `CharacterDefinition`), `src/game/content/cards.ts`, `src/game/content/economy.ts`, `src/ui/PlayingCard.tsx`.
**Scope:** layouts and visual design only — *which* cards exist and their full data live in `specs/card_roster.md` (existing 21-card pool, Water Shoes, Rocket Flight, and the ~20-per-type expansion pools).

## 0. Goals & constraints

1. Propose several technique-card layouts that carry **all** rules-necessary elements (see §1).
2. At least two prototypes must leave **large, dedicated space for card art** (~40–50% of card face) so future illustration can be dropped in without re-layout.
3. All prototypes must map 1:1 to existing data fields — no new engine data required.
4. Layouts must work in the current UI shell (`src/ui/PlayingCard.tsx` + `PlayingCard.css` hand row: cards flex to share the hand width, up to ~150px each, ~168px min-height) and scale to print (poker 63×88mm).

## 1. Required elements inventory

Every technique card MUST display (source in parens):

- **Name** (`CardDefinition.name`, e.g. `Rising Flame`).
- **Element suit + color** (`element`: air/water/earth/fire/nonbender; Aang/avatar reads as Air per `src/ui/elements.ts`). Colors from `src/theme.css` — never color-only, always with icon + label (§14).
- **Kind + type + tags** (`economy.kind`: gear/attack/defense; `cardType`: attack/defense/support/reaction; `tags`: Melee/Ranged/AoE/Displace/Guard/etc.).
- **Costs:** Energy ⚡ (`energyCost`, team-shared, refresh 4/rnd) + Focus (`focusCost`, per-character 0–4) + Chi cost 💠 (`economy.chiCost`, spendable team bank) + Chi bank value ⇪ (`economy.value` 1–3, gained on bank/scrap).
- **Targeting strip** (`targeting`): kind (`self` / `character` / `tile` / `direction` / `area`) + allegiance (`enemies/allies/all/selfAndAllies`) + range (`melee` / N / `any`) + shape params (`plus` / `line` / `radiusManhattan` / `sourceAndAdjacent` / etc. + `radius`/`maxLength`/`maxRange`) + LOS note + legality notes (`allowsOccupiedTile`, `includeBlocker`).
- **Rules text — the full explanation** (`rulesText` + `effects[]`): damage/heal/shield amounts, statuses (`OffBalance`/`Exposed`/`Bound`/`Exhausted` + `duration`), push/pull steps, terrain (`terrainId` + `durationRounds` + `replacementPolicy`), conditionals (`bonusVsStatus`, `bonusIfTargetDisplaced`, `waterEmpoweredBonus`, `requiresTargetStatus`), `gainFocus`, `gearBonus` (persistent while equipped). **This is player-facing explanation text and must be printed verbatim on every card — never abbreviated to icons or fragments.**
- **Footer — Fits / restrictions** (`economy.restrictions`: `unique`/`element`/`alignment`/`team` + `slotType`: gear/attack/defense, caps 2/2/2 within M=4 total).
- **Gates & flags (when present):** `requiresAttributes` (e.g. PER 4+), `accuracyModifier`, `cannotBeEvaded`, `gearBonus`, `needsDirection` (facing token, default north, set secretly at assign — v0.3 amendment).
- **Art slot:** `art` emoji today → illustration tomorrow. Minimum legibility: art must never obscure costs, targeting, or rules.

Every fighter card MUST display (`CharacterDefinition` + live `CharacterState`):

- Name, class color band, series (`ATLA`/`LOK`), role (`hero`/`villain`), class (Water/Earth/Fire/Air/Non-bending).
- Attributes `AGG/PER/AGI/DIS/RES` 1–5; max HP = `16 + 2*(RES-3)`; Focus 0–4; Move 2 (+gear); Talent/`passiveDescription`.
- Avatar only: Resonance meter `0/6`, activation cost 2 Focus, `+1 dmg / +1 shield`, 2 rounds, **KO while active = instant loss**.

## 2. Sizing & art-slot standard (all prototypes)

- **Web target:** card face 300×420px (5:7), padding 16px, corner radius 14px. Scales down to hand-row width without reflow (rules text wraps to more lines; only the art crops via `object-fit: cover` — rules text is never clamped or ellipsized).
- **Print target:** poker 63×88mm + 3mm bleed; safe zone 3mm inside trim. All text ≥7pt print / ≥11px web.
- **Art slots:**
  - `ART-L` (large): 268×150px web (≈ 57×32mm print), aspect 16:9, top-anchored. Holds full scene illustration. Placeholder: current `art` emoji centered on muted element gradient.
  - `ART-FULL` (full-bleed): edge-to-edge behind header + art zone (≈ top 55% of face); text panels float over it with scrim for contrast.
  - `ART-S` (strip/icon): 268×48px, for compact layouts only — NOT art-forward, kept for density.
- **Border code (all prototypes):** red = Attack, blue = Defense, gold = Gear. Always paired with uppercase kind label (`ATTACK`/`DEFENSE`/`GEAR`) for non-color cue.

---

## 3. Prototype T1 — Classic art-forward frame (RECOMMENDED default)

Large art window (~45% of face). Direct evolution of current `PlayingCard.tsx:20-44` — same corner-pip pattern, bigger art.

```
┌────────────────────────────┐
│ ⚡2                  🔥 FIRE │  ← cost TL / element TR (icon+label)
│ RISING FLAME               │  ← name, 15px bold
│ ATTACK · Ranged · FollowUp │  ← kind + tags, 10px caps
├────────────────────────────┤
│                            │
│   ┌──────────────────────┐ │
│   │                      │ │
│   │     ART-L  268×150   │ │  ← illustration zone (~45%)
│   │    (fire scene) ☄️   │ │     placeholder: emoji on grad
│   │                      │ │
│   └──────────────────────┘ │
│ ┌────────────────────────┐ │
│ │ ◎ Focused enemy · R 3  │ │  ← targeting strip, icon + text
│ │   LOS required         │ │
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │ Ranged 3. 3 damage     │ │  ← rules box — FULL verbatim
│ │ (+1 if the target was  │ │     `rulesText` from
│ │ displaced this round). │ │     cards.ts (min 3 lines,
│ └────────────────────────┘ │     never truncated)
│ Fits: Fire · ATK slot 1/2  │  ← restrictions + slot
│ 💠1 to play · ⇪2 banked    │  ← chi economy
└────────────────────────────┘
```

- **Field map:** TL `⚡{energyCost}`; TR `{suit} {ELEMENT}`; kind row `{economy.kind} · {tags.join(' · ')}`; targeting strip derived from `targeting` (`◎`=character, `■`=tile, `→`=direction, `◉`=area); rules = **full verbatim `rulesText`** (see below); footer = `restrictions` pretty-printed (`Fire only` / `Aang only` / `Anyone`) + `{slotType} slot` + `💠{chiCost} / ⇪{value}`.
- **Rules text (explanation) is mandatory and verbatim.** The rules box must render the complete `rulesText` string from `cards.ts` — never a shortened fragment. This is the player-facing explanation of what the card does (range, damage, conditions, status durations, terrain behavior); the icons in the targeting strip are a summary aid, not a substitute. The box grows to fit 1–5 wrapped lines; the art window may shrink to a 16:9→2:1 crop if the string is long, but the rules box may not truncate or ellipsize. Verbatim strings for the worked examples:
  - `Rising Flame` → `Ranged 3. 3 damage (+1 if the target was displaced this round).`
  - `Earth Wall` → `Create a Rock Wall (blocking, 2 rounds) on an empty tile in range 3.`
  - `Aang's Glider` → `Gear (Aang only). +1 movement while equipped.`
  - `Precision Strike` → `Ranged 4, Perception 4+. 2 damage, +2 accuracy, cannot be evaded.`
  - `Water Whip` → `Ranged 3. 2 damage and pull 1 (+1 damage when Water empowered).`
  - `Fire Sweep` → `Line 2 in a chosen direction. 1 damage to each enemy (not split).`
  - `Comet Strike` → `Radius-1 bomb at an origin within 4. 5 damage to each enemy. 2 Energy + 3 chi.`
- **Worked variants** (rules lines below are verbatim `rulesText`):
  - `Earth Wall` (terrain): targeting `■ Empty tile · R 3`; rules `Create a Rock Wall (blocking, 2 rounds) on an empty tile in range 3.`; footer `Fits Earth/Avatar · DEF slot`.
  - `Aang's Glider` (gear, gold border): header `GEAR — STAYS EQUIPPED`; rules `Gear (Aang only). +1 movement while equipped.`; footer `Aang only · GEAR slot`.
  - `Precision Strike` (gate): rules `Ranged 4, Perception 4+. 2 damage, +2 accuracy, cannot be evaded.`; footer adds `Requires PER 4+ · ⦻ Cannot be Evaded`.
  - `Water Shoes` (gear, gold border): header `GEAR — STAYS EQUIPPED`; targeting `Self`; rules `Gear (Waterbenders only). While equipped, you may enter and end your move on water tiles as if they were open ground — water no longer blocks your movement.`; footer `Fits Water · GEAR slot · 💠1 to play · ⇪2 banked`. See §8 for the terrain rule this unlocks.
  - `Rocket Flight` (movement, blue border, defense slot): header `SUPPORT — MOVE`; targeting `Self · fly 3`; rules `Rocket Flight: fly up to 3 tiles, ignoring every tile in between — walls, water, hazards, and difficult ground neither stop you nor trigger. Land on an empty tile you could normally stand on (not a wall, not water). Firebenders only.`; footer `Fits Fire · DEF slot · 💠3 to play · ⇪2 banked`. See §9.
- **Implementation:** extend `.playing-card` with `.art-L` block (`aspect-ratio: 16/9; object-fit: cover`) and a `.pc-rules` box with `flex: 1` so it absorbs the full string; no data changes.

## 4. Prototype T2 — Full-bleed art with floating panels (art-forward)

For showcase / inspect view (draft, deck-builder, detail modal). Art is the card; rules float on scrims.

```
┌────────────────────────────┐
│ ░░ full-bleed illustration ░│  ← ART-FULL, top ~55%
│ ░░  (Katara on pond)  🌊 ░│     edge-to-edge, scrim behind text
│ ░────────────────────────░ │
│ │ ⚡1 WATER WHIP · 🔵 DEF?││  ← floating header chip (no—Attack)
│ │ ATTACK · Ranged Displ. ││     correction: ATTACK chip
├────────────────────────────┤  ← (divider sits ON art bottom edge)
│ ┌────────────────────────┐ │
│ │ ◎ Enemy · R 3 · LOS    │ │  ← targeting chip
│ │ Ranged 3. 2 damage     │ │  ← rules panel (solid card bg)
│ │ and pull 1 (+1 damage  │ │     shows FULL verbatim `rulesText`
│ │ when Water empowered). │ │
│ │ Fits Water/Avatar · ATK│ │
│ │ 💠0 · ⇪1      ⚡1 🌀0   │ │
│ └────────────────────────┘ │
└────────────────────────────┘
```

- **Rules:** header/targeting/rules/footer identical content to T1 — the lower panel renders the **full verbatim `rulesText`** (`Ranged 3. 2 damage and pull 1 (+1 damage when Water empowered).`) with the targeting chip as a summary aid above it, never replacing it. Header + name render as overlay chips (`rgba(0,0,0,.55)` scrim, white text) pinned to art top/bottom; lower panel is opaque card stock so rules stay legible at hand-row widths.
- **When to use:** card inspect / draft pick / collection. NOT the hand-row default (text-over-art fails at small size).
- **Implementation:** new `.playing-card.fullbleed` variant; `img` absolutely positioned, `object-fit: cover`; chips reuse T1 strings. Art credit line (6px) allowed bottom-right of art zone.

## 5. Prototype T3 — Compact tactical readout (density, small art)

Keeps every field but shrinks art to an icon strip so 5-card hands + board fit on one screen. NOT art-forward — included as the dense companion to T1/T2.

```
┌───────────────────────────────────┐
│ [art 40px] 🔥 Rising Flame  ⚡2 💠1│
│ [◎→3] [Ranged] [FollowUp]  ⇪2    │
│ Ranged 3. 3 damage (+1 if the     │  ← full verbatim `rulesText`,
│ target was displaced this round). │     wraps to as many lines needed
│ Fits: Fire · ATK slot             │
├───────────────────────────────────┤
│ [art 40px] 🧱 Earth Wall   ⚡1 💠1│
│ [■R3 empty] [Terrain][Guard] ⇪2   │
│ Create a Rock Wall (blocking, 2   │
│ rounds) on an empty tile in R 3.  │
│ Fits: Earth/Avatar · DEF slot     │
└───────────────────────────────────┘
```

- **Field map:** identical strings to T1 (rules = **full verbatim `rulesText`**, wrapped, never abbreviated); art = 40×40px thumb (`ART-S` cropped square); targeting compressed to icon rail (`◎`=focused, `→N`=range, `■`=tile, `◉r1`=radius).
- **When to use:** hand row during activations (Play-or-Scrap decision), log-adjacent mini list.
- **Implementation:** CSS-only `.playing-card.compact` (row flex, art thumb left); same React props as T1.

## 6. Prototype T4 — Directional / AoE with facing rose + art strip

Line/area cards (`Fire Sweep`, `Comet Strike`) need the secret facing token (default north, set at assign, revealed with card — v0.3 amendment). Art becomes a horizontal strip so the rose stays dominant.

```
┌────────────────────────────┐
│ ☄️ FIRE SWEEP    ⚡2 · 💠2  │  ← ART-S strip BEHIND header (48px)
│ Fire · ATTACK · AoE        │
│      ▲                     │
│   ◀  █  ▶   Line 2 →       │  ← facing rose (N/E/S/W), secret
│      ▼      facing token   │     until reveal
│ Line 2 in a chosen         │
│ direction. 1 damage to     │
│ each enemy (not split).    │  ← full verbatim `rulesText`
│ Fits: Fire · ATK · ⇪2 bank │
└────────────────────────────┘
┌────────────────────────────┐
│ 💥 COMET STRIKE  ⚡2 · 💠3  │
│ Fire · ATTACK · AoE bomb   │
│   ┌───┐                   │
│   │ █ │  ◉ Radius-1 @ R4  │  ← shape diagram instead of rose
│   └───┘                   │
│ Radius-1 bomb at an origin │
│ within 4. 5 damage to each │
│ enemy. 2 Energy + 3 chi.   │  ← full verbatim `rulesText`
│ Fits: Fire · ATK · ⇪3 bank │
└────────────────────────────┘
```

- **Rules:** rose/diagram is illustrative only — legality comes from `targeting: {kind:"direction", maxLength:2}` / `{kind:"area", shape:"radiusManhattan", radius:1, maxRange:4}`. The rules box still shows the **full verbatim `rulesText`**; for these two that is: `Fire Sweep` → `Line 2 in a chosen direction. 1 damage to each enemy (not split).` and `Comet Strike` → `Radius-1 bomb at an origin within 4. 5 damage to each enemy. 2 Energy + 3 chi.`
- **Implementation:** `.playing-card.directional` with rose SVG (4 buttons in prototype interactivity, static in print); art strip reuses `ART-S`.

## 7. Prototype F1 — Fighter card (art-forward)

One per character in draft + activation panel. Art occupies top half; stats are a fixed grid so HP/Focus/statuses stay comparable across all 30 roster entries.

```
┌────────────────────────────┐
│ AANG          🌀 AVATAR    │  ← class color band (grey=air) + label
│ ATLA · Air · Hero          │
│ ┌────────────────────────┐ │
│ │                        │ │
│ │   ART-L 268×150        │ │  ← portrait/scene illustration
│ │   (Aang on glider)     │ │
│ │                        │ │
│ └────────────────────────┘ │
│ AGG2 PER4 AGI5 DIS3 RES2   │  ← attributes 1–5
│ HP 14/14 · Move 2 · ●Focus │  ← HP formula 16+2*(RES-3)
│ Talent: Evasive Focus      │
│ Gains Focus after a        │  ← FULL verbatim
│ successful evasion, once   │     `passiveDescription`
│ per round.                 │
│ ━ Resonance ████░░ 4/6 ━   │  ← Avatar ONLY; hidden for others
│ STATE: 2 Foc · +1d/+1s 2r  │
│ ⚠ KO while active = LOSE   │
└────────────────────────────┘
```

- **Talent text is verbatim.** The talent box renders the complete `passiveDescription` string from `characters.ts` (e.g. Zuko's `Adaptive duelist: momentum through consecutive attacks.`), wrapped and never abbreviated — it is the character's explanation of how their innate trait works.
- **Non-Avatar variant (Zuko):** same shell, no Resonance block; talent line uses his verbatim `passiveDescription` (`Adaptive duelist: momentum through consecutive attacks.`).
- **Live-state overlays (UI only, not print):** HP bar, Focus pips, status chips (`OffBalance`, `Exposed`, `Bound`, `Exhausted`), shield badge, `Evade 1⚡ available` / `Bound — no move`, equipped-gear icons. Overlays sit below talent, never over art.
- **Implementation:** new `FighterCard.tsx` + `.fighter-card` CSS; props = `CharacterDefinition` + `CharacterState`; resonance block rendered iff `avatarState?.enabled`.

## 8. Terrain rule — Water is impassable (Water Shoes exception)

**Rule:** No character may enter or end movement on a water tile (Pond / any `elementalSource: "water"` tile), **except** a waterbender who has the **Water Shoes** gear equipped. Water becomes a hard movement gate, not just difficult terrain.

- **Design intent:** ponds stop being "slow" and start being "closed," which turns the fixed map's two ponds into real walls that shape routing. Water Shoes then becomes a genuine mobility card for waterbenders — the only way they (or anyone they enable) cross a pond — rather than a minor speed bump.
- **Interaction with Freeze/Melt (v0.3 amendment §Terrain):** Water Shoes only governs *walking* on water. The freeze/douse counters are unchanged: a waterbender may still freeze a Pond into Ice (Ice is walkable by anyone — it is difficult, not impassable), and may melt Ice back to Pond. Freezing a pond therefore still opens a crossable bridge for the whole team; Water Shoes is the alternative that does not require spending a technique.
- **Line of sight:** water does **not** block line of sight. Unlike a Rock Wall, an impassable Pond stops movement only — ranged attacks, AoE, and LOS cross it freely. Do not reuse the `blocking` flag for this (that flag also breaks LOS in `rules/terrain.ts`); it needs a distinct `impassableToMove` concept.
- **Evade:** an Evade step may not end on a water tile unless the evader has Water Shoes (Evade destinations already exclude blocking tiles — extend the same check to impassable water).
- **Forced movement (push/pull):** a push/pull path stops before an impassable pond, exactly as it stops before a wall; remaining displacement is lost (spec §4.7).
- **Companion caveat:** Appa's Sky Bison Lift is a teleport to any legal tile and ignores intervening terrain — but the *destination* must still be legal, so a pond is an illegal landing spot without Water Shoes. (Appa flies over water canonically; if that flavor matters, grant Appa-carried flights an explicit water-landing exception rather than weakening the gate.)

### Water Shoes card

The gear card that enables this exception is **Water Shoes**. Its full card data (field-by-field definition, verbatim `rulesText`, `GearBonus.waterWalking` engine delta, restriction and UI notes) lives in the card roster: `specs/card_roster.md` §2.1. Only the terrain-rule interactions are kept here.

## 9. Movement technique — Rocket Flight (firebender)

**Rule:** A firebender may play **Rocket Flight** to leap up to **3 tiles, ignoring all terrain** — walls, ponds, hazards, and difficult ground neither block the jump nor trigger on the way. This is the firebender's answer to the water gate (§8) and to walls: raw vertical mobility, priced to match.

- **Design intent:** fire is pressure and commitment. Rocket Flight trades a lot of resources for a single, decisive reposition — escape a bind, close for a kill, or cross the board's hard terrain that everyone else must route around. It is a **one-shot technique, not gear**: pay per jump, do not get a permanent 3-tile walk. That keeps it a bomb-level decision in the chi economy rather than an auto-include.
- **Costs a lot (reference tuning):** `2 Energy + 3 chi` (chiCost 3, value 2) — priced at Comet Strike level, the current ceiling for "save up for this." It is fire-only and sits in the **defense slot** (a reposition/escape), so it competes with shields for one of the two defense slots rather than being free upside.
- **Path and destination:** target any in-bounds tile within Manhattan range 3; intervening tiles are ignored entirely (no occupancy check on tiles crossed — you fly over them). The **destination must still be legal**: empty, in-bounds, and standable. A pond or a wall tile is an illegal landing spot **unless** the character also has the relevant exception (Water Shoes for water; walls are never legal landings). If the chosen destination is illegal, the flight fizzles (costs already paid) — same rule as Appa's lift.
- **Terrain triggers:** none on the crossed tiles (you are airborne), so no Blaze damage, no Ice OffBalance, no hazard entry. Landing on a hazard or difficult tile **does** trigger that tile's entry normally — you chose to touch down there.
- **Line of sight:** not required. Rocket Flight is a self-teleport; it ignores intervening terrain the same way Appa's Sky Bison Lift does.
- **Bound:** Rocket Flight **is** blocked by Bound — Bound prevents voluntary movement, and this is voluntary (unlike Appa, who carries you and explicitly ignores Bound). A Bound firebender must be freed or use a cleanse first.
- **Evade:** no Evade window — Rocket Flight is not a focused attack, so it is not reactable. The opponent sees the leap only when the card is revealed.
- **Interaction with the water rule (§8):** Rocket Flight is the *fire* way across a pond; Water Shoes is the *water* way. Neither weakens the other. A firebender can fly over a pond but still cannot end on it; a waterbender with shoes walks it but gains no flight.
- **Flavor note:** call it rocket flight / jet-stepping; the mechanic is a range-3 teleport with a terrain ignore. Future variants (e.g. an Ozai "Comet-empowered" version that also deals damage on landing, or a version that carries one ally) must keep the high cost and the one-shot nature.

### Rocket Flight card

Full card data (field-by-field definition, verbatim `rulesText`, teleport engine delta, targeting-model note, UI notes) lives in the card roster: `specs/card_roster.md` §2.2. Only the rule design (cost, path legality, terrain triggers, Bound/Evade interaction) is kept here.

## 10. Implementation notes (for the builder)

1. **No data migration.** All four technique prototypes render from `CardDefinition + CARD_ECONOMY[id]`; F1 renders from `CharacterDefinition + CharacterState`. Validate with existing `validateCardDefinitions()`.
2. **Rules/explanation text is verbatim.** Render `def.rulesText` and `character.passiveDescription` in full on every card — never truncate, ellipsize, or replace with icons. Targeting-strip icons and kind labels are additive summary aids, not substitutes for the written explanation (spec §14: never communicate rules by icon/color alone). If a rules string is long, let the box grow and shrink the art crop; never the reverse.
3. **Start with T1.** Extend `src/ui/PlayingCard.tsx` props with `variant: "classic" | "fullbleed" | "compact" | "directional"` and an `artSrc?: string` (falls back to `def.art` emoji). Ship T1 + T3 first (hand + inspect share strings), then T2 (inspect-only), then T4 rose.
4. **Art pipeline:** placeholder = emoji on element gradient; drop-in = `<img src={artSrc} class="art-L" />` with `object-fit: cover`. Keep emoji as `alt` / loading fallback. Recommended prompt spec for future illustrators: 16:9 scene, single bending moment, no text in art, key subject centered (safe for 1:1 crop in T3).
5. **Accessibility (§14):** every color cue duplicated in text (element name, kind label, status name); targeting strip always textual (`Ranged 3`, not arrow-only); minimum contrast 4.5:1 for rules panel over art (scrim required in T2).
6. **Print check:** verify T1/T2 art at 300dpi (print 672×945px face → ART-L ≥ 670×380px source); T3/T4 art may be 150dpi (decorative only).

## 11. Shipped in the prototype (hot-seat UI)

The prototype now implements the T1 direction for the hand and sheets:

- **Technique cards are 5:7.** `.playing-card` uses `aspect-ratio: 5 / 7` (border-box) to match the card-back artwork `public/card_back.png` (300×420), so faces and backs share one ratio.
- **Verbatim rules.** `.pc-rules` renders the complete `rulesText` on the face (box grows; never truncated/ellipsized), with costs and fit/bank detail in the hover tooltip.
- **Sheets carry card slots.** Each character sheet is flanked by a **gear** slot and an **ability** slot (compact `MiniCard` tokens). A face-down assignment reads as the card **face** to its owner and as the **card back** (`MiniCardBack`, `public/card_back.png`) to the opponent — the acting side is the viewer in hot-seat play.
- **Terminology.** The earthbender is **Toph** (dropped the surname for brevity); the LOK metalbender remains **Lin Beifong**.
- **Combat feedback.** Per-element attack overlays (fire/water/air/earth/slash) and floating damage/heal numbers, drawn in a board-level `.fx-overlay` that mirrors the tile grid so effects spill across cell borders instead of being clipped by a tile; all timings live in `src/ui/animationTiming.ts`.
