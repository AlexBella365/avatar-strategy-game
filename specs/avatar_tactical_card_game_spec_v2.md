# Avatar-Inspired Tactical Card Game

## Coding Agent Specification --- MVP v0.2

**Document status:** Revised implementation specification: grid movement, elemental terrain, targeting, and Avatar State\
**Purpose:** Build a playable, deterministic prototype of a turn-based
3v3 tactical card game inspired by the Avatar: The Last Airbender
universe.\
**Priority:** Correct, testable game rules and a clear UI over content
volume or visual polish.

> Use original implementation code and data. Treat this as an
> Avatar-inspired fan prototype; do not assume any official affiliation
> or license.

------------------------------------------------------------------------

## v0.2 Change Summary

This revision replaces the lane/front-rear battlefield with a 7×7 grid and introduces explicit orthogonal movement, grid range and line of sight, tile-level elemental terrain, directional/line/AoE targeting, deterministic forced movement, and the universal Evade reaction. Avatar State rules remain in place and must work with grid positioning, hazards, and AoE. Where older v0.1 wording conflicts with these grid rules, the v0.2 rules take precedence.

------------------------------------------------------------------------

## 1. Product Goal

Implement a tactical card battler in which each player controls three
characters. Players customize iconic characters with technique cards and
use a compact grid battlefield, movement, elemental terrain, focused
attacks, area-of-effect (AoE) attacks, reactions, status effects, and
character attributes to win.

The core design principle is:

**A technique's value depends on who uses it, where the target is, what
terrain is present, and what the opponent can do in response.**

The MVP should be small enough to play end-to-end and easy to extend
through data-driven cards.

### MVP success criteria

-   A complete match can be started, played, and resolved.
-   Each team has three characters.
-   The battlefield is a 7-column by 5-row grid with six characters occupying distinct tiles.
-   Cards can target a character, a tile, a direction, a line, or a defined area.
-   Focused and AoE attacks resolve differently and predictably.
-   Terrain can modify movement, targeting, damage, or status effects.
-   Character attributes and passives affect card resolution.
-   Both players can make meaningful choices each round.
-   The game can be tested without relying on animation timing.
-   Rules and card definitions are data-driven rather than hard-coded
    into UI components.

------------------------------------------------------------------------

## 2. Scope

### In scope

-   Local hot-seat / pass-and-play match against another human.
-   3v3 teams.
-   Turn-based rounds with alternating character activations.
-   A 7×7 grid with orthogonal movement and tile-level terrain.
-   Card hands, energy, focus, reactions, movement, terrain, statuses,
    damage, knockouts.
-   Small initial roster and card pool.
-   Simple battle log and legal-action validation.
-   Automated unit tests for core rules.

### Out of scope for MVP

-   Online multiplayer, matchmaking, accounts, persistence, progression
    economy.
-   Campaign, dialogue, quests, or story mode.
-   Booster packs, monetization, card rarity, deck collection systems.
-   Complex destructible terrain simulation.
-   Random hit chance, dice rolls, or real-time timing.
-   Large-scale animation or polished visual effects.
-   Avatar State, bloodbending, lightning redirection, and other
    exceptional powers unless explicitly added as later content.

Do not implement out-of-scope features preemptively.

------------------------------------------------------------------------

## 3. Match Setup

Each player selects a team of three characters and a legal loadout.

### Starting values

-   Maximum rounds: **8**
-   Team Energy per round: **4**
-   Starting Focus: **1 per character**
-   Focus cap: **4 per character**
-   Character attributes: integers from **1 to 5**
-   Battlefield: **7 columns × 5 rows**
-   Coordinates: columns `0..6`, rows `0..6`; row 0 is the top edge
-   Each team starts on its own two-row deployment zone at opposite ends
-   Each player draws from:
    -   A team tactical deck.
    -   A separate technique deck/hand for each character.
-   Each character begins at their maximum health.
-   Each character begins the match with no statuses, no Momentum, and
    no reaction used.

### Victory

A player wins immediately when all three opposing characters are knocked
out.

If both teams have survivors after round 8, compare: 1. Total remaining
health as a percentage of total maximum health. 2. Number of surviving
characters. 3. If still tied, declare a draw.

Do not use absolute remaining HP as the primary tiebreaker, because
characters can have different maximum health.

------------------------------------------------------------------------

## 4. Battlefield Model

### 4.1 Grid and coordinates

The battlefield is a fixed **7-column × 7-row** rectangular grid. Each tile is addressed by integer coordinates `{ x: 0..6, y: 0..6 }`. The board does not wrap at edges. Orthogonal neighbors share an edge; diagonal tiles are not adjacent unless a card explicitly says otherwise.

- Each tile can contain at most one living character across both teams.
- A tile may also contain terrain. Terrain occupancy is separate from character occupancy.
- Blocking terrain may make a tile unoccupiable; non-blocking terrain can share a tile with a character.
- Characters outside the board are never valid positions.
- Knocked-out characters are removed from occupancy immediately.
- Store positions as `{ x: number, y: number }`, not as lane/rank labels.

### 4.2 Deployment

For a standard match, Team A deploys in rows 0–1 and Team B in rows 5–6. Each team selects three distinct legal starting tiles in its deployment zone. Rows 2–4 begin neutral. The UI should offer sensible default starting positions, but the rules engine must validate any selected positions. Teams may not deploy on blocking terrain or on the same tile.

### 4.3 Distance and adjacency

Use Manhattan distance for standard movement and range:

`distance(a, b) = abs(a.x - b.x) + abs(a.y - b.y)`

- Orthogonal adjacent: Manhattan distance 1.
- Diagonal distance does not count as one step.
- A card may specify another range metric or shape, but must name it explicitly.
- Unless a card says otherwise, a range of N means Manhattan distance ≤ N, with line of sight checked separately when required.

### 4.4 Occupancy and movement legality

- A character cannot voluntarily enter an occupied tile, whether occupied by an ally or enemy.
- A character cannot move through occupied tiles or blocking terrain.
- Characters may move around blockers if a legal path exists within their movement allowance.
- A character cannot voluntarily move while `Bound`, unless an effect explicitly allows it.
- A movement card may grant movement, teleportation, swapping, or other exceptions only when defined in its data.
- Normal movement does not trigger attack reactions unless a card or reaction explicitly has an `onMovement` trigger.
- Forced movement is resolved by the displacement rules in Section 4.7 and does not spend the target's movement allowance.

### 4.5 Line of sight

