# Avatar-Inspired Tactical Card Game

## Coding Agent Specification --- MVP v0.1

**Document status:** Initial implementation specification, including
Avatar State\
**Purpose:** Build a playable, deterministic prototype of a turn-based
3v3 tactical card game inspired by the Avatar: The Last Airbender
universe.\
**Priority:** Correct, testable game rules and a clear UI over content
volume or visual polish.

> Use original implementation code and data. Treat this as an
> Avatar-inspired fan prototype; do not assume any official affiliation
> or license.

------------------------------------------------------------------------

## 1. Product Goal

Implement a tactical card battler in which each player controls three
characters. Players customize iconic characters with technique cards and
use lanes, front/rear positioning, terrain, focused attacks,
area-of-effect (AoE) attacks, reactions, status effects, and character
attributes to win.

The core design principle is:

**A technique's value depends on who uses it, where the target is, what
terrain is present, and what the opponent can do in response.**

The MVP should be small enough to play end-to-end and easy to extend
through data-driven cards.

### MVP success criteria

-   A complete match can be started, played, and resolved.
-   Each team has three characters.
-   The battlefield has three lanes, each with front and rear positions.
-   Cards can target a single character, a lane, multiple lanes, or a
    defined area.
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
-   Three lanes and front/rear positions.
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
-   Three lanes: **Left**, **Center**, **Right**
-   Each lane has two positions: **Front**, **Rear**
-   Each player draws from:
    -   A team tactical deck.
    -   A separate technique deck/hand for each character.
-   Each character begins at their maximum health.
-   Each character begins the match with no statuses, no Momentum, and
    no reaction used.

### Victory

A player wins immediately when all three opposing characters are knocked
out.

If both teams have survivors after round 10, compare: 1. Total remaining
health as a percentage of total maximum health. 2. Number of surviving
characters. 3. If still tied, declare a draw.

Do not use absolute remaining HP as the primary tiebreaker, because
characters can have different maximum health.

------------------------------------------------------------------------

## 4. Battlefield Model

### 4.1 Grid

Represent the battlefield as three lanes, each with a front and rear
position.

Each lane contains one slot per side at each depth:

-   `left.front`
-   `left.rear`
-   `center.front`
-   `center.rear`
-   `right.front`
-   `right.rear`

Each slot can hold at most one character from a given team. Opposing
characters may occupy the same lane and depth.

A character's position is
`{ lane: "left" | "center" | "right", rank: "front" | "rear" }`.

### 4.2 Positioning rules

-   A character may move one step per movement action.
-   Moving between adjacent lanes at the same rank costs one movement.
-   Moving between front and rear in the same lane costs one movement.
-   A character cannot move into a slot already occupied by an ally.
-   A character may move into a slot occupied by an enemy, provided the
    opposing slot is independently occupied; team slots are separate.
-   A move card may override ordinary movement rules.
-   A character cannot voluntarily move while Bound unless an effect
    explicitly allows it.
-   Movement is not an attack and does not trigger attack reactions
    unless a card explicitly says it does.

For the MVP, movement has no separate stamina cost. It costs the
character's movement allowance/action opportunity as defined by the
activation rules.

### 4.3 Front/rear protection

A character in the front rank protects allied characters in the rear
rank of the same lane from ordinary melee attacks.

-   A melee attack cannot target an enemy rear character while that
    enemy's front slot is occupied by a living enemy.
-   Ranged attacks can target rear characters if their targeting rules
    allow it.
-   AoE attacks can hit rear characters if the AoE shape includes them.
-   A card can explicitly ignore front-rank protection.
-   If the front character is knocked out or moved away, the rear
    character is no longer protected by that rule.

### 4.4 Lane adjacency

Lane order is `Left — Center — Right`.

-   Left is adjacent only to Center.
-   Right is adjacent only to Center.
-   Center is adjacent to both Left and Right.
-   Left and Right are not adjacent.
-   A card that targets "adjacent lanes" uses this rule.
-   A card that targets "all lanes" ignores adjacency.

------------------------------------------------------------------------

## 5. Terrain

Each lane may have one terrain feature at a time. Terrain has an ID,
display name, tags, duration, and effect data.

### MVP terrain types

