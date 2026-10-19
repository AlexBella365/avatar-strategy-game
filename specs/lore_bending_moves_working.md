# Lore Research: Bending & Combat Moves (working doc)

**Status:** Research notes, non-normative. Working document feeding future card design — candidate moves for Wave 2+ of the card pool (`specs/card_roster.md`). Layout constraints stay in `specs/card_design_prototypes.md`.
**Sources:** Avatar Wiki (avatar.fandom.com) pages *Waterbending*, *Earthbending*, *Firebending*, *Airbending*, *Specialized bending techniques* (accessed Oct 2026, via MediaWiki API), plus supporting web searches. Episode attributions are representative, not exhaustive.
**How to read:** each entry is `Move — practitioner(s) — effect — card hook`. Card hooks map to existing engine primitives: ATK damage, PUSH/PULL, STATUS (OffBalance/Exposed/Bound/Exhausted), TERRAIN, MOB (mobility/teleport), SHIELD, HEAL, FOCUS, REACTION (reaction window), or **ENGINE?** (needs a new primitive). ✅ = already covered by a card in `card_roster.md`; 💡 = uncovered candidate.

## 1. Design flavor notes (from the wiki's "fighting style" sections)

- **Water** = defense turned offense: wait, catch, and return the opponent's force. Strongest when water is near; weak when bound at the arms (arm-binding = canonical counter → suggests a "bound waterbender" weakness clause).
- **Earth** = rooted and steady; earthbenders are uniquely *immobile* until they choose to move — a canonical vulnerability to off-balancing and to being lifted off the ground (Toph is effectively helpless airborne). Earth cards could reward standing ground and punish displacement.
- **Fire** = attacks first, commits forward; strongest by day/noon, weakest during a solar eclipse. Aggression identity.
- **Air** = momentum and evasion; never plants feet, redirects, wins by out-moving. Hypersensitivity = preternatural reaction (evade identity).
- Cross-element counterplay in lore: lightning conducts through waterbenders' water (Mako vs Ming-Hua); Iroh modeled lightning redirection on waterbending; water extinguishes fire; air feeds fire.

## 2. Waterbending

Already covered by roster cards: Water Whip, Ice Bind, Water Recovery, Ice Spear, Tidal Wave, Water Arms, Bloodbend, Healing Waters, Octopus Guard, Freeze Grenade, Mist Veil, Water Shoes (+ Mud Snare / Grasping Vines / Ice Hammer cross-class).

**Ice offensive**
- 💡 Creeping ice — Pakku/Katara/Kya — sends a freezing ray racing along the ground, freezing the target's feet where it lands — [STATUS: rooted/OffBalance or MOB-denial on a line]. Distinct from Ice Bind: it's a *line* that freezes terrain en route.
- 💡 Ice disc — Katara vs Pakku — slices razor-thin spinning discs off an ice column and throws them — [ATK ranged, cheap]. Clean "basic attack" shape.
- 💡 Ice projectiles (shards) — Northern Water Warriors/Tonraq/Kya — rapid-fire small ice shards — [ATK ranged, low cost, spammable].
- 💡 Iceberg spike — Hama/Northern army/Korra — giant spike erupts from a water body under a ship/target — [ATK + TERRAIN hazard on water tile]. Water-specific terrain play.
- 💡 Ice blade — Ming-Hua/Tonraq — sword-like ice blade for melee skewering — [ATK melee]. Ice gauntlet (Hama) is the fist version (+ frostbite risk flavor).
- 💡 Ice column — Unalaq — pillar erupts upward, knocking opponent off their feet — [ATK + PUSH/OffBalance]. Pairs with earth's anti-air weakness theme.

