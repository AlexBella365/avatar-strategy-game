# Card Roster v1 — Full Pool (existing + proposed)

**Status:** Design proposal for future implementation. Non-normative for engine rules.
**Purpose:** Single source of truth for **which cards exist** and their full data. Layout/visual design lives separately in `specs/card_design_prototypes.md` (T1–T4 technique frames, F1 fighter card, sizing/art-slot standard); engine rules live in `specs/avatar_tactical_card_game_spec_v2.md` + `specs/avatar_tactical_card_game_spec_v0.3_amendment.md`; character list in `specs/avatar_character_roster_v2.md`. Live code references: `src/game/content/cards.ts` + `src/game/content/economy.ts` (current 18-card pool).
**Goal:** Reach **~20 usable cards per character type** (Water / Earth / Fire / Air / Non-bending), built from ATLA + LOK lore, **with a shared core** so common effects aren't reprinted per element.

## 1. Existing live pool (ships today — `cards.ts` + `economy.ts`)

18 cards. `rulesText` shown verbatim as it appears in `cards.ts` (the player-facing explanation printed on every card).

| id | name | cardType / kind | ⚡+💠 (⇪) | Fits (restriction) | rulesText (verbatim) |
|---|---|---|---|---|---|
| `earth-sweep` | Earth Sweep | attack / attack | 1+0 (1) | Earth, Avatar | `Melee. 2 damage + OffBalance.` |
| `air-blast` | Air Blast | attack / attack | 1+0 (1) | Air, Avatar | `Ranged 3. 2 damage (+1 vs OffBalance) and push 1.` |
| `rising-flame` | Rising Flame | attack / attack | 2+1 (2) | Fire | `Ranged 3. 3 damage (+1 if the target was displaced this round).` |
| `water-whip` | Water Whip | attack / attack | 1+0 (1) | Water, Avatar | `Ranged 3. 2 damage and pull 1 (+1 damage when Water empowered).` |
| `air-shield` | Air Shield | defense / defense | 1+1 (1) | Air, Avatar | `Shield 2 to self and adjacent allies until next round.` |
| `earth-wall` | Earth Wall | support / defense | 1+1 (2) | Earth, Avatar | `Create a Rock Wall (blocking, 2 rounds) on an empty tile in range 3.` |
| `fire-sweep` | Fire Sweep | attack / attack | 2+2 (2) | Fire | `Line 2 in a chosen direction. 1 damage to each enemy (not split).` |
| `ice-bind` | Ice Bind | attack / attack | 1+1 (2) | Water | `Ranged 3. 1 damage; Bound (2) if the target is OffBalance.` |
| `sokkas-feint` | Sokka's Feint | attack / attack | 1+0 (1) | Sokka only (unique) | `Ranged 3. Expose the target and gain 1 Focus. Sokka only.` |
| `precision-strike` | Precision Strike | attack / attack | 1+1 (2) | Non-bending | `Ranged 4, Perception 4+. 2 damage, +2 accuracy, cannot be evaded.` |
| `water-recovery` | Water Recovery | support / defense | 1+0 (1) | Water, Avatar | `Heal an ally in range 3 for 3.` |
| `seismic-read` | Seismic Read | support / attack | 1+0 (1) | Earth | `Ranged 4. Expose the target and gain 1 Focus.` |
| `aang-glider` | Aang's Glider | support / gear | 1+1 (2) | Aang only (unique) | `Gear (Aang only). +1 movement while equipped.` |
| `sokka-boomerang` | Sokka's Boomerang | support / gear | 1+1 (2) | Sokka only (unique) | `Gear (Sokka only). +1 damage on your attacks while equipped.` |
| `comet-strike` | Comet Strike | attack / attack | 2+3 (3) | Fire | `Radius-1 bomb at an origin within 4. 5 damage to each enemy. 2 Energy + 3 chi.` |
| `travel-rations` | Travel Rations | support / defense | 1+0 (1) | Anyone | `Share a meal: heal an ally in range 3 for 2. Anyone can carry rations.` |
| `smoke-bomb` | Smoke Bomb | defense / defense | 1+0 (1) | Anyone | `Vanish in smoke: shield 2 until next round and gain 1 Focus. Anyone can use it.` |
| `dust-toss` | Dust Toss | attack / attack | 1+0 (1) | Anyone | `Throw dust: ranged 2, 1 damage + Exposed. Anyone can throw dust.` |