#### Cover

-   Ranged single-target attacks against characters in this lane deal 1
    less damage.
-   Does not reduce melee damage or AoE damage unless the card
    explicitly says otherwise.
-   Damage cannot be reduced below 0.

#### Unstable Ground

-   The first time each round a character enters this lane, that
    character becomes `OffBalance`.
-   Characters with a relevant Earth technique may ignore this effect.
-   A lane may not contain both Unstable Ground and another terrain
    feature in MVP.

#### Water Source

-   Water techniques used by a character in this lane or an adjacent
    lane gain the `WaterSourceEmpowered` condition.
-   The card must explicitly specify what this condition does; default
    effect is +1 base damage for an attack or +1 shield for a defensive
    card.
-   This bonus can apply at most once per card.
-   Water Source does not automatically empower healing unless the card
    says so.

#### Obstacle

-   Characters cannot move through the affected slot/lane boundary, as
    specified by the terrain.
-   Ranged attacks crossing the obstacle are blocked unless they have
    `IgnoresObstacle`.
-   AoE targeting is resolved according to the AoE shape and the
    terrain's blocking rule.

### Terrain lifecycle

-   Terrain is created by cards or defined at match setup.
-   Each terrain feature has `remainingRounds` or a permanent duration.
-   Duration decreases at the end of the round, after end-of-round
    effects.
-   Remove terrain when its duration reaches zero.
-   A card may replace existing terrain in a lane; this must be explicit
    in the card definition.
-   Terrain resolution must be deterministic and included in the battle
    log.

Do not implement free-form physics. Terrain effects are discrete rules.

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
    one additional step, but still cannot enter an allied-occupied slot.
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
7.  If round 10 has ended, resolve tiebreakers.

------------------------------------------------------------------------

## 9. Card Data Model

Card definitions must be data-driven. Do not hard-code card IDs into the
combat engine.

Suggested TypeScript model:

``` ts
type Lane = "left" | "center" | "right";
type Rank = "front" | "rear";

type Position = {
  lane: Lane;
  rank: Rank;
};

type Targeting =
  | { kind: "self" }
  | { kind: "singleEnemy"; range: "melee" | "ranged" | "any"; canTargetRear: boolean }
  | { kind: "singleAlly"; range: "sameLane" | "adjacentLane" | "any" }
  | { kind: "lane"; laneSelection: "current" | "chosen" | "adjacent" | "all" }
  | { kind: "area"; shape: "cross" | "adjacentLanes" | "allEnemiesInLane" | "allEnemies" }
  | { kind: "selfAndAdjacentAllies" };

type CardEffect =
  | { type: "damage"; amount: number; scalesWithAggression?: boolean }
  | { type: "heal"; amount: number }
  | { type: "shield"; amount: number; duration?: "untilNextRound" | "untilConsumed" }
  | { type: "applyStatus"; statusId: string; duration: number }
  | { type: "removeStatus"; statusId: string }
  | { type: "move"; steps: number; direction?: "chosen" | "awayFromSource" | "towardSource" }
  | { type: "push"; steps: number }
  | { type: "createTerrain"; terrainId: string; duration: number; replacementPolicy: "replace" | "fail" }
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
-   Every effect must have explicit target scope.
-   A card's target pattern must be visible before play.
-   Use tags for synergies rather than card-name-specific checks.
-   Card definitions should be validated at startup or in tests.
-   Invalid card data should produce a useful error message.

------------------------------------------------------------------------

## 10. Targeting: Focused Attacks, AoE, and Defenses

Targeting is a core feature, not a visual decoration. The game engine
must own target legality and affected-target calculation. UI code should
call these functions rather than independently reproducing the rules.

### 10.1 Targeting modes

#### Focused single-target

A focused attack selects one legal character.

-   Resolve damage and effects against that target only.
-   May have higher damage or more reliable secondary effects.
-   Does not hit adjacent characters unless the card explicitly says so.
-   Must respect front/rear protection and range rules.

#### Lane attack

A lane attack selects one lane.

-   Affect all legal characters in the chosen lane, as specified by the
    card.
-   The card must declare whether it hits allies, enemies, or both.
-   If it hits multiple targets, resolve each target independently in
    stable order.
-   Apply per-target damage and statuses separately.
-   Cover and other per-character defenses are checked for each target.

#### AoE attack

An AoE attack selects an area shape rather than a single character.

Supported MVP shapes:

-   `allEnemiesInLane`: all enemy characters in one chosen lane.
-   `adjacentLanes`: all characters matching the card's allegiance
    filter in the source lane and adjacent lanes.
-   `cross`: source lane plus the same rank in adjacent lanes; define
    this shape explicitly in tests.
-   `allEnemies`: all living enemy characters.
-   `selfAndAdjacentAllies`: self and allies in adjacent lanes.

Every AoE card must define: - Area shape. - Allegiance filter
(`enemies`, `allies`, `all`, or `selfAndAllies`). - Whether it can hit
rear-rank characters. - Whether it can hit through obstacles. -
Damage/effect behavior per target. - Whether damage is reduced per
target or divided among targets.

Default rule: **AoE damage is applied independently to every affected
target; it is not split among targets.** Balance AoE through lower base
damage, higher Energy cost, or stronger counterplay.

#### Focused defense

A focused defense protects one selected character or one position.

Examples: - Block one attack against an ally. - Create a shield on one
character. - Counter the attacker if a focused attack is successfully
blocked.

#### Area defense

An area defense protects multiple characters or a zone.

Examples: - Air Shield: reduce the next ranged attack against allies in
one lane. - Earth Wall: block ranged attacks crossing a lane boundary. -
Water Veil: grant a small shield to allies in adjacent lanes.

Area defenses should generally be weaker per target or cost more than
focused defenses. Clearly distinguish shields on characters from
barriers that affect targeting or line of sight.

### 10.2 Target selection and resolution

Provide engine functions similar to:

``` ts
getLegalTargets(state, playerId, cardInstanceId): TargetOption[]
getAffectedCharacters(state, source, card, selectedTarget): CharacterId[]
validateTarget(state, source, card, selectedTarget): ValidationResult
```

These functions must be deterministic and shared by UI previews and
actual resolution.

At play time: 1. Compute legal target options. 2. Require the player to
select one legal target option. 3. Compute the affected character list.
4. Lock that list for the action. 5. Resolve effects against the locked
list in stable order. 6. If a target leaves the area before resolution
due to a reaction, apply the card's defined tracking rule; default is
that target is no longer affected if it is no longer in the area at
resolution.

Do not let the UI decide damage, target eligibility, or AoE membership.

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
    allegiance filter, and reaction rules. Avatar State does not bypass
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
-   The Avatar remains vulnerable to positioning, status effects, and
    focused attacks.
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
5.  **Air Shield** --- area defense; protects allies in one lane against
    the next ranged attack.
6.  **Earth Wall** --- creates terrain/barrier that blocks specified
    ranged attacks.
7.  **Fire Sweep** --- AoE across a lane; lower damage than a focused
    attack.
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

The interface should make tactical information visible without
overwhelming the player.

### Battlefield view

-   Three clearly labeled lanes.
-   Front/rear slots for each team.
-   Character portraits, health bars, Focus, statuses, and current
    intention when revealed.
-   Terrain markers and clear icons.
-   Distinguish allied and enemy characters.
-   Show which characters have activated and which still have reactions
    available.
-   Show Energy remaining.

### Hand and targeting

-   Separate character technique hands from the team tactical hand.
-   Display card cost, target type, tags, and concise rules text.
-   On card selection, highlight legal targets.
-   For AoE, preview every affected slot/character before confirmation.
-   Distinguish primary target from secondary affected targets.
-   Show why a target is illegal (range, front-rank protection,
    obstacle, Bound, insufficient resource, etc.).
-   Confirm irreversible or high-impact actions where appropriate, but
    avoid unnecessary confirmation dialogs for ordinary moves.

### Battle log

Record: - Card played and source character. - Energy/Focus spent. -
Targets selected and characters affected. - Damage, healing, shields,
status changes, movement, terrain changes. - Reaction used. - Knockouts
and victory.

The log should be useful for debugging and for players learning why an
interaction resolved a particular way.

### Accessibility and clarity

-   Do not communicate target shapes only by color.
-   Use icons plus text labels for focused/AoE, melee/ranged, and status
    types.
-   Keep all rules-relevant information readable at the target viewport
    size.
-   Use deterministic highlights and stable animations; animation must
    not affect game state.

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
Illegal target. - Target blocked by front-rank protection. - Movement
destination occupied by ally. - Character Bound. - Card requires an
attribute threshold. - Reaction already used this round.

Errors should include a stable code and a player-readable message.
Invalid actions must leave the state unchanged.

------------------------------------------------------------------------

## 17. Testing Requirements

Automated tests are required for all core rules.

### Battlefield tests

-   Lane adjacency.
-   Front/rear protection.
-   Movement into empty versus allied-occupied slots.
-   Displacement at board edges.
-   Knockout removes a character from occupancy.
-   Movement into terrain triggers terrain effects once.

### Targeting tests

-   Focused attack affects exactly one target.
-   Melee cannot target a protected rear character.
-   Ranged attack can target rear if allowed.
-   AoE affects all and only eligible characters in its shape.
-   AoE ally/enemy filters work correctly.
-   AoE and obstacle interaction follows card/terrain rules.
-   Target previews and actual resolution use the same affected-target
    function.

### Resource tests

-   Energy refreshes to 4 each round.
-   Energy does not carry over.
-   Focus cannot exceed 4 or fall below 0.
-   Discipline discount applies once per character per round.
-   Failed actions do not spend resources.

### Resolution tests

-   Damage modifiers and shields resolve in the specified order.
-   Evade success prevents damage and secondary effects.
-   Tie in attack/evasion scores deals base damage but prevents optional
    secondary status.
-   Reactions can be used only once per character per round.
-   Knockout is checked immediately after damage.
-   Victory ends the match.

### Status/terrain tests

-   Status duration and removal.
-   Status reapplication rules.
-   Terrain replacement/failure behavior.
-   Terrain expiration.
-   Water Source bonus applies once per card.
-   OffBalance, Exposed, Bound, and Exhausted trigger correctly.

### Synergy tests

-   FollowUp bonus can trigger at most once per character per round.
-   Momentum cap and expiration.
-   Displacement event tracked for the current round.
-   Combo resolution does not depend on card names.

### End-to-end tests

-   Start a match, play at least two rounds, and resolve a knockout.
-   A match can end by full knockout.
-   Round 10 tiebreaker works.
-   A complete sample combo resolves as specified.
-   Replaying the same action sequence produces the same state and event
    sequence.

------------------------------------------------------------------------

## 18. Implementation Order

Implement in this order, and keep the app runnable at each step.

1.  **Types and state:** positions, characters, cards, resources,
    terrain, statuses.
2.  **Pure rules functions:** adjacency, legal movement, target
    calculation, health/resource changes.
3.  **Card resolution:** single-target cards, AoE, reactions, terrain
    and statuses.
4.  **Round loop:** refresh, intentions, activations, end-of-round
    effects, victory.
5.  **Minimal UI:** board, character slots, hands, target preview,
    Energy/Focus, battle log.
6.  **Starter content:** six characters and twelve complete cards.
7.  **Automated tests:** core rules first, then end-to-end flows.
8.  **Polish:** onboarding, animations, AI opponent, and additional
    content only after the rules are stable.

Do not start with elaborate animations or a large card library.

------------------------------------------------------------------------

## 19. Acceptance Criteria

The MVP is complete when:

-   [ ] A local match can be started with two teams of three.
-   [ ] All six characters occupy valid battlefield positions.
-   [ ] Each round refreshes Energy and resets per-round flags
    correctly.
-   [ ] Players can choose intentions and alternate character
    activations.
-   [ ] Cards can be selected from character and team hands.
-   [ ] The engine validates costs, targets, timing, and attribute
    requirements.
-   [ ] Focused attacks hit only their selected legal target.
-   [ ] AoE cards preview and affect exactly the correct
    slots/characters.
-   [ ] Front/rear protection works for melee and ranged attacks.
-   [ ] Terrain changes movement, targeting, or effects according to
    explicit rules.
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

**Primary engineering priority:** one authoritative, deterministic rules
engine shared by UI previews, actual card resolution, and automated
tests.