Use a deterministic grid line algorithm (for example, Bresenham) for cards that require line of sight. A blocking tile blocks line of sight if it intersects the line between source and target, excluding the source tile. The target tile itself may be targeted even if it contains blocking terrain only if that terrain is targetable and the card permits it. The engine and UI preview must use the same line-of-sight function. Cards may declare `ignoresLineOfSight` or a specific exception.

### 4.6 Cover and engagement

- Cover is a tile or terrain property and must specify which attack classes it protects against.
- Cover reduces incoming damage by the amount defined by the terrain, after damage bonuses and before shields, unless the terrain data explicitly defines another order.
- There is no automatic front/rear protection in v0.2. Positioning, blocking terrain, range, line of sight, guard effects, and card-specific targeting determine protection.
- Melee techniques normally require an adjacent target. Ranged techniques use their stated range.

### 4.7 Forced movement: push, pull, swap, and collision

Forced movement is deterministic and resolved one tile at a time.

- **Push:** move the target away from the source along the card-defined direction. If direction is not specified, use the straight grid line from source to target; if that line is ambiguous, the card must specify a direction.
- **Pull:** move the target toward the source along the defined path.
- **Swap:** exchange two characters' positions only if the card permits swapping and both resulting positions are legal.
- A forced-movement path stops immediately before an occupied tile, blocking tile, or board edge.
- Unless a card explicitly defines collision damage or another collision effect, collision causes no extra damage or status.
- Forced movement triggers entry terrain effects for every tile entered, once per entry. It does not trigger voluntary-movement-only effects unless explicitly stated.
- A target cannot be forced outside the board. Remaining displacement distance is lost when movement stops.
- If an effect tries to move a character that has been knocked out earlier in the same resolution, ignore that movement effect.

------------------------------------------------------------------------

## 4A. Movement Rules

### 4A.1 Standard movement allowance

Each character may move up to **1 tile per activation**. Normal movement costs no Energy and is separate from the one-technique-per-activation limit. A character may move before or after playing a technique, but cannot exceed its total allowance for that activation. Cards may specify `moveBefore`, `moveAfter`, `bonusMovement`, `retreat`, `dash`, or `ignoreDifficultTerrain` effects.

- Each orthogonal tile entered costs 1 movement point.
- Diagonal movement is not allowed by default.
- Difficult terrain costs 2 movement points to enter; a character must have enough remaining movement points to pay the full cost.
- A character cannot end movement on an occupied or blocking tile.
- A character may voluntarily stop early.
- Unused movement does not carry over.
- Movement is resolved immediately when chosen; do not queue multiple destinations unless a card explicitly uses a path/charge effect.

### 4A.2 Agility and movement

Agility does not automatically increase the base movement allowance in the MVP, to keep the board and activation economy readable. Agility can qualify characters for movement techniques, improve evasion as defined in Section 6, or modify card-specific movement. If playtesting later adds an Agility movement bonus, implement it as a single explicit rule and update tests; do not infer it separately in UI code.

### 4A.3 Movement techniques

Movement can be an effect, an attack setup, or a defensive response. Example patterns include:

- **Air Step:** move up to 2 tiles, ignoring difficult terrain; does not pass through characters or blocking terrain.
- **Earth Charge:** move in a straight orthogonal line up to 2 tiles; if adjacent to an enemy at the end, apply the card's attack effect.
- **Water Rescue:** move to an adjacent ally and grant the card's stated protection or healing.
- **Fire Sweep:** move one tile and attack an adjacent target, with the attack resolved only if the destination is legal.
- **Earth Wall:** create blocking terrain on a legal tile within range.

These are examples of reusable effect patterns, not additional universal rules. Each card must declare path constraints, movement distance, whether it can cross difficult terrain, and what happens if the required destination is illegal.

### 4A.4 Universal Evade reaction

Each character may use **Evade at most once per round**. When the character becomes the target of an eligible focused attack and before damage is resolved, its controller may spend **1 Focus** to move it one tile to a legal, unoccupied, non-blocking orthogonal neighbor.

- Evade is optional and can be used only if the character has at least 1 Focus and a legal destination.
- Evade is unavailable while `Bound` or when the attack cannot be evaded.
- After movement, re-evaluate the attack's range, line of sight, and target validity using the post-movement position.
- If the attack is no longer legal against the character, it misses and its damage and on-hit effects do not apply to that character.
- If the attack remains legal, it resolves normally. Evade does not grant damage reduction by itself.
- Area attacks are not automatically avoided: if the character's new tile is within the final affected area, it is still hit.
- Tile-targeted attacks remain aimed at the chosen tile; moving away avoids them only if the new tile is outside the attack's affected area.
- Evade movement triggers terrain entry effects. If those effects knock the character out or end the match, stop resolving the original attack as appropriate.
- The once-per-round limit resets at round start. A character cannot use Evade after a match-ending condition has resolved.

Card-specific reactions may coexist with Evade, but the engine must enforce reaction timing, costs, and per-round limits without recursive reaction chains. No reaction may trigger another reaction unless a card explicitly enables that interaction; reaction chains are limited to one additional reaction depth in the MVP.

------------------------------------------------------------------------

## 5. Terrain

Terrain is represented at tile level. Each tile may have at most one primary terrain feature in the MVP, plus optional tags such as cover or elemental source. Terrain is data-driven and must not rely on free-form physics.

### 5.1 Tile properties

A tile may have any of these properties:

- `blocking`: cannot be entered and blocks line of sight.
- `difficult`: costs 2 movement points to enter.
- `cover`: provides the defined damage reduction against specified attack classes.
- `elementalSource`: empowers techniques of a matching element.
- `hazard`: applies a specified effect when entered or at a defined timing.
- `temporary`: has a duration and expires during the end-of-round phase.
- `destructible`: may be removed only by effects that explicitly allow it.

Every terrain definition must declare occupancy, movement cost, line-of-sight behavior, entry triggers, end-of-round triggers, duration, replacement rules, and which effects can remove it. Omitted fields must use documented safe defaults rather than implicit behavior.

### 5.2 Elemental terrain

#### Water source

- A water source is non-blocking unless its definition says otherwise.
- Water techniques used from the source tile or a tile orthogonally adjacent to it gain the `WaterSourceEmpowered` condition.
- The card must define the empowered effect. Default MVP effect: +1 base damage for an attack or +1 shield for a defensive card, applied at most once per card.
- Water sources do not automatically empower healing unless the card says so.
- A water technique may create ice if its card explicitly defines the target tile(s), duration, and properties.

#### Ice / frozen water

- Ice is normally traversable but counts as difficult terrain.
- A card may instead define ice as blocking or slippery; if so, it must define exact movement and displacement consequences.
- A character entering slippery ice becomes `OffBalance` only if the terrain definition explicitly specifies that trigger.
- Freezing or thawing replaces the existing terrain only when the card permits replacement.