Per-type signature counts from this live pool: Water 3 (water-whip, ice-bind, water-recovery) · Earth 3 (earth-sweep, earth-wall, seismic-read) · Fire 3 (rising-flame, fire-sweep, comet-strike) · Air 2 (air-blast, air-shield) · Non-bending 1 broad (precision-strike) + Sokka-unique. Universal 3 (travel-rations, smoke-bomb, dust-toss). Gear/unique 2 (aang-glider, sokka-boomerang).

## 2. Design-intent additions (from `card_design_prototypes.md` §8/§9 — new cards, not yet in `cards.ts`)

These two cards were specced alongside the water-impassable terrain rule and the firebender movement technique. The **rule rationale** (why water is impassable, how Rocket Flight interacts with it) lives in `specs/card_design_prototypes.md` §8/§9; this file holds the **card data**.

### 2.1 Water Shoes

| Field | Value |
|---|---|
| `id` | `water-shoes` |
| `name` | `Water Shoes` |
| `cardType` / `economy.kind` | `support` / `gear` |
| `element` | `water` |
| `energyCost` / `focusCost` | `1` / `0` |
| `economy` | `chiCost: 1`, `value: 2`, `slotType: "gear"`, `restrictions: [{ type: "element", elements: ["water"] }]` |
| `targeting` | `{ kind: "self" }` |
| `tags` | `["Gear", "Mobility"]` |
| `effects` / `terrainEffects` | `[]` (mobility flag resolved by movement rules, not an effect) |
| `gearBonus` | `{ waterWalking: true }` — **new `GearBonus` field** (see below) |
| `rulesText` (verbatim) | `Gear (Waterbenders only). While equipped, you may enter and end your move on water tiles as if they were open ground — water no longer blocks your movement.` |

- **Engine delta:** `GearBonus` gains an optional `waterWalking?: boolean` (default false). `rules/movement.ts` currently derives illegal destinations from `blockingTiles(state)`; it must also treat water tiles as blocked **unless** the moving character has an equipped gear granting `waterWalking`. The Evade legal-destination helper and the forced-movement path walker share the same water check. (Depends on the water-impassable rule — `card_design_prototypes.md` §8.)
- **Restriction note:** gated by `element: ["water"]`, so it fits waterbenders (and Avatar-element characters, consistent with other water cards). Not universal — that is the point of the card.
- **UI:** the targeting preview must grey out pond tiles for a character without Water Shoes and light them for one with it (same "show why illegal" requirement as spec §14 — label the reason `Water — needs Water Shoes`).

### 2.2 Rocket Flight

| Field | Value |
|---|---|
| `id` | `rocket-flight` |
| `name` | `Rocket Flight` |
| `cardType` / `economy.kind` | `support` / `defense` |
| `element` | `fire` |
| `energyCost` / `focusCost` | `2` / `0` |
| `economy` | `chiCost: 3`, `value: 2`, `slotType: "defense"`, `restrictions: [{ type: "element", elements: ["fire"] }]` |
| `targeting` | `{ kind: "self" }` — the landing tile is chosen via `movePath` (see engine delta) |
| `movement` | `{ timing: "beforeTechnique", maxSteps: 3, path: "teleport", destinationRule: "fizzle" }` — reuses Appa's teleport primitive |
| `tags` | `["Mobility", "Escape"]` |
| `effects` / `terrainEffects` | `[]` (pure movement) |
| `rulesText` (verbatim) | `Rocket Flight: fly up to 3 tiles, ignoring every tile in between — walls, water, hazards, and difficult ground neither stop you nor trigger. Land on an empty tile you could normally stand on (not a wall, not water). Firebenders only.` |

- **Engine delta:** smaller than Water Shoes — `MovementEffect` already supports `path: "teleport"` (Appa uses it) and `destinationRule: "fizzle"`. Rocket Flight is the same primitive with `maxSteps: 3` and a Manhattan range cap instead of "any tile." The one new bit: the destination-standability check must consult the impassable-water rule (`card_design_prototypes.md` §8), and crossed tiles skip terrain-entry triggers. Add the `element: ["fire"]` restriction and the defense slot.
- **Targeting-model note:** `types.ts` models teleport as a `movement` field on a card whose `targeting` is `self` — but Rocket Flight needs the player to pick a *destination*. Either extend `TargetSelection` with a `teleport` kind, or model the landing tile as the card's `movePath` (already in `PLAY_CARD`). Recommend the `movePath` route to avoid a new selection kind.
- **UI:** range-3 reachable-tile highlight with a distinct "crossed terrain, no effect" style; legal landings solid, illegal ones (wall/water) greyed with the spec §14 reason (`Water — needs Water Shoes`, `Wall — cannot land`). Confirm before committing, since it costs chi and fizzles on a bad pick.

