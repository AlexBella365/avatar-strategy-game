# Avatar Tactical Card Game — Spec v0.3 Amendment (card + character game)

**Status:** Amendment to `avatar_tactical_card_game_spec_v2.md` (v0.2). Where this conflicts with v0.2 §§7–9, this takes precedence. Grid (§4/§4A), terrain (§5), damage/attributes (§6), statuses (§11), and Avatar State (§12A) are unchanged except as noted.

## v0.3 change summary

- Cards are typed **Gear (equip, persistent) / Attack / Defense** (reactions are Defenses with a reaction window; Support stays a subtype of Defense for now).
- Each character has **M = 4 slots**: max 2 Gear, max 2 Attacks, max 2 Defenses. Over cap → replace one card in that slot type; replaced Gear bonus drops immediately.
- Each round each player **draws N = 5**, secretly **assigns 1 face-down per living character**; the **2 unassigned auto-bank** for their printed chi.
- On activation reveal: **Play (reveal + discard, except Gear) or Scrap (bank chi, kept secret)**. Scrapped characters may still move. Pass = auto-scrap.
- **Chi is a spendable team currency** (not a threshold): strong cards cost chi + Energy/Focus. Bank persists across rounds, starts at 0, uncapped in prototype. **Chi totals and banked-card identities are hidden information** (opponent sees only played cards + board).
- **Tokens unchanged**: 4 team Energy refresh per round; per-character Focus 0–4; Momentum 0–1. No new currency.
- **Restrictions** gate assignment/play (never banking): `unique` (character id) / `element` / `alignment` (Hero/Villain, mapped from roster `role`: `hero`→Hero, `villain`→Villain; `antihero`/`neutral` satisfy only cards that name them explicitly) / `team` (named crew, resolved against a per-scenario list — starter `team-avatar` = Aang, Katara, Sokka, Toph; Zuko joins in later scenarios, mirroring his hero flip).

## Turn structure delta (replaces v0.2 §8 intentions)