#### Earth / rock

- Earth walls and rock formations may be blocking, cover-providing, or difficult terrain; each card must select the intended properties.
- Blocking earth prevents movement through its tile and blocks line of sight.
- Earthbending cards may create, move, or remove earth terrain only through explicit effects.
- Creating blocking terrain under a character is illegal unless the card explicitly defines a displacement or failure rule.

#### Fire / scorched ground

- Fire hazards are visible before a player commits to movement or a card.
- Each hazard defines whether it triggers on entry, at end of activation, or at end of round; default is once on entry per character per tile per action.
- Damage/status values and duration must be explicit.
- Fire does not spread automatically. Spread must be a defined card effect.
- Fire can be extinguished only by a card or terrain rule that explicitly permits it.

#### Air currents / open space

- Air currents are non-blocking terrain modifiers.
- They may modify forced-movement distance or a card's movement, but must state direction and magnitude.
- Open space has no special effect by default. Do not treat an empty tile as a wind/current effect.

#### Generic cover and hazards

- Cover applies only to attack classes named in the terrain data. MVP default: reduce ranged single-target damage by 1, not below 0; it does not reduce melee or AoE damage unless specified.
- Generic hazards use the same explicit trigger and duration model as elemental hazards.

### 5.3 Terrain lifecycle and ordering

- Terrain may be present at setup or created by a card.
- Each terrain instance has a stable ID, `remainingRounds` or permanent duration, tags, and typed effect data.
- At end of round, resolve character end-of-round effects first, then terrain end-of-round effects, then decrement temporary terrain duration and remove expired terrain. If a terrain's data explicitly declares another trigger, use that trigger instead.
- A card may replace existing terrain only if its data includes an explicit replacement policy.
- When multiple terrain effects trigger from one movement, resolve them in path order, one tile entry at a time. Within one tile, sort triggers by stable terrain instance ID unless the card defines a priority.
- Terrain resolution must be deterministic and recorded in the battle log.

------------------------------------------------------------------------

## 6. Characters and Attributes

Each character has:

``` ts
type AttributeSet = {
  aggression: number;  // 1..5
  perception: number;  // 1..5
  agility: number;     // 1..5
  discipline: number;  // 1..5
  resilience: number;  // 1..5
};

type CharacterState = {
  id: string;
  definitionId: string;
  ownerId: string;
  health: number;
  maxHealth: number;
  focus: number; // 0..4
  position: Position;
  statuses: StatusInstance[];
  passiveUsesThisRound: Record<string, number>;
  reactionUsedThisRound: boolean;
  activatedThisRound: boolean;
  momentum: number; // temporary; default 0
  avatarState?: AvatarStateStatus; // present only for Avatar-capable characters
};
```

### Attribute definitions

-   **Aggression:** increases damage from attacks.
-   **Perception:** supports attack reads, precision, and counters.
-   **Agility:** supports evasion, movement, and initiative-related card
    effects.
-   **Discipline:** supports limited energy efficiency and advanced
    technique requirements.
-   **Resilience:** determines health and resistance to disruption.

### Health formula

For a character definition with Resilience `RES`:

`maxHealth = 16 + 2 * (RES - 3)`

Clamp to at least 10 HP. A character definition may override the result
with a fixed health value if the override is explicit.

### Attribute damage modifier

For an attack with base damage `B`:

`aggressionModifier = clamp(floor((AGG - 3) / 2), -1, +1)`

`rawDamage = max(0, B + aggressionModifier + cardDamageModifier)`

This modifier applies only to cards with `scalesWithAggression: true`.
Default false for support, healing, terrain creation, and pure control
cards.

### Attack vs. evasion

Do not use random hit rolls.

For cards that allow evasion:

-   `attackScore = attacker.perception + card.accuracyModifier`
-   `evasionScore = defender.agility + reaction.evasionModifier`
-   If `evasionScore > attackScore`, avoid the attack's damage and
    on-hit effects.
-   If scores are equal, the attack deals base damage but does not apply
    its optional secondary status.
-   If `attackScore > evasionScore`, resolve the attack normally.

Cards can specify `cannotBeEvaded: true`, `tracking: true`, or
`requiresReaction: true`. These flags must have clear semantics.

For the MVP, avoid hidden hit chances and random critical hits.

### Discipline benefit

Once per round, a character with Discipline 4 or 5 may reduce the Energy
cost of one technique costing 2 or more by 1, to a minimum of 1.

-   This benefit is once per character per round.
-   It does not stack with other discounts.
-   Track whether the benefit was used.
-   Do not apply it to reactions unless a card explicitly allows it.

### Attribute budgets

Starting character definitions should generally total 16--18 attribute
points. Each attribute is 1--5. This is a balancing guideline, not a
runtime validation requirement.

------------------------------------------------------------------------

## 7. Resources

### 7.1 Team Energy

-   Each player starts every round with 4 Energy.
-   Energy refreshes to exactly 4 at the beginning of each round.
-   Energy does not carry over.
-   Energy is shared by all three characters on that team.
-   Cards must be affordable before they can be played.
-   Pay costs when the card is committed, before resolving its effects.
-   If a card is canceled after payment, costs are not refunded unless
    the card explicitly says so.
-   Energy cannot fall below zero.

### 7.2 Focus

-   Each character begins with 1 Focus.
-   Focus is an integer from 0 to 4.
-   Focus is gained from passives, card effects, and explicit game
    rules.
-   Focus cannot exceed 4; excess gains are discarded.
-   Focus is spent only by effects that explicitly list a Focus cost.
-   Focus belongs to a character and cannot be transferred unless an
    effect explicitly permits it.

### 7.3 Momentum

Momentum is a temporary integer marker, normally 0 or 1.

-   A card may grant Momentum after a successful setup, counter, or
    combo.
-   Momentum normally expires at end of round.
-   A card may consume Momentum for a bonus.
-   A character can hold at most 1 Momentum in MVP.
-   Momentum does not persist after a knockout.

------------------------------------------------------------------------

## 8. Turn and Round Structure

### Phase 1: Round start

In deterministic order:

1.  Increment round number.
2.  Reset each player's Energy to 4.
3.  Reset each living character's `activatedThisRound`,
    `reactionUsedThisRound`, and per-round passive counters.
4.  Resolve start-of-round status effects.
5.  Resolve start-of-round terrain effects.
6.  Draw cards to each hand's target size.
7.  Each player secretly chooses one intention for each living
    character.

If a character is knocked out during round-start effects, it does not
receive an intention.

### Phase 2: Intentions