## 3. Design principles (pool construction)

1. **Shared where sensible.** A pool of generic combat tools (guards, mobility, focus, chips) is **universal** — fits every character. A second tier is **cross-class** — fits two or more types whose fantasy overlaps (terrain shapers, kinetic movers). Each element then owns a **signature** tier of flavor-unique cards. Totals count universal + cross + signature.
2. **Every card is data-driven** (`CardDefinition` + `CARD_ECONOMY`), validated at startup (`validateCardDefinitions`), 1–3 effects, tags for synergy (never card-name checks).
3. **Villain/control guardrails respected** (`specs/avatar_character_roster_v2.md`): bloodbending, chi-blocking, lightning, combustion, lavabending, flight, vacuum each have a **visible tell, high cost, short duration, and a counter**. Nothing permanently disables a character.
4. **Counterplay everywhere:** every AoE is telegraphed and outrangeable; every bind is short and cleansable; every bomb is chi-expensive so the opponent sees the save-up.
5. **Existing effects first.** Cards reuse the current `CardEffect` set (damage/heal/shield/applyStatus/removeStatus/move/pull/push/createTerrain/gainFocus/gainMomentum) and the four statuses (OffBalance/Exposed/Bound/Exhausted). Anything needing a new engine primitive is flagged in §5.

## 4. Restriction & sharing vocabulary (drives the totals)

`Restriction` (`src/game/types.ts`) already supports multi-element any-of match, so cross-class cards are pure data:

| Tier | `restrictions` | Counts toward |
|---|---|---|
| **Universal** | `[]` | all 5 types |
| **Cross-class** | `{ type:"element", elements:[A,B,"avatar"] }` | the named types (+Avatar) |
| **Element signature** | `{ type:"element", elements:[X,"avatar"] }` | that type (+Avatar) |
| **Alignment-gated** | add `{ type:"alignment", alignment:"villain"/"hero" }` | listed types, one alignment |
| **Unique** | `{ type:"unique", characterId }` | that character only (not counted in type totals) |

Avatar (`element:"avatar"`) is included in every elemental list, so Aang/Korra can equip any elemental card (spec §12A.4: Avatar State grants no free cards — they must be in the build).

## 5. New mechanics / engine deltas (FLAGGED — needed before these cards ship)

Reuse is maximized; only these are genuinely new:

- **Water impassability + Water Shoes** (`card_design_prototypes.md` §8): needed for the `water-shoes` gear (§2.1 above) and for Rocket Flight's landing check (§2.2).
- **New terrain `smoke`:** blocks **line of sight but not movement** (concealment). Current `blocking` flag does both, so `TerrainDefinition` needs a `blocksSight?: boolean` (sight-only) distinct from `blocking`. (Rules.md already describes Smoke from Stir-Ash; this formalizes it.)
- **New terrain `lava`:** hazard (2 at end of round) + fire source + difficult. All existing fields — just a new id (Ghazan/Bolin).
- **New terrain `snare` (trap):** `rubble`-like with `onEntryStatus:{ statusId:"Bound", duration:2 }`. Uses the **existing** `onEntryStatus` field — a trap is data, not code (Sokka).
- **Reaction cards** (`reactionWindow:"beforeDamage"` + `Targeting`): needed for `redirect-lightning`. `types.ts` already has the field; engine must open the window.
- **Facing / `needsDirection`** (amendment §Facing): needed for every **line/directional** card below (Tidal Wave, Ember Wind, Fire Wall, Gust Wave). Uses the assignment-time facing token.
- **Optional new status `Slowed`** (move −1): *deferred.* Below I reuse OffBalance/Exposed/Bound/Exhausted instead, so no new status is required for v1.

No card below requires a new `CardEffect` variant beyond what exists.

## 6. Universal pool — fits EVERY character (`restrictions: []`)

Existing (3): **Travel Rations**, **Smoke Bomb**, **Dust Toss** (see §1).

New (3):

