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
3. You start each character at full health, 1 Focus, 0 Momentum, no statuses.
4. You start each round with 4 Team Energy (shared by your 3 characters).

## Round loop

Play rounds in this order:

1. **Start:** Set Energy to 4. Reset activations and reactions. Draw up to hand size. Resolve start-of-round effects.
2. **Choose intentions:** You secretly pick one per living character: `Attack`, `Defend` (+1 defense to your first reaction), `Reposition` (+1 tile to your first move), `Prepare` (+1 Focus on activation).
3. **Activate:** You alternate with your opponent, one character at a time, until all living characters have gone. Initiative swaps each round.
4. **End:** Resolve end-of-round damage, remove expired statuses/terrain/Momentum, check victory.

## On your activation

When you activate a character, you may do each once, in either order:

- **Move up to 2 tiles.** You move orthogonally (no diagonals). You cannot enter or pass through occupied tiles or blocking terrain. Difficult terrain (e.g. ice) costs 2 to enter. You may stop early.
- **Play 1 technique card.** You pay its Energy (team pool) + Focus (that character) cost first. If your target becomes illegal, you still paid.

You may also pass.

## Cards and targeting

You read the range on your card, then check line of sight (blocked by walls/rock unless the card says otherwise):

- **Focused:** You pick one character in range. Melee = adjacent (distance 1). Ranged = range in tiles (e.g. ≤3).
- **Tile:** You pick a tile. Whoever is there when it resolves is hit — moving away dodges it.
- **Line / direction:** You pick north/east/south/west. It hits tiles in a line up to the stated length. The first wall usually stops it.
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

> Zuko activates with `Reposition`. You move him 2 tiles next to Toph, play **Rising Flame** (3 damage, +1 if target was displaced). You pay 2 Energy. Toph spends 1 Focus to Evade 1 tile away — but she is still adjacent, so you still hit for 3.

## Tips

- Save 1 Focus to Evade a kill shot.
- Push/pull enemies into hazards or out of cover before your big hit.
- Spread out vs. AoE, clump vs. focused fire.
- Force the Avatar player to defend — don't let Aang sit at 6/6 for free.