Each living character receives one hidden intention:

-   `Attack`
-   `Defend`
-   `Reposition`
-   `Prepare`

Intention effects:

-   **Attack:** no intrinsic bonus; indicates offensive commitment.
-   **Defend:** the character's first defensive reaction this round
    gains +1 to its relevant defense score or shield value.
-   **Reposition:** the character's first movement this round may move
    one additional tile, but still cannot enter an occupied or blocking tile.
-   **Prepare:** gain 1 Focus when activated, subject to the Focus cap.

Intentions are revealed when that character activates. Intention choice
does not force the player to use a particular card.

### Phase 3: Alternating activations

Players alternate activating one unused living character.

-   The player with initiative chooses the first character.
-   Initiative alternates between players each round.
-   An activated character may perform one movement action and play up
    to one technique card.
-   The player may perform movement before or after playing a card
    unless the card specifies timing.
-   A character may pass its activation, but still counts as activated.
-   A character that is knocked out before activating cannot activate.
-   The round ends when all living characters on both teams have
    activated or are unable to activate.

### Phase 4: Technique resolution

When a card is played:

1.  Validate ownership, target legality, timing, resources, and required
    attributes.
2.  Pay Energy and Focus costs.
3.  Lock the target selection.
4.  Open a reaction window if the card is reactable.
5.  Resolve evasion or other legal reaction.
6.  Resolve primary effects.
7.  Resolve secondary effects and statuses.
8.  Resolve terrain changes and displacement.
9.  Check knockouts.
10. Record all changes in the battle log.

Use a consistent effect-resolution order. A card must not partially
resolve and then silently re-target if its original target becomes
invalid. If all targets become invalid before resolution, the card
fizzles after costs are paid, unless its definition says otherwise.

### Phase 5: End of round

1.  Resolve end-of-round damage/healing/status effects.
2.  Remove expired statuses.
3.  Remove expired terrain.
4.  Remove Momentum.
5.  Check victory.
6.  If no winner and round \< 8, begin next round.
7.  If round 8 has ended, resolve tiebreakers.

------------------------------------------------------------------------

## 9. Card Data Model

Card definitions must be data-driven. Do not hard-code card IDs into the
combat engine.

Suggested TypeScript model:

``` ts
type Position = { x: number; y: number };
type Direction = "north" | "east" | "south" | "west";
type AllegianceFilter = "enemies" | "allies" | "all" | "selfAndAllies";

type Targeting =
  | { kind: "self" }
  | { kind: "character"; allegiance: AllegianceFilter; range: number | "melee" | "any"; requiresLineOfSight?: boolean }
  | { kind: "tile"; range: number | "any"; allowsOccupiedTile: boolean }
  | { kind: "direction"; maxLength: number; directions: Direction[] }
  | { kind: "area"; shape: "singleTile" | "plus" | "line" | "rectangle" | "radiusManhattan" | "sourceAndAdjacent" | "allEnemies"; allegiance: AllegianceFilter; maxRange?: number; radius?: number; width?: number; height?: number; maxLength?: number; requiresLineOfSight?: boolean };

type MovementEffect = {
  timing: "beforeTechnique" | "afterTechnique" | "insteadOfTechnique";
  maxSteps: number;
  path: "orthogonal" | "straightOrthogonal" | "teleport";
  ignoresDifficultTerrain?: boolean;
  destinationRule: "mustBeLegal" | "stopBeforeIllegal" | "fizzle";
};

type TerrainEffect = {
  terrainId: string;
  target: "targetTile" | "pathTiles" | "areaTiles";
  durationRounds: number | "permanent";
  replacementPolicy: "replace" | "fail" | "preserveExisting";
};

type CardEffect =
  | { type: "damage"; amount: number; scalesWithAggression?: boolean }
  | { type: "heal"; amount: number }
  | { type: "shield"; amount: number; duration?: "untilNextRound" | "untilConsumed" }
  | { type: "applyStatus"; statusId: string; duration: number }
  | { type: "removeStatus"; statusId: string }
  | { type: "move"; steps: number; direction?: Direction | "chosen" | "awayFromSource" | "towardSource" }
  | { type: "push"; steps: number; direction?: Direction | "awayFromSource" }
  | { type: "pull"; steps: number; direction?: Direction | "towardSource" }
  | { type: "swap"; target: "ally" | "enemy" }
  | { type: "createTerrain"; terrainId: string; duration: number | "permanent"; replacementPolicy: "replace" | "fail" | "preserveExisting" }
  | { type: "gainFocus"; amount: number }
  | { type: "gainMomentum"; amount: number }
  | { type: "draw"; count: number; hand: "character" | "team" }
  | { type: "disrupt"; amount: number };

type CardDefinition = {
  id: string;
  name: string;
  cardType: "attack" | "defense" | "setup" | "support" | "reaction";
  element?: "air" | "water" | "earth" | "fire" | "nonbender";
  energyCost: number;
  focusCost: number;
  targeting: Targeting;
  movement?: MovementEffect;
  terrainEffects?: TerrainEffect[];
  tags: string[];
  effects: CardEffect[];
  reactionWindow?: "beforeDamage" | "afterTargeting" | "onMovement";
  canBeEvaded?: boolean;
  requiresAttributes?: Partial<AttributeSet>;
  rulesText: string;
};
```

The model is a starting point. Adapt it to the project architecture, but
preserve the separation between card data, target validation, and effect
resolution.

### Card design constraints

-   Prefer 1--3 effects per card.
-   Every movement effect must define distance, path constraints, timing, and illegal-destination behavior.
-   Every terrain effect must define affected tile(s), properties, duration, and replacement policy.
-   Every attack must declare whether it targets a character, tile, direction, line, or area.
-   Every effect must have explicit target scope.
-   A card's target pattern must be visible before play.
-   Use tags for synergies rather than card-name-specific checks.
-   Card definitions should be validated at startup or in tests.
-   Invalid card data should produce a useful error message.

------------------------------------------------------------------------

## 10. Targeting: Focused Attacks, AoE, and Defenses

Targeting is a core rules feature. The engine owns target legality and affected-tile/character calculation. UI previews must call the same pure functions used by actual resolution.

### 10.1 Targeting modes

#### Focused character target

- Select one living character that satisfies range, line of sight, allegiance, and status restrictions.
- Resolve effects against that character only.
- The target must still be legal when the card resolves, after any reaction window.

#### Tile target

- Select a legal tile, whether empty or occupied, as specified by the card.
- Tile-targeted attacks affect the tile/shape rather than following a character that moves away.
- Cards must define whether they affect characters entering the tile before resolution, and whether blocking terrain can be targeted.