| id | Kind | ⚡+💠 (⇪) | Targeting | rulesText (verbatim) | Lore |
|---|---|---|---|---|---|
| `guard-stance` | defense | 1+0 (1) | self | `Guard Stance: shield 2 until your next round.` | generic |
| `quick-step` | defense (mobility) | 1+0 (1) | self | `Quick Step: this activation you may move up to 3 tiles, ignoring difficult terrain.` | generic |
| `centering-breath` | support | 1+0 (1) | self | `Centering Breath: gain 1 Focus (max 4).` | generic |

**Universal total: 6** (counts toward all five types).

## 7. Cross-class pool — fits two or more types

These are the "common to several character types" cards: shared mechanics whose fantasy spans classes.

| id | Fits | Kind | ⚡+💠 (⇪) | Targeting | rulesText (verbatim) | Lore |
|---|---|---|---|---|---|---|
| `mud-snare` | Water, Earth | attack (terrain) | 1+1 (2) | tile R3 | `Mud Snare: range 3 tile. OffBalance, and that tile becomes difficult for 2 rounds.` | Hama/Toph |
| `grasping-vines` | Water, Earth | attack | 1+1 (2) | ranged 3 | `Grasping Vines: ranged 3. Pull 2.` | Hama (plant), Toph |
| `ice-hammer` | Water, Earth | attack | 2+1 (2) | melee | `Ice Hammer: melee. 3 damage.` | water freeze + earth force |
| `jet-burst` | Fire, Air | defense (mobility) | 1+0 (1) | self | `Jet Burst: move up to 3 tiles ignoring difficult terrain, then deal 1 damage to an adjacent enemy.` | Zuko/Aang flight |
| `ember-wind` | Fire, Air | attack | 1+1 (2) | line 2 (facing) | `Ember Wind: line 2 in your facing. 1 damage to each enemy; the last tile becomes an Ember Field.` | Jeong Jeong |
| `thermal-draft` | Fire, Air | attack | 1+1 (2) | ranged 3 | `Thermal Draft: ranged 3. Push 2 (no damage).` | air/fire shove |
| `elemental-ward` | Water, Earth, Fire, Air | defense | 1+1 (1) | self+adjacent | `Elemental Ward: shield 2 to self and adjacent allies until next round; each also removes one status.` | Avatar-verse |
| `trip-trap` | Non-bending, Earth | support (terrain) | 1+1 (2) | tile R2 | `Trip Trap: range 2 tile. The next enemy to enter or end movement there is Bound (2).` | Sokka trap / earth snare |
| `smoke-and-mirrors` | Non-bending, Air | support (terrain) | 1+1 (2) | tile R2 | `Smoke and Mirrors: range 2 tile becomes Smoke (blocks sight, not movement) until end of next round.` | Sokka / Aang fog |

**Cross-class per-type contribution:** Water +4 (mud-snare, vines, ice-hammer, ward) · Earth +4 (same) · Fire +4 (jet-burst, ember-wind, thermal, ward) · Air +4 (same) · Non-bending +2 (trip-trap, smoke-and-mirrors).

## 8. Water pool

**Existing:** Water Whip, Ice Bind, Water Recovery (3 — §1).

New signature (8):

| id | Kind | ⚡+💠 (⇪) | Targeting | rulesText (verbatim) | Lore |
|---|---|---|---|---|---|
| `ice-spear` | attack | 2+1 (2) | ranged 3 | `Ice Spear: ranged 3. 3 damage (+1 when Water empowered).` | Katara/Pakku |
| `tidal-wave` | attack (AoE) | 2+2 (3) | line 3 (facing) | `Tidal Wave: line 3 in your facing. 2 damage to each enemy + push 1 (not split).` | Korra |
| `water-arms` | attack | 1+0 (1) | melee | `Water Arms: melee. 2 damage + pull 1.` | Ming-Hua |
| `bloodbend` | attack | 2+3 (3) | ranged 3 | `Bloodbend: ranged 3. Bound (2) + Exhausted. Requires Discipline 5+ and Villain.` — `requiresAttributes:{discipline:5}`, `+alignment villain` | Hama/Amon |
| `healing-waters` | defense | 1+0 (1) | ally R3 | `Healing Waters: heal an ally in range 3 for 3 and remove one status.` | Katara |
| `octopus-guard` | defense (area) | 1+1 (1) | self+adjacent | `Octopus Guard: shield 2 to self and adjacent allies until next round.` | Katara |
| `freeze-grenade` | attack (terrain) | 1+1 (2) | tile R3 | `Freeze Grenade: range 3 tile. 1 damage, and that tile becomes Ice (difficult, 2 rounds).` | Katara |
| `mist-veil` | defense (terrain) | 1+1 (2) | self tile | `Mist Veil: your tile and its neighbors become Smoke (blocks sight) until end of next round.` — needs `smoke` terrain (§5) | Katara fog |