1. **Round start**: Energy → 4; reset `activatedThisRound`, `reactionUsedThisRound`, per-round passives; resolve start-of-round statuses/terrain; draw N = 5 per player.
2. **Assign**: secretly assign 1 card per living character + 1 facing token per living character (default north; every character sets one so directional holdings don't leak). Validate only restriction fit at assign time (not affordability). Unassigned cards bank immediately (secret). KO'd-before-activation assignments auto-scrap at end of round, facing unseen.
3. **Activations**: alternate one living character at a time (initiative swaps each round). Reveal card + facing, then resolve in either order: (a) card decision — Play (pay Energy + Focus + chi; fizzle rules per §8 Phase 4 still apply, costs not refunded; played card is revealed then discarded unless Gear) or Scrap (bank chi secretly); (b) one unsplittable move block of 1 tile (Gear bonuses can raise it). Pass = auto-scrap, move lost. Gear plays occupy a Gear slot; Attack/Defense resolve then discard (persistent bonuses they grant occupy their slot type).
4. **End of round**: end-of-round damage/healing/statuses → terrain expiry → Momentum cleared → Avatar `roundsRemaining` decrement → victory check (unchanged, incl. active-Avatar KO = immediate loss, checked first).

Intentions (`Attack/Defend/Reposition/Prepare`) are removed in v0.3. Evade (1 Focus, once/round) is unchanged.

## Facing (secret direction)

Cards flagged `needsDirection` (line attacks, Wall Rise) use the assignment-time facing token, revealed with the card. Movement never changes facing. Wall Rise reference: low wall on an adjacent legal tile — blocks movement, not sight; allies on tiles directly behind it (opposite the facing) get cover −1 vs. ranged from the faced direction (numbers in `economy.ts`). A bad guess is answered by the live scrap option, not by re-choosing at reveal.

## Talents (one per character, playtest v1)

Framework: innate (never occupy M slots); conditions on public info only (HP totals, terrain, tags); repeatable triggers capped once per round unless stated. Talents are character-card text, not card data.

- **Aang — Evasive Focus:** +1 Focus after a successful evasion, once/round (existing passive, kept).
- **Katara — Healing Waters:** her heal effects +1 while on or orthogonally adjacent to a water source tile.
- **Toph — Earth Sense:** while at full HP, before each enemy activation her controller may peek at that character's facing token. No effect vs. `airborne` attacks. Hot-seat: reveal briefly, hide on pass (same secrecy pattern as chi).
- **Zuko — Breakthrough:** +1 damage against targets holding ≥1 shield (guard-breaker identity).
- **Sokka — Scavenger:** his first scrap each round banks +1 chi (economy-bender, hence capped).
- **Azula — Charged Strike:** +1 damage if she spent 0 movement points this activation (rewards telegraphed setup).

## Companions (ability cards, playtest v1)

Framework: named-animal one-shots that resolve then discard. Slot families for future card-data mapping: Appa → defense, Momo → attack. Neither opens an Evade window (neither is a focused attack); Momo is not reactable. Costs below are reference tuning, not final.

- **Appa — Sky Bison Lift:** `team(team-avatar)` — the Gaang (starter: Aang, Katara, Sokka, Toph), not the Avatar character. Self-teleport to any legal tile (empty, non-blocking, in-bounds; destination chosen at reveal, standard fizzle-if-illegal). Ignores intervening tiles, hazards, LOS, and Bound (carried, not voluntary movement — an explicit bind counter). Reference: 2 Energy + 2 chi.
- **Momo — Snatch:** no restriction (universal). Target: adjacent enemy character with an assigned face-down card (i.e. not yet activated — a legality condition, so spent activations can't be targeted). Peek at the card (owner-only intel), then bank it to your chi pool; the victim activates cardless (move only). Stolen-card replay is out of scope for v1 (bank only). Reference: 1 Energy + 2 chi; note the steal refunds the victim card's chi, so net cost floats with the victim's draw luck.
- Future companions (Naga, Pabu) follow the same framework; gate each with `unique` or leave universal per flavor.

## Terrain delta (extends v0.2 §5)

Starter palette: Plains (—), Grass (cover −1 vs. ranged), Pond (water source; impassable — blocks movement, not sight), Rocks (earth source, same +1 rule as water), Forest (dense, inert alone), Wall (blocking + LOS). Derived tiles arise only through transformation, never at setup.

Transformation chains (durations/X in card data; all deterministic, logged):
- **Freeze (water):** Pond → Ice for X turns → reverts to Pond. Ice is difficult + counts as a water source.
- **Ignite (fire):** Forest → Blaze → Ash. Blaze: hazard 1 on entry (incl. forced entry); after 1 full round it burns out into Ash. Ash: permanent fire source. One-way; the forest is consumed.
- **Raise / Level (earth):** Raise creates a Wall on a legal tile (facing rules apply where relevant); Level removes a Wall (either player's) → Plains. Ranges per card (suggest adjacent–2).
- **Counters (any ability with an explicit melt/douse/stir effect may target transformed tiles):**
  - **Melt (water → Ice):** back to Pond immediately (timer cancelled).
  - **Douse (water → Blaze):** out immediately → Plains (denies the Ash; only natural burnout yields Ash). Water must answer inside the 1-round window.
  - **Stir (air → Ash):** → Smoke until end of next round → Plains. Smoke blocks sight, not movement (concealment evasion, one-way chain).

Test map is fixed and asymmetric (tune after playtests). The board is 7×7 (supersedes v0.2 §4.1's 7×5); coordinates below use x 0–6, y 0–6 with y0 top, A deploys y0–1, B y5–6 (supersedes v0.2 §4.2's rows 3–4) — no blocking tiles inside either zone:
- Pond: (2,2), (4,4). Rocks: (3,0), (3,5), (0,6), (6,6). Walls: (2,3), (4,3) — center row.
- Forest: (4,1), (1,2), (5,4), (6,5), (5,6). Grass (neutral): every other tile — no empty tiles.

## Card data delta (extends v0.2 §9)

```ts
type CardKind = "gear" | "attack" | "defense";
type Restriction =
  | { type: "unique"; characterId: string }        // e.g. glider→aang
  | { type: "element"; elements: ("water" | "earth" | "fire" | "air" | "nonbender" | "avatar")[] }  // any-of: e.g. water|avatar
  | { type: "alignment"; alignment: "hero" | "villain" }
  | { type: "team"; team: string };                // e.g. team-avatar; scenario list
// CardDefinition +=
interface CardEconomy {
  kind: CardKind;
  value: number;        // 1..3 chi gained when banked/scrapped ("chi value")
  valueCost: number;    // 0..6 chi spent from team bank to Play ("chi cost")
  restrictions: Restriction[]; // ALL must hold to assign/play; banking always legal
  slotType: "gear" | "attack" | "defense"; // gear stays; attack/defense discard after resolution
  needsDirection?: boolean; // default false; true → assignment includes a facing used as the card's direction
  airborne?: boolean; // default false; true → evades ground-based senses (Toph's Earth Sense)
}
// PlayerState += bankedValue: number; deck: CardInstance[]; discard: CardInstance[];
// PlayerState.assignments: Record<characterId, CardInstanceId | null>
// CharacterState += equippedGear: CardInstance[] (max 2, enforced at play time)
```

Rules: restriction check runs at assign AND at play (a restriction change mid-round cannot make a bank illegal). Chi payment is checked at play after Energy/Focus. Costs are paid before resolution; illegal-target fizzle still consumes costs.

## Balance config (single source of truth)

All numbers live in `src/game/content/economy.ts` — tune there, never in engine code. It holds `ECONOMY_TUNING` (N = 5 draw, M = 4 slots, 2/2/2 caps, 4 Energy, chi 1–3) and the draft `CARD_ECONOMY` table for the 12 starter cards + 2 signature gear (Glider, Boomerang): chi value, chi cost, energy, restrictions, slot. Starter split: workhorses (Earth Sweep, Air Blast, Water Whip, Water Recovery, Sokka's Feint) cost 0 chi; mids (Rising Flame, Ice Bind, Earth Wall, Precision Strike) cost 1 chi; the AoE bomb (Fire Sweep) costs 2 chi. Universal cards with no restrictions (Travel Rations, Smoke Bomb, Dust Toss) plus the Comet Strike reference round the demo pool out to 18, so every character fits at least 6 cards. Legacy engine constants (Energy/Focus/Avatar numbers in `state.ts`/content) migrate into the config in a follow-up; new economy code must read from the config from day one.

## Content notes (§13)

- Examples: **Aang's Glider** — gear, `unique(aang)`, +1 movement while equipped; **Sokka's Boomerang** — gear, `unique(sokka)`; **Water Whip** — attack, `element(water|avatar)`; **Earth Wall** — `element(earth|avatar)`; **Comet Strike** (new bomb reference) — attack, 2 Energy + 3 chi, 5 damage.
- Starter alignment (from roster `role`): Heroes = Aang, Katara, Toph, Sokka; Villains = Zuko, Azula. Zuko's future hero flip is a data change, not a rule change.
- Balance target: ~2–4 chi/round from 2 auto-banked cards ⇒ a 5-chi bomb needs ~2 extra live scraps over rounds 1–2.

## Engine/tests required

- Slot-cap enforcement + replace-one flow; replaced Gear loses bonus immediately (log it).
- Assign/play restriction checks + always-legal banking.
- Play-or-scrap reveal; pass/KO auto-scrap; unassigned auto-bank with log reasons.
- Chi gain/spend accounting (no negative bank; no cap; totals + banked identities hidden).
- Avatar activation still consumes the technique play (`techniqueBlockedThisActivation`) and applies before that activation's technique window.