#### Melee and ranged

- Melee normally requires Manhattan distance 1 from source to target.
- Ranged cards define a maximum Manhattan range and whether line of sight is required; ranged attacks require line of sight by default.
- A card may explicitly ignore line of sight, blocking terrain, or a range restriction.

#### Directional / line attack

- A directional attack chooses one of four orthogonal directions unless the card explicitly allows diagonal direction.
- A line attack affects tiles along that direction up to a declared length.
- The card must declare whether the first blocking tile stops the attack and whether it can affect multiple characters in the same line.

#### Area of effect (AoE)

Supported shapes should be represented as data, not bespoke UI logic:

- `singleTile`
- `plus` (origin tile and orthogonal neighbors)
- `line` (direction plus maximum length)
- `rectangle` (declared width/height and orientation)
- `radiusManhattan` (all tiles within a declared Manhattan radius)
- `sourceAndAdjacent` (source tile and orthogonal neighbors)
- `allEnemies` (special global shape; use sparingly)

Every AoE card must define: shape parameters; allegiance filter (`enemies`, `allies`, `all`, `selfAndAllies`); whether source tile is included; maximum range to the chosen center; whether line of sight applies; whether blocking tiles stop propagation; whether occupants behind blockers are affected; and per-target damage/effect behavior. Default AoE damage is applied independently to every affected target, not divided among targets. Balance AoE with lower damage, higher Energy cost, limited range, or counterplay.

#### Focused defense and area defense

Defenses may target a character, tile, or area. A defense must define what it prevents (damage, status, displacement, or a named effect), duration, capacity, and whether it can protect against AoE. A shield does not prevent displacement or statuses unless its data explicitly says so.

### 10.2 Target calculation and resolution

- Resolve the chosen target shape into an ordered list of affected tiles, then map those tiles to eligible characters.
- Use stable ordering: sort affected tiles by row (`y`) then column (`x`), unless the card declares another order. Resolve characters on those tiles in that order.
- Re-check legality after reactions and movement. If a character-targeted attack loses its legal target, it misses that target. If a tile-targeted attack remains valid, resolve it against the chosen tile/shape.
- Check blocking terrain and line of sight with shared pure functions.
- For AoE, resolve each target independently. If an effect ends the match, stop immediately and do not process later targets.
- Target previews must show all affected tiles, affected characters, blocked tiles, and reasons for invalid targets before confirmation.
- A target may not be affected twice by the same effect instance unless the card explicitly says so.

------------------------------------------------------------------------

## 11. Status Effects

Implement a small, extensible status registry.

### Required MVP statuses

#### OffBalance

-   The next displacement effect against this character moves them one
    additional step, if legal.
-   Removed after that displacement triggers or at end of next round.
-   Does not stack; reapplication refreshes duration.

#### Exposed

-   The next successful focused attack against this character deals +1
    damage.
-   Removed after triggering or at end of next round.
-   Does not stack; reapplication refreshes duration.

#### Bound

-   Character cannot move voluntarily.
-   Removed by a card that cleanses Bound, or when its duration expires.
-   Does not prevent forced movement unless the source explicitly says
    it does.

#### Exhausted

-   Character's next technique costs +1 Energy, maximum one additional
    Energy.
-   Removed after the next technique is played or at end of next round.
-   If the team cannot pay the increased cost, that technique cannot be
    played.

Status rules must define duration, stacking, trigger timing, and removal
conditions. Avoid status logic scattered across UI components.

------------------------------------------------------------------------

## 12. Synergy System

Use tags and conditional effects.

Initial tags: - `Displace` - `Expose` - `Bind` - `Guard` - `Redirect` -
`Charge` - `FollowUp` - `Interrupt` - `Ranged` - `Melee` - `AoE` -
`Terrain` - `WaterSourceEmpowered`

### Combo rules

-   A character can benefit from at most one `FollowUp` bonus per round.
-   A character can hold at most one Momentum.
-   Repeated displacement from the same action chain cannot trigger
    repeatedly against the same target.
-   Combo conditions must be evaluated at the point the card resolves.
-   Do not check for named card IDs in generic synergy code.
-   A combo must have counterplay: reaction, movement, guard,
    interruption, or a resource cost.

Example: 1. Earth Sweep applies `OffBalance` and `Displace`. 2. Air
Blast gains a bonus against `OffBalance` and displaces the target. 3.
Rising Flame gains +1 damage against a target displaced this round.

The engine should track per-round events/tags on a character or in a
round event log, so "displaced this round" can be checked without
relying on UI history.

------------------------------------------------------------------------

## 12A. Avatar State --- High-Risk Transformation

Avatar State is a unique mechanic for characters explicitly marked as
Avatars. It is not a normal buff and must not be available to ordinary
benders or nonbenders. The MVP should implement the mechanic for Aang,
while keeping its rules generic enough to support future Avatar
characters.

### Design goals

-   Avatar State is powerful enough to change the tactical situation.
-   Players must build toward it through deliberate play, not simply
    wait a fixed number of rounds.
-   The opponent can see the buildup and has opportunities to react.
-   Activation is a strategic commitment with a meaningful opportunity
    cost.
-   If an Avatar is knocked out while Avatar State is active, that
    Avatar's player loses the match immediately, even if allies remain
    alive.
-   The Avatar State does not trigger automatically when its meter
    fills.

### 12A.1 State and meter

Add to Avatar-capable character definitions:

``` ts
type AvatarStateDefinition = {
  enabled: boolean;
  threshold: number;            // MVP: 6
  maximum: number;              // MVP: 6
  durationRounds: number;       // MVP: 2
  activationFocusCost: number;  // MVP: 2
  damageBonus: number;          // MVP: +1
  shieldBonus: number;          // MVP: +1 to eligible defensive cards
};
```

Add to character instance state:

``` ts
type AvatarStateStatus = {
  resonance: number;            // 0..maximum
  active: boolean;
  roundsRemaining: number;
  activatedThisMatch: boolean;
};
```

Non-Avatar characters must not have a usable Resonance meter. Do not
represent ordinary Focus as Avatar Resonance; they are separate
resources.

### 12A.2 Building Resonance

Aang starts the match with 0 Resonance. Resonance is visible to both
players.

Gain Resonance from deliberate, skill-expressive actions:

-   **Elemental practice:** the first time each round Aang successfully
    resolves a technique from a distinct element, gain 1 Resonance, up
    to 2 Resonance per round. The two techniques must have different
    element tags.
-   **Protective instinct:** the first time each round Aang prevents
    damage to an ally with a defensive technique or reaction, gain 1
    Resonance.