**Ice defensive / control**
- 💡 Ice prison — Pakku/Katara (froze Azula)/Ming-Hua — encases opponent, restricting their hands — [STATUS: Bound via ice; stronger than OffBalance, higher cost]. Canonical hard-cc.
- 💡 Slip-over-ice — Katara/Pakku/Tahno — covers a wide floor with ice: enemies slip, bender slides — [TERRAIN: difficult + MOB for caster]. Zone control.
- 💡 Ice wall/shield — Katara/Korra/Tonraq (blocked P'Li beams) — frozen wall — [TERRAIN: blocking wall, shorter duration than Earth Wall; or SHIELD].
- 💡 Ice dome — Katara at Spirit Oasis — encloses self or foe in a frozen sphere — [SHIELD self-trap or STATUS: Bound on foe]. Two-mode card.
- 💡 Ice ramp/ladder/sled — Katara/Tonraq/Desna+Eska — mobility constructs — [MOB]. Alternative mobility flavor to Water Shoes (temporary, over any terrain including water).

**Mobility**
- 💡 Water spout — Aang/Pakku/Korra/Amon/Ming-Hua — whirlpool pillar elevates the bender, hard to hit, limited height — [MOB + SHIELD-ish evade bonus]. Signature "mastery" move.
- 💡 Water gliding — Katara (ice surfboard)/Aang/Amon — ride water at high speed — [MOB, water tiles only] — canonical *water-walking-by-pressure* also exists (water pressure manipulation lets Katara walk on water) — note as alternate Water Shoes flavor.
- 💡 Mist-stepping — Kyoshi-era Flying Opera Company — small ice pillars under each step, illusion of walking on air — [MOB, evasive]. Fire has jet-stepping, earth dust-stepping — a shared "stepping" family (cross-class candidate).
- 💡 Ice tunneling — Korra/Southern bender — swim through solid ice unseen — [MOB through ice terrain, surprise]. Ice-terrain payoff.

**Utility / support**
- 💡 Steam manipulation — Katara/Korra — steam cloud conceals allies, or steam frozen mid-air — [TERRAIN: smoke-like cover]. Alternate source for the `smoke` terrain concept.
- 💡 Water jet — Aang/Katara/Unalaq/Kya — high-pressure jet that can blast clean through — [ATK ranged, high damage, high cost]. The "sniper" water attack.
- 💡 Water cloak (multiple arms) — Katara vs Azula/Ming-Hua — tentacle arms grab, whip, freeze — Octopus Guard's offensive cousin; roster's Water Arms covers the melee version. Multi-whip (Katara vs Azula: 4–5 whips) = mass-attack upgrade.
- 💡 Water rope — Aang (Avatar State) — binding rope of water to catch and hold — [PULL or Bound at range].
- 💡 Plantbending — Huu (Foggy Swamp) — bends water in vines/plants, extracts it leaving withered plants — [TERRAIN: snare vines, or ATK using swamp tiles]. Full-moon boost for big plants.
- 💡 Condensation — Katara/Hama — pulls water vapor out of thin air when no source is near — [resource-engine card: "create water" / enable water cards in arid maps]. Economy-space idea.
- 💡 Cloudbending (with airbender) — Aang+Katara — cloud shaping for messages/cover — [team card, cross-class air+water].
- 💡 Quiet grip of ice — grabs a foot in ice from nearby ground water — [cheap STATUS: Bound-lite at melee].
- ⚠️ Bloodbending variants (body-fluid manipulation, bloodline without full moon: Yakone/Amon/Tarrlok) — already roster-guardrail'd (full-moon/Villain/gated). Keep to villain tier.

**Avatar-tier (design-guardrail, not normal cards):** tsunami, remote waterbending, water compression, ice fissure.

## 3. Earthbending

Already covered: Earth Sweep, Earth Wall, Seismic Read, Boulder Hurl, Earth Lance, Seismic Slam, Metal Cable, Rock Armor, Raise Ground (Cover), Lavabend, Metal Restraint (+ Mud Snare / Grasping Vines / Ice Hammer / Trip Trap cross-class).

**Basic offense / control**
- 💡 Earth and stone levitation (rock projectiles) — everyone — the bread-and-butter rock throw — [ATK ranged, cheap]. Note: roster's Boulder Hurl covers the heavy version; a cheap "rock toss" doesn't exist yet.
- 💡 Earth bomb — Aang vs Zuko — rock slammed into the ground for burst damage + knock-up — [ATK AoE + OffBalance]. 
- 💡 Earthquakes/fissures — Gow/advanced benders — strike ground to split it, throw opponents off balance; can trigger avalanches — [ATK AoE + STATUS: OffBalance, TERRAIN: difficult]. Signature "big earth" moment.
- 💡 Ground shift — disorienting ground move under a target — [STATUS: OffBalance or PUSH].
- 💡 Earth sinking — Boulder/Master Yu/General Fong — forcibly sink and imprison (even suffocate) an opponent in earth — [STATUS: Bound, expensive, villain-adjacent]. Earth's answer to Ice Prison.
- 💡 Thick mud / quicksand — turn ground to sinking mud or quicksand — [TERRAIN: difficult/snare]. Pairs with water cross cards.
- 💡 Rock shield — levitated slab as shield, then hurled back — [SHIELD that converts to ATK] — nice "defense becomes offense" water-like flavor on earth.
- 💡 Earth smash — punch apart incoming earth projectiles / break out of earth prisons — [REACTION vs terrain/earth attacks] — canonical counter-move.

**Mobility**
- 💡 Earth launch / pillar launch — Toph/Bumi — ride a pillar of rock tens of feet into the air — [MOB, vertical; also anti-air]. Toph-vulnerable-while-airborne tension is good card drama.
- 💡 Earth wave / earth skating — Aang/Toph — ride a moving wave of earth — [MOB big; high cost/concentration (risk flavor)].
- 💡 Earth tunneling — swim through earth unseen — [MOB through walls/terrain, surprise]. Earth's Ice Tunneling analogue.
- 💡 Earth elevator — Aang+Toph — slide a slab up vertical surfaces — [MOB: scale walls]. Answers "walls block everyone" routing.
- 💡 Dust-stepping — Flying Opera Company/Kyoshi — thin pillars under each step (walk on air illusion) — [MOB]. The stepping family (see water/fire).
- 💡 Rock shoes — Dai Li — earth shoes for speed and wall/ceiling cling — [gear flavor; mobility while equipped]. Could be a Dai Li-flavored gear card.

**Defense / utility**
- 💡 Earth armor — Toph/Aang (crystal)/metal version — rocks mold around the body — Rock Armor's canonical full version; metal variant = Beifong signature.
- 💡 Dust cloud — shake ground to raise concealing dust — [TERRAIN: smoke-identical, earth-source]. Second source for the smoke terrain concept.
- 💡 Summon the storm — swirl gravel/dust/sand to fill the air — [TERRAIN: cover + STATUS: Exposed (grit in eyes)].
- 💡 Rock cuff / slab shackles — Aang used slab shackles to hold Ozai for energybending — [STATUS: Bound, physical]. "Fits while disabled" flavor.
- 💡 Earth shelter/dome — instant shelter, or trap — [TERRAIN: blocking dome]. 
- 💡 Rock hanging/magnetization — Dai Li cling to walls/ceilings — [positional utility; evades ground-based effects].
- 💡 Earth preservation (tremor reading of footprints)/remote earthbending (Bumi) — scouting/lore cards, FOCUS-flavored.

**Sub-skills**
- **Seismic sense** — Toph (from badgermoles), Lin — 360° "sight" through ground vibrations, needs ground contact — roster's Seismic Read covers the combat reveal version; the *passive defense* version (can't be surprised/stealthed) is a potential gear/talent hook.
- **Metalbending** — Toph/Lin/Suyin/Kuvira — bends trace earth in unrefined metal: cables (✅ Metal Cable), restraints (✅ Metal Restraint), armor, puppeteered doors/mech limbs (Kuvira), projectiles. Candidates: 💡 metal shrapnel burst, 💡 metal puppet (disarm/redirect enemy gear).
- **Lavabending** — Szeto/Kyoshi/Roku/Ghazan/Bolin — phase-change earth to lava: projectiles that burn through anything, pools, waves; Ghazan melted Ba Sing Se's wall — roster has ✅ Lavabend (terrain); 💡 lava wave (line AoE) is the missing offensive shape.
- **Sandbending** — Si Wong tribes/Gazan — miniature sandstorms propel sails; sand flows like air/water; Gazan's sandstorm + quicksand; Toph learned to sandbend in the comics — [TERRAIN: cover/blinding, MOB]. Cross-class air+earth flavor.
- **Mudbending** — Toph+Katara/Bolin — bend mud both ways — covered cross-class by ✅ Mud Snare.
- **Glassbending** (Kyoshi) and **pigmentbending** (Yun) — rare novel sub-skills; flavor-only, skip for now.