Water also gains the **Water Shoes** gear (§2.1) — not counted in the signature total.

## 9. Earth pool

**Existing:** Earth Sweep, Earth Wall, Seismic Read (3 — §1).

New signature (8):

| id | Kind | ⚡+💠 (⇪) | Targeting | rulesText (verbatim) | Lore |
|---|---|---|---|---|---|
| `boulder-hurl` | attack | 2+1 (2) | ranged 3 | `Boulder Hurl: ranged 3. 3 damage.` | Toph/Bumi |
| `earth-lance` | attack | 1+0 (1) | ranged 4 | `Earth Lance: ranged 4. 2 damage.` | Kuvira precision |
| `seismic-slam` | attack (AoE) | 2+1 (2) | plus-shape, maxRange 2 | `Seismic Slam: plus-shape within 2. 1 damage + OffBalance to each enemy.` | Bumi/Toph |
| `metal-cable` | attack | 1+1 (2) | ranged 4 (LOS) | `Metal Cable: ranged 4, line of sight. 2 damage + pull 2.` | Lin Beifong |
| `rock-armor` | defense | 1+1 (1) | self | `Rock Armor: shield 3 until your next round.` | Toph |
| `raised-cover` | support (terrain) | 1+1 (2) | tile R2 empty | `Raise Ground: create Cover (−1 vs ranged) on an empty tile in range 2.` | Toph |
| `lavabend` | support (terrain) | 2+2 (3) | tile R3 | `Lavabend: range 3 tile becomes Lava (2 damage at end of round, difficult, fire source) for 2 rounds.` — needs `lava` terrain (§5) | Ghazan/Bolin |
| `metal-restraint` | attack | 2+2 (3) | ranged 3 | `Metal Restraint: ranged 3. Bound (2) + Exposed. Requires Perception 4+.` — `requiresAttributes:{perception:4}` | Kuvira |

## 10. Fire pool

**Existing:** Rising Flame, Fire Sweep, Comet Strike (3 — §1). **Rocket Flight** (§2.2) also lands here as a fire mobility technique.

New signature (8):

| id | Kind | ⚡+💠 (⇪) | Targeting | rulesText (verbatim) | Lore |
|---|---|---|---|---|---|
| `fire-lash` | attack | 1+0 (1) | melee | `Fire Lash: melee. 2 damage.` | Zuko |
| `blue-flame` | attack | 2+2 (3) | ranged 3 | `Blue Flame: ranged 3. 4 damage. Requires Aggression 4+.` — `requiresAttributes:{aggression:4}` | Azula |
| `lightning-bolt` | attack | 2+3 (3) | ranged 4 | `Lightning Bolt: ranged 4. 4 damage, cannot be Evaded. Requires Discipline 4+.` — `cannotBeEvaded:true`, `requiresAttributes:{discipline:4}` | Azula/Ozai |
| `fire-kick` | attack (mobility) | 1+0 (1) | melee | `Fire Kick: melee. 2 damage, then move 1.` | Zuko |
| `combustion-blast` | attack (AoE) | 2+3 (3) | radius-1, maxRange 3 | `Combustion Blast: radius 1 within 3. 3 damage to each enemy (not split).` | P'Li |
| `fire-wall` | support (terrain) | 2+2 (2) | line 2 (facing) | `Fire Wall: up to 2 tiles in your facing become Bonfire (1 damage on entry) for 2 rounds.` — needsDirection (§5) | Jeong Jeong |
| `flame-cloak` | defense | 1+1 (1) | self | `Flame Cloak: shield 2 until next round and gain Momentum.` | Iroh/Zuko |
| `redirect-lightning` | defense (reaction) | 1+2 (2) | self | `Redirection: when a focused attack damages you, prevent it and deal 2 damage to a different enemy in range 3.` — `reactionWindow:"beforeDamage"`, `requiresAttributes:{agility:4}` | Zuko/Iroh |

## 11. Air pool