-   **Spiritual pressure:** the first time each round Aang loses at
    least 3 HP from one enemy action, gain 1 Resonance.

Limits: - Total Resonance gained by these triggers is capped at 2 per
round. - A single event can trigger only one Resonance gain. - Resonance
cannot exceed the character's threshold. - Resonance gain is suppressed
while Avatar State is active. - Gaining Resonance must be recorded in
the battle log with its trigger reason. - Do not award Resonance merely
for passing, repeating a free action, or targeting an ally with a
technique that has no meaningful effect.

This encourages varied elemental use and protection while avoiding a
strategy that farms meter through repeated low-value actions.

### 12A.3 Activation

Avatar State can be activated only when all of the following are true:

-   The character is Avatar-capable.
-   Resonance equals the threshold.
-   The character is alive and has not activated Avatar State earlier in
    this match.
-   The character is activating on its own activation, not during a
    reaction.
-   The player can pay the activation Focus cost (MVP: 2 Focus).

Activation: 1. Spend 2 Focus. 2. Set `active = true`. 3. Set
`roundsRemaining = 2`. 4. Mark `activatedThisMatch = true`. 5. Clear
Resonance to 0. 6. Emit an `AvatarStateActivated` event. 7. Apply the
transformation immediately, before the character plays its technique for
that activation.

Activation consumes the character's technique play for that activation:
the character may move, but cannot play a technique card in the same
activation. This creates a visible timing cost and gives the opponent a
chance to respond before the Avatar's empowered turns begin.

The opponent is notified immediately when Avatar State activates. Do not
conceal the activation or its duration.

### 12A.4 Avatar State effects

While active:

-   Attacks that deal damage gain +1 damage after normal attribute and
    card modifiers, before mitigation.
-   Defensive cards played by the Avatar grant +1 additional shield or
    damage reduction, as appropriate. This bonus applies only once per
    card, not once per target.
-   Avatar-tagged cards may unlock an enhanced effect if the card
    explicitly defines one.
-   The Avatar may use techniques of any element for which it has an
    equipped card. Avatar State does not grant cards that are absent
    from its build.
-   AoE attacks remain subject to their normal target shape, terrain,
    allegiance filter, line-of-sight, and reaction rules. Avatar State does not bypass
    these rules unless a card explicitly says so.
-   The general damage bonus applies to each target hit by an AoE, so
    AoE cards should have lower base damage or higher costs.
    Card-specific balance tests must cover this.
-   Avatar State does not grant extra activations, extra reactions, free
    Energy, or immunity to control effects.

Avatar State is meant to amplify the existing build, not erase the
normal combat system.

### 12A.5 Duration and ending

-   Avatar State lasts for two rounds, including the round in which it
    is activated.
-   At each end-of-round phase, decrement `roundsRemaining` if Avatar
    State is active.
-   When it reaches zero, set `active = false` and emit
    `AvatarStateEnded`.
-   It can also end early if an explicit card effect says it ends; the
    MVP has no such card by default.
-   Resonance remains at 0 after it ends.
-   Avatar State cannot be activated more than once per match.
-   If the match ends while it is active, normal victory resolution
    takes precedence.

The activation round's technique restriction applies only to the
activation itself. In later activations during the duration, the Avatar
can use techniques normally.

### 12A.6 Existential risk and defeat condition

**If a character with active Avatar State is knocked out, its player
loses the match immediately.**

-   Check this condition immediately after any damage or effect that
    reduces the Avatar's health to 0 or below.
-   The defeat condition applies regardless of whether the knockout was
    caused by direct damage, AoE, terrain, status damage, or another
    effect.
-   Resolve the match loss before continuing to resolve later
    targets/effects in the same action. The action stops once the match
    is over.
-   A shield or reaction that prevents the knockout prevents the loss
    condition.
-   The Avatar cannot be revived after this defeat condition has
    triggered; the match has already ended.
-   Knocking out an Avatar before Avatar State activates does not cause
    an automatic loss, unless a future scenario explicitly defines that
    rule.
-   The UI must clearly warn both players that defeating the active
    Avatar ends the match.

This rule must be implemented in the authoritative victory checker, not
only in UI code.

### 12A.7 Counterplay and fairness

The opponent must have meaningful ways to respond to activation:

-   The activation consumes the Avatar's technique play for that
    activation.
-   The transformation lasts only two rounds.
-   The Avatar remains vulnerable to positioning, blocking terrain, hazards, status effects, and focused attacks.
-   AoE can pressure the Avatar's allies, forcing the Avatar player to
    choose between offense and protection.
-   The opponent can use Guard, Bind, displacement, or interruption
    effects if their cards legally permit them.
-   Avatar State cannot be interrupted after activation unless a card
    explicitly says it can be; ordinary damage does not cancel it.
-   The active Avatar's health and state indicator must be prominent.

Do not make the Avatar immune to all status effects. If control effects
could completely prevent play for the entire duration, however, add
explicit duration limits or a once-per-activation resistance rule after
playtesting.

### 12A.8 UI requirements

-   Display Resonance as a clearly labeled meter, such as
    `Resonance 4/6`.
-   Show which actions can generate Resonance in card text or a concise
    trigger tooltip.
-   At threshold, show that Avatar State is ready, but do not
    auto-activate it.
-   Before activation, display the Focus cost, activation-turn
    restriction, two-round duration, damage/defense bonuses, and
    instant-loss risk.
-   While active, show a persistent and unmissable `AVATAR STATE`
    indicator and remaining duration.
-   Show a warning on all players' UI:
    `If this Avatar is knocked out, their team immediately loses.`
-   Log Resonance gains, activation, duration changes, ending, and
    defeat-by-Avatar-knockout.

### 12A.9 Required tests

-   Non-Avatar characters cannot gain or activate Avatar State.
-   Resonance triggers at most 2 times per round.
-   Repeated use of the same element does not trigger the
    distinct-element gain twice.
-   Resonance cannot exceed 6.
-   Activation requires threshold Resonance, 2 Focus, a living Avatar,
    and an unused activation.
-   Activation spends Focus, resets Resonance, and consumes the
    technique play for that activation.
-   Avatar damage bonus applies once per affected target and stacks in
    the specified order with other modifiers.
-   Avatar defensive bonus applies once per card.
-   Duration counts down correctly and Avatar State cannot be activated
    a second time.
-   Knockout of an active Avatar immediately ends the match in favor of
    the opponent.
-   Knockout of an inactive Avatar does not trigger the special loss
    condition.
-   An AoE that knocks out an active Avatar ends the match immediately
    and does not continue applying later effects.
-   A shield or reaction that prevents the knockout prevents the special
    loss condition.
