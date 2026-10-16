# Card Design Prototypes — Art-Forward Layouts

**Status:** Design spec for future implementation. Non-normative for engine rules.
**Sources:** `specs/avatar_tactical_card_game_spec_v2.md` (§§6,9,10,13,14), `specs/avatar_tactical_card_game_spec_v0.3_amendment.md` (economy, facing, talents, companions), `docs/rules.md`, `src/game/types.ts` (`CardDefinition`, `CharacterDefinition`), `src/game/content/cards.ts`, `src/game/content/economy.ts`, `src/ui/PlayingCard.tsx`.

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
- **Rules text** (`rulesText` + `effects[]`): damage/heal/shield amounts, statuses (`OffBalance`/`Exposed`/`Bound`/`Exhausted` + `duration`), push/pull steps, terrain (`terrainId` + `durationRounds` + `replacementPolicy`), conditionals (`bonusVsStatus`, `bonusIfTargetDisplaced`, `waterEmpoweredBonus`, `requiresTargetStatus`), `gainFocus`, `gearBonus` (persistent while equipped).
- **Footer — Fits / restrictions** (`economy.restrictions`: `unique`/`element`/`alignment`/`team` + `slotType`: gear/attack/defense, caps 2/2/2 within M=4 total).
- **Gates & flags (when present):** `requiresAttributes` (e.g. PER 4+), `accuracyModifier`, `cannotBeEvaded`, `gearBonus`, `needsDirection` (facing token, default north, set secretly at assign — v0.3 amendment).
- **Art slot:** `art` emoji today → illustration tomorrow. Minimum legibility: art must never obscure costs, targeting, or rules.

Every fighter card MUST display (`CharacterDefinition` + live `CharacterState`):

- Name, class color band, series (`ATLA`/`LOK`), role (`hero`/`villain`), class (Water/Earth/Fire/Air/Non-bending).
- Attributes `AGG/PER/AGI/DIS/RES` 1–5; max HP = `16 + 2*(RES-3)`; Focus 0–4; Move 2 (+gear); Talent/`passiveDescription`.
- Avatar only: Resonance meter `0/6`, activation cost 2 Focus, `+1 dmg / +1 shield`, 2 rounds, **KO while active = instant loss**.

## 2. Sizing & art-slot standard (all prototypes)

- **Web target:** card face 300×420px (5:7), padding 16px, corner radius 14px. Scales down to hand-row width without reflow (text clamps, art crops by `object-fit: cover`).
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
│ │ 3 dmg (+1 if target    │ │  ← rules box, min 3 lines
│ │ displaced this round). │ │
│ └────────────────────────┘ │
│ Fits: Fire · ATK slot 1/2  │  ← restrictions + slot
│ 💠1 to play · ⇪2 banked    │  ← chi economy
└────────────────────────────┘
```

- **Field map:** TL `⚡{energyCost}`; TR `{suit} {ELEMENT}`; kind row `{economy.kind} · {tags.join(' · ')}`; targeting strip derived from `targeting` (`◎`=character, `■`=tile, `→`=direction, `◉`=area); rules = `rulesText` verbatim; footer = `restrictions` pretty-printed (`Fire only` / `Aang only` / `Anyone`) + `{slotType} slot` + `💠{chiCost} / ⇪{value}`.
- **Worked variants:**
  - `Earth Wall` (terrain): targeting `■ Empty tile · R 3`; rules `Create Rock Wall (blocking, 2 rnd). Fails if occupied.`; footer `Fits Earth/Avatar · DEF slot`.
  - `Aang's Glider` (gear, gold border): header `GEAR — STAYS EQUIPPED`; rules `+1 movement while equipped.`; footer `Aang only · GEAR slot`.
  - `Precision Strike` (gate): rules `Ranged 4. 2 dmg, +2 accuracy.`; footer adds `Requires PER 4+ · ⦻ Cannot be Evaded`.
