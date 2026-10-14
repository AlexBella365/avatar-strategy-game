# Avatar Tactical Card Game — Rules

You lead 3 benders in a turn-based duel on a 7×5 grid. Outmaneuver your opponent, play the right technique at the right time, and knock out their whole team.

- **Players:** 2 (hot-seat / pass-and-play)
- **Time:** up to 8 rounds
- **You need:** 3 characters each, technique cards, this board

## Goal

You win immediately when you knock out all 3 enemy characters.

If both teams survive after round 8, you compare:
1. Total remaining health (% of max)
2. Most survivors left
3. Otherwise: draw

## Setup

1. You pick 3 characters each (try: Aang, Katara, Toph vs. Zuko, Sokka, Azula).
2. You place your 3 characters on 3 different tiles in your zone: Team A rows 0–1, Team B rows 3–4. Row 2 starts empty.
3. You start each character at full health, 1 Focus, 0 Momentum, no statuses, empty slots.
4. You shuffle your team deck. Your chi bank starts at 0 and persists across rounds. Each round your Team Energy refreshes to 4.
5. You build decks with restricted cards (see below) — glider only fits Aang, boomerang only fits Sokka, etc.

## Your cards

Each card has one type, one chi value (1–3), and a restriction tag:

- **Gear (equip):** You play it and it stays (e.g. Aang's Glider: +1 movement). It modifies a spec while equipped.
- **Attack:** You play it for damage / push / status, then you discard it.
- **Defense:** You play it for shield / heal / cleanse (some are reactions), then you discard it.
- **Companion (ability):** You call a named animal ally for a one-shot feat, then you discard it. Appa flies you anywhere; Momo steals from the enemy.

Each character has **M = 4 slots total**: max 2 Gear, max 2 Attacks, max 2 Defenses (intentional — you can't fill every category, so you choose a build). Gear occupies a Gear slot while it stays. Attacks/Defenses don't stay, but persistent bonuses they grant (e.g. +1 damage stance) occupy their slot type. To equip beyond the cap, you replace (discard) one card already in that slot type. Replaced Gear loses its bonus immediately.

You can only assign a card to a character it fits (see Restrictions).

## Round loop

Play rounds in this order:

1. **Start:** Set Energy to 4. Reset activations and reactions. Resolve start-of-round effects.
2. **Draw & assign:** You draw **N = 5** cards. You secretly assign 1 face-down to each living character (3 assigned) and set each character's facing token face-down (defaults to north — see Facing). The 2 unassigned go straight to your chi bank (you gain their printed chi).
3. **Activate:** You alternate with your opponent, one character at a time. On your turn you reveal that character's card and choose **Play or Scrap** (see below). You may also move (see On your activation). Initiative swaps each round.
4. **End:** Resolve end-of-round damage, remove expired statuses/terrain/Momentum, check victory. Discard played cards. Unplayed assigned cards do not carry over — you scrap them (gain chi) at end of round if still unused (e.g. character was KO'd before activating).

## On your activation

When you activate a character, you reveal its assigned card and facing token, then do these two in either order:

- **Card decision:** **Play** (pay Energy + Focus + chi, reveal, resolve, discard — except Gear, which stays equipped) or **Scrap** (bank its chi secretly, play nothing).
- **Move (one block):** Move up to 2 tiles orthogonally (+ Gear bonuses). You cannot split your move around the card play, and you cannot enter or pass through occupied tiles or blocking terrain. Difficult terrain (e.g. ice) costs 2 to enter. You may stop early or skip moving.

You may also pass (counts as activated; assigned card auto-scraps, move lost).

## Facing (secret direction)

Some cards need a direction — line attacks, and earth **Wall Rise** (low wall on an adjacent empty tile: blocks movement but not sight, and gives allies directly behind it cover −1 vs. ranged from the faced side). You set the facing secretly at assignment; it is revealed with the card and never changes when you move. Every character sets one (default north) so your opponent can't tell who holds a directional card. If the board turned against you, you can always scrap instead.

## Bank & chi (spend, not threshold)

Your bank is a spendable pool of chi, shared by your team. **Your chi total and which cards you banked are secret** — your opponent only sees played cards and the board.

- You gain chi by banking unassigned cards (auto) and scrapping assigned ones (live choice).
- Strong cards cost chi **in addition to** Energy/Focus. Example: **Comet Strike — 2 Energy + 3 chi, 5 damage.** Weak cards cost 0 chi.
- Typical income: ~2–4 chi/round if you bank 2 unassigned. A bomb costing 5 chi means you must scrap ~2 extra assigned cards over rounds 1–2 to fire it on round 3. That's the tension: play your good cards now, or scrap them to afford bombs later.
- Chi does not cap in the prototype. It belongs to your team, not your characters.

## Restrictions (who fits what)

Every card lists who can take it. You check all that apply:

- **Unique:** `Aang only` (Glider), `Sokka only` (Boomerang).
- **Element:** `Water / Earth / Fire / Air / Nonbender / Avatar`. Water Whip needs Water or Avatar; Earth Wall needs Earth or Avatar.
- **Alignment:** `Hero / Villain`. Starter split: Heroes = Aang, Katara, Toph, Sokka. Villains = Zuko, Azula. (Zuko flips to Hero in later scenarios.)
- **Team:** named crews, e.g. `Team Avatar` (Aang, Katara, Sokka, Toph — Appa only flies for them).
- A card can combine them (e.g. `Fire + Villain`).

If it doesn't fit, you cannot assign or play it on that character. You can still bank it for chi.

## Talents (one per character)

Talents are innate — they never use slots. Each works only while its stated condition holds (always public info, so no trust needed).

- **Aang — Evasive Focus:** +1 Focus after a successful evasion, once per round.
- **Katara — Healing Waters:** her heals +1 while she is on or adjacent to a water source.
- **Toph — Earth Sense:** while at full HP, before each enemy activation you may peek at that character's facing token. Useless against airborne attacks.
- **Zuko — Breakthrough:** +1 damage against shielded targets.
- **Sokka — Scavenger:** his first scrap each round banks +1 chi.
- **Azula — Charged Strike:** +1 damage if she didn't move this activation.

Playtest v1 — all numbers tunable.

## Companions

Companion cards are one-shot animal allies. They resolve, then you discard them. Neither can be Evaded.

- **Appa — Sky Bison Lift (Team Avatar only — Aang, Katara, Sokka, Toph):** You fly yourself to any empty, non-blocking tile, ignoring everything in between — walls, hazards, even your own Bound (he carries you). Pick an illegal tile and the flight fizzles (you still paid).
- **Momo — Snatch (anyone):** You target an adjacent enemy who hasn't activated yet, peek at their assigned face-down card, then bank it for its chi. They activate with no card — move only. Momo answers to no master, so anyone can play him. (Future: Naga, Pabu.)

## Cards and targeting

You read the range on your card, then check line of sight (blocked by walls/rock unless the card says otherwise):

- **Focused:** You pick one character in range. Melee = adjacent (distance 1). Ranged = range in tiles (e.g. ≤3).
- **Tile:** You pick a tile. Whoever is there when it resolves is hit — moving away dodges it.
- **Line / direction:** Uses your secretly chosen facing (north/east/south/west). It hits tiles in a line up to the stated length. The first wall usually stops it.
- **Area (AoE):** You pick a center. It hits every valid character in the shape (`plus`, `line`, `radius`, etc.). Damage is full to each — it is not split.
- **Defense:** You shield, heal, or cleanse. Shields block damage only, not push or statuses, unless the card says so.

No dice. No misses — unless a reaction or move makes your target illegal.

## Evade (the one reaction to remember)

When you are targeted by a focused attack, you may spend **1 Focus** to step 1 tile orthogonally to a free tile. You can do this once per character per round.

- If the attack can no longer reach/see you, it misses.
- If it can still reach you, it still hits.
- If it was an AoE aimed at your tile, you are still hit if your new tile is in the area.

## Statuses

- **OffBalance:** You are pushed +1 tile by the next push/pull. Then it clears.
- **Exposed:** You take +1 damage from the next focused attack. Then it clears.
- **Bound:** You cannot move on your own.
- **Exhausted:** Your next technique costs +1 Energy.

Statuses last until triggered or end of next round. They do not stack.

## Terrain

Some tiles have terrain. You can see it before you move:

- **Blocking (wall/rock):** You cannot enter it. It blocks sight.
- **Difficult (ice):** Costs 2 to enter.
- **Cover:** −1 damage vs. ranged only.
- **Hazard (fire):** Hurts you when you enter it.
- **Water source:** You get +1 damage/shield on Water techniques used from it or next to it.

## Avatar State (Aang only)

Aang builds **Resonance 0/6** (max +2/round): use 2 different elements in a round, protect an ally, or survive a 3+ damage hit. You see the meter fill.

When he hits 6/6, on his activation you may spend **2 Focus** to transform instead of playing a technique:

- **+1 damage** to all his attacks, **+1 shield** to his defenses, for 2 rounds (including this one).
- **Risk: if Aang is knocked out while active, you lose immediately** — even if your allies are alive.
- Once per match.

## Example

> Round 2: You drew 5, assigned Zuko–**Rising Flame**, banked 2 cards for +3 chi (bank now 5). Zuko reveals: you **Play** — pay 2 Energy, resolve 3 damage (+1 was displaced) vs. Toph. Toph spends 1 Focus to Evade 1 tile — still adjacent, so she still takes 3. Next, Sokka reveals a **Boomerang (Gear)** you can't afford to lose: you **Scrap** it for +2 chi to fund Comet Strike next round, and just move 2 tiles.

## Tips

- Save 1 Focus to Evade a kill shot.
- Push/pull enemies into hazards or out of cover before your big hit.
- Spread out vs. AoE, clump vs. focused fire.
- Force the Avatar player to defend — don't let Aang sit at 6/6 for free.