-   UI preview and battle log accurately communicate the risk and
    duration.

## 13. Starter Content

Implement at least six characters and twelve cards for the first
playable version. Prefer a compact, balanced roster over broad content.

### Suggested character definitions

-   **Aang:** high Agility and Perception; evasive control; passive
    grants Focus after a successful evasion, once per round.
-   **Katara:** balanced Perception and Discipline; water control,
    healing, and binding.
-   **Toph:** high Perception and Resilience; terrain shaping, defensive
    counters, and disruption.
-   **Zuko:** high Aggression; offensive chains and guard-breaking.
-   **Sokka:** nonbender; tactical support, weapons, feints, and traps.
-   **Azula:** high Aggression and Discipline; precise pressure and
    charged attacks.

These are initial test characters, not definitive canon power rankings.

### Required sample cards

1.  **Earth Sweep** --- focused melee attack; 2 base damage; applies
    OffBalance.
2.  **Air Blast** --- focused ranged/control attack; 2 base damage;
    gains a bonus against OffBalance.
3.  **Rising Flame** --- focused attack; 3 base damage; +1 damage
    against a target displaced this round.
4.  **Water Whip** --- focused ranged attack; 2 base damage; may pull or
    displace the target if the card condition is met.
5.  **Air Shield** --- area defense; protects the source and orthogonally adjacent allies against the next ranged attack.
6.  **Earth Wall** --- creates terrain/barrier that blocks specified
    ranged attacks.
7.  **Fire Sweep** --- directional or plus-shaped AoE; lower damage than a focused attack.
8.  **Ice Bind** --- focused control; applies Bound if the target is
    already OffBalance or if another explicit condition is met.
9.  **Sokka's Feint** --- nonbender setup; applies Exposed or baits a
    reaction.
10. **Precision Strike** --- focused attack with a Perception
    requirement or bonus.
11. **Water Recovery** --- heals one ally; may remove one status if the
    card explicitly allows it.
12. **Seismic Read** --- reveals or predicts a target's intention;
    grants Focus or improves a counter.

Each card must have complete, validated data including cost, targeting,
effects, tags, and readable rules text. Do not leave TODO placeholders
in cards required to complete the MVP.

------------------------------------------------------------------------

## 14. User Interface Requirements

The interface must expose tactical information clearly without relying on color or animation to communicate rules.

### Battlefield view

- Render a 7×7 grid with coordinate-consistent tiles.
- Show deployment zones before match start.
- Show each character's portrait, health, Focus, statuses, activation state, and Evade availability.
- Distinguish blocking terrain, difficult terrain, cover, elemental sources, and hazards with icons plus labels/tooltips.
- Show remaining Team Energy and active Avatar State duration/risk.
- During movement selection, highlight reachable tiles and show path cost; distinguish legal, occupied, blocked, hazardous, and difficult tiles.
- When forced movement is previewed, show the path and where it will stop due to occupancy, blockers, or board edge.

### Hand and targeting

- Separate character technique hands from the team tactical hand.
- Display card cost, target mode, range, line-of-sight requirement, tags, movement, terrain effects, and concise rules text.
- On card selection, highlight legal target characters or tiles.
- For line/AoE effects, preview all affected tiles and characters, including obstruction behavior.
- Show why a target is illegal (range, line of sight, occupied destination, blocking terrain, Bound, insufficient resource, etc.).
- When an eligible focused attack targets a character, show the Evade reaction option and its 1 Focus cost if available.
- Confirm irreversible or high-impact actions where appropriate, but avoid unnecessary confirmation dialogs for ordinary movement.

### Battle log

Record card plays, costs, target selection, affected tiles, movement paths, forced movement stops, terrain triggers/creation/removal, damage, healing, shields, statuses, reaction use, Avatar State changes, knockouts, and victory. The log must explain why movement or an attack failed or stopped.

### Accessibility and clarity

- Do not communicate range, target shapes, statuses, or terrain only by color.
- Use icons plus text labels for attack class, target shape, and terrain properties.
- Keep rules-relevant information readable at the target viewport size.
- Animations must not affect game state or the order of resolution.

------------------------------------------------------------------------

## 15. Architecture Requirements

Separate the game into clear modules. Adapt names to the existing
codebase if one exists.

Suggested modules:

-   `game/types` --- types and enums.
-   `game/state` --- match state, initialization, cloning/immutable
    updates.
-   `game/rules/targeting` --- legal targets and affected-area
    calculation.
-   `game/rules/movement` --- movement and displacement.
-   `game/rules/damage` --- damage, shields, mitigation, healing.
-   `game/rules/statuses` --- application, duration, triggers, removal.
-   `game/rules/terrain` --- terrain creation and interaction.
-   `game/rules/cards` --- card validation and effect resolution.
-   `game/rules/turns` --- round phases, activation, initiative, end
    conditions.
-   `game/content/characters` --- data-driven character definitions.
-   `game/content/cards` --- data-driven card definitions.
-   `game/ai` --- optional basic opponent policy, only after local
    two-player flow works.
-   `ui` --- rendering, input, previews, and battle log.

### State management

-   Keep game state as serializable data where practical.
-   Implement actions as explicit commands/events.
-   Use one authoritative rules engine for all game mutations.
-   The UI must not directly mutate health, resources, statuses, or
    positions.
-   Provide a reducer/command API such as
    `applyGameAction(state, action) -> { state, events, errors }`.
-   Invalid actions must not partially mutate the state.
-   The same input state and action must always produce the same output.
-   Use stable IDs for character instances, card instances, terrain
    instances, and status instances.

### Event model

Events should be descriptive and testable, e.g.: - `CardPlayed` -
`EnergySpent` - `FocusGained` - `TargetEvaded` - `DamageDealt` -
`StatusApplied` - `CharacterMoved` - `TerrainCreated` -
`CharacterKnockedOut` - `RoundEnded` - `MatchWon`

Events are for logs, UI effects, and debugging. They should not become a
second competing source of truth.

------------------------------------------------------------------------

## 16. Validation and Error Handling

Reject invalid actions with a structured result rather than throwing
during ordinary gameplay.

Examples: - Insufficient Energy. - Insufficient Focus. - Character
already activated. - Character knocked out. - Card not in hand. -
Illegal target. - Target out of range or blocked by line of sight. - Movement destination occupied or blocked. - Character Bound. - Card requires an
attribute threshold. - Reaction already used this round.

Errors should include a stable code and a player-readable message.
Invalid actions must leave the state unchanged.

------------------------------------------------------------------------

## 17. Testing Requirements

Automated tests are required for all core rules. Prefer table-driven unit tests for geometry and effect resolution.