**Avatar-tier (guardrail):** tectonics (Kyoshi split her island), enhanced earth armor (giant rock body vs General Old Iron), compressed rock bullets, dust devil, enhanced levitation.

## 4. Firebending

Already covered: Rising Flame, Fire Sweep, Comet Strike, Fire Lash, Blue Flame, Lightning Bolt, Fire Kick, Combustion Blast, Fire Wall, Flame Cloak, Redirect Lightning, Rocket Flight (+ Jet Burst / Ember Wind / Thermal Draft cross-class).

**Basic offense**
- 💡 Fire streams/fists/jabs — soldiers and every bender — continuous or rapid basic fire — [ATK ranged, cheap]. Fire's cheap spammable attack (mirror of water's ice projectiles).
- 💡 Flame knives / finger flame jet — Zuko/Azula/Korra/Mako — blowtorch-close melee cutters; melted Tenzin's chains — [ATK melee, + vs Bound/terrain interactions]. 
- 💡 Fire blade/flaming swords — Azula cut a wall; Zuko cut Katara's whips — [ATK melee, + vs constrained targets].
- 💡 Fire lashes vs ✅ Fire Lash — Azula's long lash; Zuko's multiple area lashes — multi-lash AoE upgrade exists in ✅ Fire Sweep's line shape.
- 💡 Fireball barrage / cloud of flame darts — swarm of small fireballs starting fires — [ATK multi-hit; starts Bonfire terrain].
- 💡 Twin fireball blast — Zuko (Catacombs, Comet Agni Kai) — intertwined twin streams, comet-shaped — [ATK heavy, high cost]. Zuko signature nuke.
- 💡 Fire comet — Iroh (broke Ba Sing Se's inner wall) — pressurized fire ball, long range — [ATK ranged heavy, structure-break flavor].
- 💡 Fire missiles — Ozai/Aang at Wulong — long streams that follow the target — [ATK that ignores Evade? strong guardrail; needs care]. 
- 💡 Charged attacks — Zuko/Iroh/Azula — hold and release enormous blasts — [ATK with setup/telegraph: pay now, fire next action]. Counterplay-visible big hit.
- 💡 Fire bomb — Zuko/Aang/Ozai (Comet) — explosive burst at limb's end — [ATK AoE melee]. 
- 💡 Fire pinwheel — Azula/Korra — long-range whirling disc of flame — [ATK ranged AoE shape].
- 💡 Somersault/spiral flare kick, fire dropkick — acrobatic kick variants — Fire Kick's flashy cousins; skip unless a Zuko/Azula unique wants flavor.

**Defense / utility**
- 💡 Flame shield — Azula deflected all four elements simultaneously; Zuko stopped a combustion blast — roster's ✅ Flame Cloak covers shield+momentum; Azula's multi-element deflect could justify a pricier "Flame Shield" upgrade.
- 💡 Wall of flames / pyre wall — Jeong Jeong — sustained inferno barrier — roster's ✅ Fire Wall is terrain-on-line; a self-centered defensive wall variant is distinct (SHIELD zone).
- 💡 Blocking fire — swift kick/jab extinguishes an incoming fire blast — [REACTION vs fire attacks]. Cheap counter card.
- 💡 Flame redirection — redirect an incoming fire blast back with fluid motion (mastery indicator) — [REACTION]; fire's answer to lightning redirection — note: ✅ Redirect Lightning exists, this is the fire-vs-fire version.
- 💡 Disappearing fire — Jeong Jeong — sphere of flames masking escape — [SHIELD + stealth/break LOS]. 
- 💡 Smokescreen — Zuko/Ningka — smoke cloud, coughing enemies — [TERRAIN: smoke, fire-source]. Third source for smoke terrain.
- 💡 Fan the flame — Zuko/Jeong Jeong — grow existing flames around you — [synergy card: buffs existing Bonfire terrain / equipped fire]. Tag-synergy showcase.
- 💡 Heat metal — Iroh heated his shackles red-hot; Sozin cooled lava by redirecting heat — [utility: bypass Bound via gear sabotage, or counter lava]. 
- 💡 Breath of fire / wall of fiery breath — warm body against cold; wide flame gout holding foes back — [DEF vs cold terrain; cone zone]. Cold-counter sideboard card.

**Mobility**
- 💡 Jet propulsion (jet flight) — Azula/Ozai — short-burst flight on flame jets — Rocket Flight's canonical root (✅); jet-stepping (Rangi-era, walk on air with foot jets) and wall run (Mako/Korra) are the light versions — 💡 Wall Run: MOB up/along walls, cheap.
- 💡 Recoiling jet — throw yourself from danger on a flame burst — [MOB: escape PUSH self].
- 💡 Ring of flames — Sun Warriors — sustained circle of fire around the bender — [TERRAIN aura: damage on entry around self]. Zone-control identity.

**Special sub-skills**
- **Lightning generation** — Azula/Ozai/Iroh; common by LOK era (power plants) — ✅ Lightning Bolt; **redirection** — Iroh's invention from waterbending philosophy — ✅ Redirect Lightning. Lore note: Mako exploited waterbenders conducting lightning — potential "vs waterbender +1" rider on a future Lightning card.
- **Combustionbending** — Combustion Man (spark), P'Li (third-eye beam) — ✅ Combustion Blast; P'Li's *beam* (focused, long-range, telegraphed tell = third eye) could be a distinct aimed-line upgrade; Combustion Man's tattoo-less variant is ATLA.
- 💡 Blue fire — Azula only, hotter — ✅ Blue Flame gated on Aggression 4+. 
- 💡 Dragon fire / iridescent fire — Ran & Shaw; Roku (white-purple-green multi-color) — legendary tier, Avatar/villain guardrail.
- 💡 White fire — Rangi — emotion-fueled, life-force cost (Hei-Ran's blazing sun also burns the user) — [high-power card with self-damage rider]; cool risk-flavor for a fire signature.
- 💡 Dancing Dragon — Sun Warrior form — fluid stance improving firebending — [stance/buff card, FOCUS investment].
- 💡 Energy reading / heat control — heal-adjacent fire senses (Bhanti shaman; Sozin cooled lava) — utility/lore.
- ⚠️ Sozin's Comet modifier — global fire boost — see §7 global modifiers.

**Avatar-tier (guardrail):** solar fireball (Roku), long-range quintuple fire whips, enhanced heat control.

## 5. Airbending

Already covered: Air Blast, Air Shield, Air Slice, Gust Wave, Cyclone, Air Scooter, Vacuum, Air Cushion, Wind Wall, Spirit Projection (+ Jet Burst / Ember Wind / Thermal Draft / Smoke and Mirrors cross-class).

**Offense**
- 💡 Air punch/kick — Korra's first airbending move — small compressed air bursts from fists/feet — [ATK ranged cheap]. Air's spammable basic.
- 💡 Air blades / gale slice — focused cutting wind (often via staff), slices stone/timber — Air Slice's canonical name and upgrade; could add "+ vs terrain" rider (cuts walls?).
- 💡 Air swipe — Aang — crescent wave that catches flaming rocks and throws them back — [DEF→ATK, ranged-projectile counter]. Canonical "return fire."
- 💡 Returning wind — race in a cyclone to catch arrows/hurled objects and send them back — [REACTION vs ranged]. Air's defensive-redirect identity card.
- 💡 Concussive wake — Aang in Catacombs — run a circle, fire a body-shaped compressed blast — [ATK heavy + PUSH].
- 💡 Shockwave / air bomb — leap and slam, bursting air in all directions — [ATK AoE centered on self + PUSH]. 
- 💡 Thundering gust / breath of wind — jab or exhale a gale that tosses the heaviest foes — [PUSH line cone, no/low damage]. The "get off me" card.
- 💡 Air vortex/tornado — trapped or disoriented foes; Aang's tornado transports — [STATUS: OffBalance + TERRAIN-ish zone, or MOB]. Tornado as MOB+damage combo was Aang's Wulong dodge move.
- 💡 Air wheel — Tenzin — spinning wheel of air that cuts through objects and carries the bender — [ATK line + MOB combined].
- 💡 Directed funnel — Aang's coal cannon — [combo payoff: fire funnel through air = ranged weapon]. Synergy-design flavor.

**Defense / utility**
- 💡 Air cocoon — Tenzin dodged Ming-Hua's spikes and a P'Li combustion blast — [SHIELD via spinning dodge; evasion-flavored defense]. Distinct from Wind Wall (group).
- 💡 Air cushion — ✅ covered (Tenzin/Opal save-falls).
- 💡 Stunning stance — struck, keep stance, return wind blast — [REACTION: retaliate when hit]. Punish-the-attacker card.
- 💡 Cushion the forceful fist — air around body keeps physical strikes at bay — [SHIELD vs melee]. Anti-melee identity.
- 💡 Barrier of noise — Yangchen's loud calm vortex — [TERRAIN: alarm/deny-stealth; utility]. 
- 💡 Sound manipulation — throw voice as distraction; air-powered screams deafen (Yangchen vs Fog of Lost Souls) — [STATUS: Exposed (disoriented) or bluff/reveal-mechanic flavor]. Interesting vs face-down cards: "distraction" could peek/misdirect.
- 💡 Hypersensitivity — perceive shifts in air = split-second reactions (why Air Nomads shave heads) — passive evade identity; potential talent/gear hook, or Air Slice-style "cannot be ambushed" rider.

**Mobility**
- 💡 Wind run / enhanced speed — decrease air resistance, run up vertical surfaces — [MOB, cheap]. The signature air mobility (Aang outran everything).
- 💡 Enhanced agility / levitation — ride gusts for huge jumps; air-board surf (master level) — [MOB: long jump / air board]. Aang and Kyoshi (dropped Xu Ping An) used levitation offensively.
- 💡 Air spout — Wan/Aang/Roku — pillar of air elevates the bender indefinitely — [MOB + airborne status]; air's Water Spout analogue.
- 💡 Air braid — two airbenders tether winds and fling each other — [ally combo MOB]. Team-play card idea.
- 💡 Gliding — every Air Nomad staff — already the Aang's Glider gear (✅ +1 movement). Lore: gliders double as staff weapons.

**Special sub-skills**
- 💡 Flight (unassisted) — Guru Laghima, then Zaheer after P'Li's death ("let go your earthly tether") — the highest level of airbending, ultra-rare — **guardrail**: design as expensive Avatar-tier/unique card (roster notes flight as villain-guardrail); if made, price at Comet-Strike+ and gate hard.
- 💡 Suffocation/asphyxiation — Zaheer (Hou-Ting), Yangchen, Kelsang — vacuum in the lungs; ~10 seconds to live — roster's ✅ Vacuum covers the 1-Bound version; the *lethal* version stays villain-tier and should never be a player card (per "nothing permanently disables" guardrail).
- 💡 Spiritual projection — ✅ Spirit Projection (Jinora) — recon flavor (spy on face-down info?).
- 💡 Vacuum/airless void — sudden sphere of vacuum, then battering refill — ✅ Vacuum's AoE ancestor.
- 💡 Hurricanes — Yangchen (Avatar State), Kelsang sank a fleet — Avatar-tier only.

## 6. Non-bending, weapons & technology

Already covered: Sokka's Feint, Precision Strike, Sword Flurry, Boomerang Toss, Kyoshi Fan, Chi Block, Knife Throw, Electro Glove, Feint and Strike, Shield Bash, Meteor Sword, Grapple Line, Dual Daggers, Rally (+ Trip Trap / Smoke and Mirrors cross-class; gear: Boomerang, Sword, Combat Suit, Metal Armband; companions: Appa, Momo, Naga, Pabu).

- 💡 Hook swords — Jet (Freedom Fighters) — twin hooked blades: slash, catch blades, trip, disarm — [ATK melee + PULL rider]; natural Ty Lee/Mai/ Jet-adjacent unique.
- 💡 War club — Sokka's original weapon — heavy blunt swings, later mounted on a pole — [ATK melee cheap]; starter-flavor card.
- 💡 Javelins/dual javelins — Sokka at various points — ranged thrown spears — [ATK ranged cheap].
- 💡 Acrobatic evasion — Ty Lee (circus background) / Suki — flips and tumbles to dodge mid-fight — [DEF: evade enabler for non-benders]. Ty Lee's identity is *untouchable*, not just chi-block.
- 💡 Pinning knives (curved) — Mai — knives that pin clothing/limbs to surfaces — [ATK ranged + Bound-lite; "pin to wall"]. Mai's flavor = precision denial.
- 💡 Disguise/stealth ops — Kyoshi warriors' face paint + stolen armor infiltrations; Ty Lee's "cheer up" ambushes — [tactics flavor; Exposed/reveal cards].
- 💡 Tactics/strategy cards — Sokka's planning: invasion plans, coal-bending mine cart, hot-air balloon, submarine, mecha-tank design — Sokka's real "power" is engineering+strategy. Candidates: 💡 Hot-Air Balloon (MOB gear), 💡 Meka-Tank? (expensive unique gear), 💡 Battle Plan (team buff / FOCUS gain). Keeps non-benders' identity = tools and teamwork.
- 💡 Asami's hustle — electro-glove (✅) plus driving: future unique vehicle gear (Future Industries Future Industries race-car flavor).
- 💡 Spirit-suit? no. Varrick's inventions — mecha arms, spirit-vine energy weapon (Kuvira's cannon's root) — LOK tech tier; guardrail-heavy (big AoE), likely villain-only.
- ⚠️ Chi-blocking is already ✅ Chi Block (Ty Lee) — guardrail: brief, cleansable, has a tell.

## 7. Energybending, spirit arts & global modifiers (design-guardrail zone)

- **Energybending** — Aang (took Ozai's bending), Korra (restored everyone's), lion turtles — the power to grant/remove bending — **guardrail:** not a normal card; Avatar-only, story-tier. If ever made: unique Aang/Korra card, enormous cost, and counterplay (the wiki notes energybending requires a pure heart / strong spirit).
- **Spiritbending** — Unalaq, Korra — water-channeling to calm or corrupt spirits (pushes a spirit toward balance or imbalance) — [heal-or-harm dual card]; guardrail: spirits/alignment-flavored, not vs players.
- **Harmonic Convergence** — mass energy event: created new airbenders (Zaheer), empowered Unalaq/Vaatu — scenario/event design space, not a card.
- **Avatar State / Resonance** — already engine (roster v2): +1d/+1s, KO-while-active loses. Past-lives combo is the strongest "card" in the setting; keep as engine meter.
- **Global modifiers** (all confirmed in-lore; each is a candidate "condition" card or scenario rule):
  - **Full moon** — waterbending at zenith; bloodbending unlocked — [Water team buff scenario card].
  - **Lunar eclipse** — waterbenders powerless — [Water shut-down; villain counter-scenario].
  - **Solar eclipse** — firebending weak/absent (Day of Black Sun invasion) — [Fire shut-down].
  - **Sozin's Comet** — firebending massively amplified for a day; the finale's clock — [Fire ×N buff; the Comet Strike card is priced *as if* the comet is always overhead].
  - **Day/noon vs night** — fire stronger by day, water by night — subtle round modifier.
  - **Rain** — waterbending stronger; **cold climates/winter** — water stronger; **hot temperatures** — waterbenders weaken (Ming-Hua's prison over a volcano) — map-driven buffs worth considering for scenario play.

## 8. Gaps vs the current roster — top Wave-2 candidates

Ranked by lore prominence × mechanical uniqueness (what the pool *can't do yet*):

1. **Ice Prison** (water) — the canonical hard-cc (Bound via ice); pool only has Ice Bind's conditional Bound.
2. **Creeping Ice** (water) — line-freeze deny-mobility; no water card attacks movement yet besides Water Shoes' defense.
3. **Water Spout** (water) — elevation/dodge mobility; water has zero MOB cards.
4. **Quicksand / Earth Sinking** (earth) — immobilize; earth's control identity is under-served (only Sweep's OffBalance).
5. **Rock Shield** (earth) — SHIELD that converts to counter-ATK; unique "return force" water-flavor on earth.
6. **Earth Tunneling / Earth Launch** (earth) — wall-crossing mobility answers the water-impassable routing problem from the other side.
7. **Fire Streams** (fire) — cheap basic attack; fire's cheapest is Fire Lash at melee.
8. **Charged Attack / Twin Fireball** (fire) — telegraphed nuke with visible save-up; Comet Strike exists but a second "save-up" threat supports fire's bomb identity.
9. **Flame Shield / Blocking Fire** (fire) — fire has one defensive card (Flame Cloak); a reaction-style fire defense is missing (engine delta: reaction window already flagged for Redirect Lightning).
10. **Wind Run / Air Spout** (air) — air has zero MOB cards; Air Scooter is the only mobility and it's in the pool as damage-free move.
11. **Returning Wind / Stunning Stance** (air) — retaliation-when-hit reaction; air's evade identity needs an active card, not just stats.
12. **Hook Swords** (non-bender) — Jet-flavored melee+pull unique.
13. **Battle Plan / Hot-Air Balloon** (non-bender) — Sokka's strategic/engineering identity (team FOCUS or MOB gear).
14. **Stepping family** (dust/mist/jet-stepping) — shared cross-class MOB fantasy, one card, three element flavors? (design call: cross-class or three signatures).
15. **Smoke-source cards** (fire smokescreen / earth dust cloud / water steam) — converge on the flagged `smoke` terrain; whichever element needs the concealment card gets lore-true sourcing.

**Open design questions** for the next pool pass:
- Should the cheap "basic attack" of each element (rock toss, fire streams, air punch, ice shards) be universal-tier or signature-tier? Lore says they're the commonest moves of every bender — suggests a *second* universal tier or upgrading existing cheap cards.
- Full-moon/comet scenario cards: fun, but outside the current "character deck" model — needs an event/scenario slot concept first.
- Villain-tier moves (bloodbending variants, suffocation, combustion beams, flight) all have visible tells and costs in-lore — keep the roster-v2 guardrail pattern: high cost, short duration, counterable.