- **Implementation:** extend `.playing-card` with `.art-L` block (`aspect-ratio: 16/9; object-fit: cover`); no data changes.

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
│ │ 2 dmg + pull 1. (+1    │ │  ← rules panel (solid card bg)
│ │ when Water-empowered.) │ │
│ │ Fits Water/Avatar · ATK│ │
│ │ 💠0 · ⇪1      ⚡1 🌀0   │ │
│ └────────────────────────┘ │
└────────────────────────────┘
```

- **Rules:** header/targeting/rules/footer identical content to T1, but header + name render as overlay chips (`rgba(0,0,0,.55)` scrim, white text) pinned to art top/bottom; lower panel is opaque card stock so rules stay legible at hand-row widths.
- **When to use:** card inspect / draft pick / collection. NOT the hand-row default (text-over-art fails at small size).
- **Implementation:** new `.playing-card.fullbleed` variant; `img` absolutely positioned, `object-fit: cover`; chips reuse T1 strings. Art credit line (6px) allowed bottom-right of art zone.

## 5. Prototype T3 — Compact tactical readout (density, small art)

Keeps every field but shrinks art to an icon strip so 5-card hands + board fit on one screen. NOT art-forward — included as the dense companion to T1/T2.

```
┌───────────────────────────────────┐
│ [art 40px] 🔥 Rising Flame  ⚡2 💠1│
│ [◎→3] [Ranged] [FollowUp]  ⇪2    │
│ 3 dmg, +1 if displaced.           │
│ Fits: Fire · ATK slot             │
├───────────────────────────────────┤
│ [art 40px] 🧱 Earth Wall   ⚡1 💠1│
│ [■R3 empty] [Terrain][Guard] ⇪2   │
│ Rock Wall, blocking, 2 rnd.       │
│ Fits: Earth/Avatar · DEF slot     │
└───────────────────────────────────┘
```

- **Field map:** identical strings to T1; art = 40×40px thumb (`ART-S` cropped square); targeting compressed to icon rail (`◎`=focused, `→N`=range, `■`=tile, `◉r1`=radius).
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
│ 1 dmg EACH enemy in line,  │
│ not split. Wall stops it.  │
│ Fits: Fire · ATK · ⇪2 bank │
└────────────────────────────┘
┌────────────────────────────┐
│ 💥 COMET STRIKE  ⚡2 · 💠3  │
│ Fire · ATTACK · AoE bomb   │
│   ┌───┐                   │
│   │ █ │  ◉ Radius-1 @ R4  │  ← shape diagram instead of rose
│   └───┘                   │
│ 5 dmg EACH enemy.          │
│ Fits: Fire · ATK · ⇪3 bank │
└────────────────────────────┘
```

- **Rules:** rose/diagram is illustrative only — legality comes from `targeting: {kind:"direction", maxLength:2}` / `{kind:"area", shape:"radiusManhattan", radius:1, maxRange:4}`; always print `Wall stops it` / `Full dmg each, not split` in rules (spec §10).
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
│ +1 Focus after evade (1/r) │
│ ━ Resonance ████░░ 4/6 ━   │  ← Avatar ONLY; hidden for others
│ STATE: 2 Foc · +1d/+1s 2r  │
│ ⚠ KO while active = LOSE   │
└────────────────────────────┘
```

- **Non-Avatar variant (Zuko):** same shell, no Resonance block; talent line `Breakthrough: +1 dmg vs shielded`.
- **Live-state overlays (UI only, not print):** HP bar, Focus pips, status chips (`OffBalance`, `Exposed`, `Bound`, `Exhausted`), shield badge, `Evade 1⚡ available` / `Bound — no move`, equipped-gear icons. Overlays sit below talent, never over art.
- **Implementation:** new `FighterCard.tsx` + `.fighter-card` CSS; props = `CharacterDefinition` + `CharacterState`; resonance block rendered iff `avatarState?.enabled`.

## 8. Implementation notes (for the builder)

1. **No data migration.** All four technique prototypes render from `CardDefinition + CARD_ECONOMY[id]`; F1 renders from `CharacterDefinition + CharacterState`. Validate with existing `validateCardDefinitions()`.
2. **Start with T1.** Extend `src/ui/PlayingCard.tsx` props with `variant: "classic" | "fullbleed" | "compact" | "directional"` and an `artSrc?: string` (falls back to `def.art` emoji). Ship T1 + T3 first (hand + inspect share strings), then T2 (inspect-only), then T4 rose.
3. **Art pipeline:** placeholder = emoji on element gradient; drop-in = `<img src={artSrc} class="art-L" />` with `object-fit: cover`. Keep emoji as `alt` / loading fallback. Recommended prompt spec for future illustrators: 16:9 scene, single bending moment, no text in art, key subject centered (safe for 1:1 crop in T3).
4. **Accessibility (§14):** every color cue duplicated in text (element name, kind label, status name); targeting strip always textual (`Ranged 3`, not arrow-only); minimum contrast 4.5:1 for rules panel over art (scrim required in T2).
5. **Print check:** verify T1/T2 art at 300dpi (print 672×945px face → ART-L ≥ 670×380px source); T3/T4 art may be 150dpi (decorative only).