**Existing:** Air Blast, Air Shield (2 — §1).

New signature (8):

| id | Kind | ⚡+💠 (⇪) | Targeting | rulesText (verbatim) | Lore |
|---|---|---|---|---|---|
| `air-slice` | attack | 1+0 (1) | ranged 3 | `Air Slice: ranged 3. 2 damage.` | Aang/Tenzin |
| `gust-wave` | attack (AoE) | 1+1 (2) | line 3 (facing) | `Gust Wave: line 3 in your facing. 1 damage + push 1 to each enemy.` — needsDirection (§5) | Tenzin |
| `cyclone` | attack (AoE) | 2+2 (3) | radius-1, self-centered | `Cyclone: radius 1 around you. 2 damage + push 1 to each enemy.` | Aang |
| `air-scooter` | defense (mobility) | 1+0 (1) | self | `Air Scooter: move up to 3 tiles, ignoring difficult terrain.` | Aang |
| `vacuum` | attack | 2+2 (3) | ranged 3 | `Vacuum: ranged 3. 1 damage + Bound (1) + Exhausted. Requires Discipline 4+.` — `requiresAttributes:{discipline:4}`; short bind (guardrail) | Zaheer |
| `air-cushion` | defense | 1+0 (1) | ally R3 | `Air Cushion: shield an ally in range 3 for 2 until next round.` | Jinora/Tenzin |
| `wind-wall` | defense (area) | 1+1 (2) | self+adjacent | `Wind Wall: shield 2 to self and adjacent allies vs ranged attacks until next round.` | Tenzin |
| `spirit-projection` | support | 1+1 (2) | self | `Spirit Projection: gain 2 Focus (max 4).` | Jinora |

## 12. Non-bending pool

**Existing:** Sokka's Feint (Sokka-unique), Precision Strike (1 broad) — §1. Relies most on the universal + cross tiers.

New signature (12):

| id | Kind | ⚡+💠 (⇪) | Targeting | rulesText (verbatim) | Lore |
|---|---|---|---|---|---|
| `sword-flurry` | attack | 1+0 (1) | melee | `Sword Flurry: melee. 2 damage.` | Sokka |
| `boomerang-toss` | attack | 1+1 (2) | ranged 4 | `Boomerang Toss: ranged 4. 2 damage + Exposed.` | Sokka |
| `kyoshi-fan` | attack (mobility) | 1+0 (1) | melee | `Kyoshi Fan: melee. 1 damage, then move 1 and gain Momentum.` | Suki |
| `chi-block` | attack | 1+1 (2) | melee | `Chi Block: melee. 1 damage + Exhausted (2).` | Ty Lee |
| `knife-throw` | attack | 1+0 (1) | ranged 3 | `Knife Throw: ranged 3. 1 damage + Bound (1).` | Mai |
| `electro-glove` | attack | 2+1 (2) | melee | `Electro Glove: melee. 2 damage + Exhausted (1) + push 1.` | Asami |
| `feint-and-strike` | attack | 1+0 (1) | melee | `Feint and Strike: melee. 1 damage + Exposed.` | Suki/Sokka |
| `shield-bash` | attack | 1+0 (1) | melee | `Shield Bash: melee. 1 damage + push 1, then shield 1.` | Sokka/Suki |
| `meteor-sword` | attack | 2+2 (3) | melee | `Meteor Sword: melee. 3 damage. Requires Aggression 4+.` — `requiresAttributes:{aggression:4}` | Sokka |
| `grapple-line` | attack | 1+1 (2) | ranged 3 | `Grapple Line: ranged 3. 1 damage + pull 2.` | Asami/Sokka |
| `dual-daggers` | attack | 1+0 (1) | melee | `Dual Daggers: melee. 2 damage (+1 vs Exposed).` | Ty Lee/Mai |
| `rally` | support | 1+0 (2) | ally R3 | `Rally: an ally in range 3 heals 1 and gains 1 Focus.` | Sokka (leadership) |

## 13. Gear & companions additions

**Gear** (`slotType:"gear"`, persistent bonus while equipped): existing Aang's Glider, Sokka's Boomerang (§1).