### Battlefield and movement tests

- Board bounds and deployment legality.
- Manhattan distance and orthogonal adjacency.
- Legal movement paths, movement allowance, difficult-terrain costs, and path obstruction.
- Cannot move through occupied tiles or blocking terrain.
- Cannot end movement on occupied or blocking tiles.
- Bound prevents voluntary movement.
- Knockout removes a character from occupancy immediately.
- Forced movement stops at blockers, occupied tiles, and board edges.
- Swap succeeds only when both destinations are legal.
- Terrain entry triggers once per tile entry and in deterministic order.
- Evade moves one tile, spends 1 Focus, and is limited to once per character per round.
- Evade is unavailable when Bound, without Focus, or without a legal destination.
- Evade causes a focused attack to miss only when the post-move target is no longer legal.
- AoE still hits an evading character if its new tile remains affected.

### Targeting tests

- Focused attacks affect exactly one legal target.
- Melee range, ranged range, and line-of-sight checks work at board edges and around blockers.
- Directional/line attacks stop or continue at obstacles according to card data.
- Each supported AoE shape returns exactly the expected tiles.
- Allegiance filters work correctly.
- Tile-targeted attacks resolve at the selected tile after a target moves away.
- Character-targeted attacks re-check legality after reactions.
- Target previews and actual resolution use the same affected-tile and target functions.
- A target cannot be affected twice by one effect instance unless explicitly allowed.

### Terrain tests

- Water Source bonus applies at the correct distance and only once per card.
- Terrain creation, replacement, blocking, difficult movement, cover, hazards, and expiry follow data definitions.
- Fire/hazard triggers resolve at the declared timing.
- Terrain does not spread, disappear, or change properties without an explicit effect.
- Terrain trigger ordering is deterministic when multiple effects apply.

### Resource tests

- Energy refreshes to 4 each round and does not carry over.
- Focus cannot exceed 4 or fall below 0.
- Discipline discount applies once per character per round.
- Evade spends Focus only when successfully declared and legal.
- Failed actions do not spend resources or partially mutate state.

### Resolution tests

- Damage modifiers, cover, shields, and mitigation resolve in the specified order.
- Attack/evasion score tie behavior follows Section 6.
- Reactions respect timing and per-round limits; reaction chains cannot recurse indefinitely.
- Knockout is checked immediately after damage or terrain effects.
- A match-ending effect stops further target/effect resolution.
- Victory ends the match.

### Status, synergy, and Avatar State tests

- Status duration, stacking, and removal.
- OffBalance, Exposed, Bound, and Exhausted trigger correctly.
- FollowUp bonus triggers at most once per character per round.
- Momentum cap and expiration.
- Displacement events are tracked for the current round without card-name checks.
- Avatar State requirements, Resonance gains/cap, activation cost, duration, bonuses, and once-per-match limit.
- Knockout of an active Avatar immediately ends the match; knockout of an inactive Avatar does not trigger the special loss condition.

### End-to-end tests

- Start a match, play at least two rounds, and resolve a knockout.
- A match can end by full knockout or round-8 tiebreaker.
- A complete sample combo with movement, terrain, displacement, and an AoE resolves as specified.
- Replaying the same action sequence produces the same state and event sequence.

------------------------------------------------------------------------

## 18. Implementation Order

Implement in this order, and keep the app runnable at each step.

1.  **Types and state:** grid coordinates, characters, cards, resources, terrain, statuses.
2.  **Pure geometry functions:** board bounds, Manhattan distance, adjacency, pathfinding, movement cost, line of sight, target shapes.
3.  **Movement and terrain:** occupancy, normal movement, Evade, push/pull/swap, terrain entry and expiry.
4.  **Card resolution:** focused and tile-targeted cards, directional/line attacks, AoE, reactions, terrain and statuses.
5.  **Round loop:** refresh, intentions, alternating activations, end-of-round effects, victory.
6.  **Minimal UI:** grid board, movement/path previews, hands, target previews, Energy/Focus, terrain labels, battle log.
7.  **Starter content:** six characters and twelve complete cards.
8.  **Automated tests:** geometry, movement, terrain, reactions, Avatar State, then end-to-end flows.
9.  **Polish:** onboarding, animations, AI opponent, and additional content only after the rules are stable.

Do not start with elaborate animations or a large card library.

------------------------------------------------------------------------

## 19. Acceptance Criteria

The MVP is complete when:

-   [ ] A local match can be started with two teams of three.
-   [ ] All six characters occupy valid, non-overlapping tiles on the 7×7 grid.
-   [ ] Each round refreshes Energy and resets per-round flags
    correctly.
-   [ ] Players can choose intentions and alternate character
    activations.
-   [ ] Cards can be selected from character and team hands.
-   [ ] The engine validates costs, targets, timing, and attribute
    requirements.
-   [ ] Focused attacks hit only their selected legal target.
-   [ ] Movement respects tile occupancy, movement allowance, terrain cost, and blockers.
-   [ ] Evade, push, pull, swap, and collision behavior follow the rules.
-   [ ] Range, line of sight, directional attacks, and AoE previews match actual resolution.
-   [ ] Elemental terrain changes movement, targeting, or effects according to explicit rules.
-   [ ] Reactions, damage, shields, statuses, and knockouts resolve in a
    consistent order.
-   [ ] Character attributes and passives change gameplay.
-   [ ] Synergy conditions work without hard-coded card-name checks.
-   [ ] The battle log explains every important state change.
-   [ ] The game ends correctly by knockout or round limit.
-   [ ] Automated tests pass for all core mechanics.
-   [ ] The same game state and action sequence always produce the same
    results.

------------------------------------------------------------------------

## 20. Instructions to the Coding Agent

Before implementing:

1.  Inspect the existing repository and identify its framework,
    language, entry points, and conventions.
2.  Reuse the existing architecture where reasonable; do not replace
    working infrastructure without a clear need.
3.  If no project exists, choose a minimal TypeScript-based
    implementation suitable for a browser prototype.
4.  Report a short implementation plan and any unavoidable conflicts
    between this specification and the existing codebase.
5.  Implement the MVP in the order above.
6.  Run tests and type checks, and fix failures rather than merely
    reporting them.
7.  Keep rules data-driven, deterministic, and unit-testable.
8.  Document any deviation from this specification.
9.  Do not silently invent new rules when a detail is unspecified.
    Prefer the simplest deterministic behavior and document the
    decision.
10. Finish with a summary of what works, how to run the project, tests
    executed, and known limitations.

**Primary engineering priority:** one authoritative, deterministic rules engine shared by UI previews, movement/pathfinding, actual card resolution, and automated tests.
