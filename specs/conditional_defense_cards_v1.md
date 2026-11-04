# Conditional Defense Cards — Prototype Batch

**Status:** prototype batch implemented on `main` in the live content and rules engine; not balanced. Trigger timing, response behavior, and lore fit are the focus. Energy, chi, slot pressure, and exact numeric tuning are intentionally open.

## Shared prototype rules

- Playing a card prepares one response on the named character. It lasts until the end of the opponent's next activation (marked by passing) and then expires.
- Each prepared response triggers at most once. Firing it consumes that character's once-per-round reaction, where applicable.
- Resolve the trigger at the stated timing. A response does not start another response chain.
- If the trigger condition is not met before expiry, the card is still spent. This is the cost of preparing for a read that may not pay off.
- A card can say **targeted** (declared as a target, even if shields prevent damage), **would take damage** (after hit/evasion checks), or **enters** (movement event). These are distinct triggers and should not be blurred in rules text.

## Prototype batch

| Card | Inspiration / relationship | Trigger | Prepared response | Prototype rules text |
|---|---|---|---|---|
| **Redirect Lightning** *(existing roster design; benchmark)* | Iroh's lightning redirection; already specced in `card_roster.md` §10 | A focused attack would deal damage to you | Prevent up to 2 damage from that attack, then deal the prevented amount to one enemy in range 3 | **Prepare until your next activation ends. The next time a focused attack would damage you, prevent up to 2 of that damage and deal the prevented amount to one enemy in range 3. This response cannot trigger another response.** |
| **Air Cocoon** | Tenzin evading P'Li's combustion beam; distinct from proactive Air Shield | An enemy's ranged or area attack targets you | Before resolution, step to the legal adjacent tile furthest from the attacker (ties: north, east, south, west); the attack may miss if you leave its range or area | **Prepare until the opponent's next activation ends. When a ranged or area attack targets you, step 1 tile furthest from its source (ties: north, east, south, west) before it resolves. The attack may miss if you leave its range or area.** |
| **Earth Smash** | Toph breaking incoming earth projectiles; earth's rooted defense | A ranged attack would damage you | Reduce that attack's damage by 1, then return a 1-damage stone strike if you survive and the attacker is within range 3 and line of sight | **Prepare until the opponent's next activation ends. The next ranged attack that would damage you deals 1 less damage; then strike its attacker for 1 damage if you survive and it is within range 3 and line of sight.** |
| **Ice Dome** | Katara's frozen sphere; reactive cousin to Octopus Guard | An area attack would hit you | You and adjacent allies gain a small shield against that attack; no counterattack | **Prepare until your next activation ends. When an area attack would hit you, you and adjacent allies gain Shield 1 against that attack.** |
| **Flame Deflection** | Firebenders knocking away incoming blasts; complements Flame Cloak's proactive shield | A fire attack targets you | Reduce damage from that attack by 1; no return damage | **Prepare until your next activation ends. The next time an enemy fire attack targets you, reduce its damage to you by 1.** |
| **Seismic Snare** | Toph's seismic sense and ground-shifting; a movement-triggered defense | An enemy that started outside your orthogonal adjacency ends a normal move adjacent to you | Apply OffBalance to that enemy; no damage | **Prepare until the opponent's next activation ends. The next enemy that moves from outside your adjacency and ends a normal move adjacent to you becomes OffBalance.** |
| **Smoke Feint** | Sokka's feints and Smoke Bomb; turns a defensive read into a setup | An enemy targets you with an attack | After the attack resolves, the attacker becomes Exposed, whether or not it dealt damage; no counterattack | **Prepare until your next activation ends. The next time an enemy attack targets you, its attacker becomes Exposed after that attack resolves.** |
| **Octopus Intercept** | Katara's Octopus Guard; reactive, single-ally alternative to its proactive area shield | An enemy melee attack would damage an adjacent ally | Reduce that attack's damage to the ally by 2; no counterattack | **Prepare until the opponent's next activation ends. When an enemy melee attack would damage an adjacent ally, that ally takes 2 less damage from that attack.** |

## What this batch explores

- **Trigger families:** focused hit, ranged target, ranged damage, area hit, elemental target, movement entry, any attack target, and ally targeting.
- **Response families:** redirect damage, reposition, mitigate plus counterattack, group protection, mitigation without retaliation, status on approach, status after being targeted, and ally interception.
- **Lore identities:** water redirects force, air evades, earth braces and returns force, fire deflects, while non-bending uses reads, feints, and prepared protection.
- **Existing-card connections:** Redirect Lightning is a benchmark already in the roster proposal; Air Cocoon complements Air Shield; Ice Dome and Octopus Intercept branch from Octopus Guard; Flame Deflection branches from Flame Cloak; Smoke Feint builds on Sokka's Feint and Smoke Bomb.

## Implementation notes

The existing `reactionWindow` hint is now paired with typed trigger/response data and serializable prepared-response state. The implemented slice resolves Air Cocoon before the attack locks targets, damage-reduction responses during the damage step, and Seismic Snare after a normal move. A response never recursively triggers another response. Unused responses expire at the opponent's next `PASS_ACTIVATION`.

The first vertical slice supports **Octopus Intercept** (ally mitigation), **Earth Smash** (mitigation plus counter), **Air Cocoon** (pre-resolution movement), and **Seismic Snare** (movement trigger). Other batch cards remain design-only. Keep prototype numbers and costs open until these windows are fun and legible.