| id | Fits | ⚡+💠 (⇪) | Bonus | rulesText (verbatim) | Lore |
|---|---|---|---|---|---|
| `water-shoes` | Water | 1+1 (2) | `waterWalking` (new) | see §2.1 for full data | waterbender traversal |
| `sokkas-sword` | Sokka (unique) | 1+1 (2) | `damage:1` | `Sokka's Sword: +1 damage on your attacks while equipped.` | space sword |
| `combat-suit` | Suki (unique) | 1+1 (2) | `shield` +1 | `Kyoshi Combat Suit: your first shield each round is +1.` | Suki |
| `metal-armband` | Lin, Kuvira (earth) | 1+1 (2) | `damage:1` vs shielded | `Metal Armband: +1 damage against shielded targets.` | metalbenders |

**Companions** (one-shot ability cards, resolve then discard; no Evade): existing Appa (Team Avatar teleport), Momo (snatch/bank).

| id | Fits | ⚡+💠 (⇪) | rulesText (verbatim) | Lore |
|---|---|---|---|---|
| `naga-lift` | Korra (LOK team) | 2+2 (2) | `Naga Lift: fly yourself to any empty, non-blocking tile, ignoring everything in between.` (Appa analogue for LOK) | Naga |
| `pabu-swipe` | Bolin, Mako (LOK) | 1+2 (2) | `Pabu Swipe: target an adjacent enemy who hasn't activated; peek at their face-down card, then bank it for its chi.` (Momo analogue) | Pabu |

(Gear/companions are `unique`/team-gated and NOT counted in the per-type totals.)

## 14. Per-type totals (target ≥ 20)

| Type | Universal | Cross | Existing signature | New signature | **Total** |
|---|---:|---:|---:|---:|---:|
| Water | 6 | 4 | 3 | 8 | **21** |
| Earth | 6 | 4 | 3 | 8 | **21** |
| Fire | 6 | 4 | 3 | 8 (+Rocket Flight) | **21+** |
| Air | 6 | 4 | 2 | 8 | **20** |
| Non-bending | 6 | 2 | 1 | 12 | **21** |

Unique/gear/companion cards add on top per character (Glider, Boomerang, Water Shoes, Sword, etc.) but aren't counted here.

## 15. Suggested per-character starter loadouts (core six + Wave 1)

Each character takes ~6–8 fitted cards (M=4 slots, 2/2/2 caps, so builds are forced choices). Suggested starting bundles (mix of existing + new):

- **Aang** (Avatar/Air): Air Blast, Air Shield, Air Scooter, Jet Burst, Cyclone, Spirit Projection, **Aang's Glider** (gear), Appa. (Avatar State is engine, not a card.)
- **Katara** (Water): Water Whip, Ice Bind, Healing Waters, Octopus Guard, Freeze Grenade, Water Recovery, Mist Veil.
- **Toph** (Earth): Earth Sweep, Earth Wall, Seismic Slam, Rock Armor, Raised Cover, Seismic Read, Earth Lance.
- **Zuko** (Fire): Rising Flame, Fire Lash, Fire Kick, Flame Cloak, Jet Burst, Rocket Flight, Blue Flame (if Agg 4+ after tuning).
- **Sokka** (Non-bender): Sokka's Feint, Precision Strike, Boomerang Toss, Trip Trap, Sword Flurry, Meteor Sword, **Sokka's Boomerang** + **Sokka's Sword** (gear), Momo.
- **Azula** (Fire): Blue Flame, Lightning Bolt, Fire Lash, Flame Cloak, Fire Sweep, Fire Kick.

Wave-1 LOK bundles (Korra, Mako, Bolin, Asami, Lin, Amon/Kuvira) pull from the same pools + their companions (Naga, Pabu) and signature gear (Metal Armband; Electro Glove and Combat Suit are cards/gear above).

## 16. Validation & next steps

1. **Add to `CARD_ECONOMY` + `CARD_DEFINITIONS`** as data; run `validateCardDefinitions()` — no TODOs, complete `rulesText`, unique `art`.
2. **Ship in waves** (roster v2 order): universal + cross tier first (broadest reuse), then core-six signature, then Wave-1/LOK + companions.
3. **Engine work gated by §5:** water impassability (Water Shoes), smoke `blocksSight`, lava + snare terrain ids, reaction window (Redirection), facing (`needsDirection`) for all line cards. Everything else is existing primitives.
4. **Playtest each element** has ≥1 focused attack, ≥1 defense, ≥1 positional/utility (roster v2 requirement) — satisfied above; verify mixed vs mono teams.
5. **Tune chi/energy** after playtests; the values here are reference tuning, not final (amendment: "numbers tunable").
