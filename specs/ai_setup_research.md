# What's the best way to setup a cheap ai for games for non player character? The project is mostly typescript based

For a lightweight grid-based combat game with no dialogue, use **Utility AI for action selection**, not an LLM. Each turn, enumerate legal actions, score them with cheap deterministic functions, and pick the best—optionally with small randomness for variety. It is fast, explainable, easy to balance, and ideal for TypeScript.

## Why utility AI

Utility AI gives every candidate action a score based on the current tactical state: HP, distance, threat, cover, cooldowns, and expected damage. The NPC then executes the highest-scoring legal action. This produces context-sensitive combat behavior without a planner or neural network.[^2_1][^2_2]

Behavior trees are better when you need fixed priorities (“if HP < 25%, retreat; else attack”), while GOAP is better for long multi-step plans. For turn-based grid combat, utility scoring plus a small tactical layer is usually the best cost/benefit tradeoff.[^2_3][^2_4]

## Recommended design

Use this pipeline once per NPC turn:

1. **Generate candidate actions**: move to adjacent/bounded cells, attack a target in range, use an ability, defend, retreat, wait.
2. **Simulate the immediate outcome**: resulting position, damage dealt/taken, exposure, cooldown state.
3. **Score each outcome** with weighted considerations.
4. **Select** the best score, with optional softmax or top-k randomness.
5. **Commit the action** to the game’s deterministic combat resolver.

Keep the AI separate from game rules: the AI proposes an `Action`, and the combat engine validates and resolves it.

## TypeScript core

```ts
type Vec2 = { x: number; y: number };

interface Unit {
  id: string;
  team: "player" | "enemy";
  hp: number;
  maxHp: number;
  attack: number;
  range: number;
  moveRange: number;
  cooldowns: Record<string, number>;
  position: Vec2;
}

type Action =
  | { kind: "move"; to: Vec2 }
  | { kind: "attack"; targetId: string }
  | { kind: "defend" }
  | { kind: "wait" };

interface ScoredAction {
  action: Action;
  score: number;
}
```

A compact evaluator:

```ts
function chooseAction(
  self: Unit,
  allies: Unit[],
  enemies: Unit[],
  legalActions: Action[],
  weights: Record<string, number>
): ScoredAction {
  const scored = legalActions.map((action) => ({
    action,
    score: scoreAction(self, allies, enemies, action, weights),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[^2_0];
}

function scoreAction(
  self: Unit,
  allies: Unit[],
  enemies: Unit[],
  action: Action,
  w: Record<string, number>
): number {
  const next = simulate(self, action); // pure function: no mutation
  const nearestEnemy = nearest(enemies, next.position);
  const distance = manhattan(next.position, nearestEnemy.position);
  const inRange = distance <= self.range ? 1 : 0;
  const threat = incomingThreatAt(next.position, enemies);
  const hpRatio = next.hp / next.maxHp;

  return (
    w.damage * expectedDamage(next, nearestEnemy) +
    w.positioning * (1 / (1 + distance)) +
    w.range * inRange +
    w.safety * (1 - threat) +
    w.survival * hpRatio
  );
}
```

The key is that `simulate` must be pure: it returns the projected state without mutating the real board. That makes tuning, replaying, and debugging straightforward.

## Useful scoring signals

For grid combat, these usually give the best behavior per line of code:


| Signal | Encourages | Example weight effect |
| :-- | :-- | :-- |
| Expected damage | Aggression | Attack a low-HP target |
| Distance to best target | Closing distance | Move toward an enemy |
| Incoming threat | Caution | Avoid standing beside two enemies |
| Cover / terrain bonus | Tactical positioning | Prefer defensive tiles |
| HP ratio | Self-preservation | Retreat when badly hurt |
| Action economy | Efficiency | Prefer attack over ineffective move |
| Focus fire | Coordination | Target the enemy most allies can hit |
| Cooldown value | Resource discipline | Save strong abilities for clustered enemies |

Utility systems commonly evaluate actions from state such as HP, energy, positions, and distances; each action receives an appropriateness score. A hybrid approach—behavior-tree-style priorities at the strategic level and utility scoring for concrete tactical choices—is a common production pattern.[^2_5][^2_1][^2_3]

## Add personality cheaply

Do not create separate AI codebases per enemy type. Use different weight vectors:

```ts
const personalities = {
  aggressive: { damage: 1.0, positioning: 0.6, safety: 0.2, survival: 0.2 },
  cautious:   { damage: 0.5, positioning: 0.8, safety: 1.0, survival: 0.9 },
  sniper:     { damage: 0.8, positioning: 0.9, safety: 0.7, survival: 0.5 },
  berserker:  { damage: 1.4, positioning: 0.3, safety: 0.0, survival: 0.1 },
} satisfies Record<string, Record<string, number>>;
```

This gives you archetypes such as “aggressive melee,” “cautious healer,” or “kiting archer” with almost no extra code.

## Avoid overengineering

Start with this hierarchy:

- **v1:** Utility AI + Manhattan distance + expected damage + HP threshold retreat.
- **v2:** Add threat maps, cover, focus fire, and ability cooldown valuation.
- **v3:** Add lightweight one-ply or two-ply lookahead: “if I move here, what can enemies do next turn?”
- **v4:** Add coordinated squad scoring only if enemies visibly need teamwork.

Do **not** start with reinforcement learning, MCTS, or GOAP. They add complexity, tuning burden, and nondeterminism that a grid tactics game usually does not need. GOAP is powerful for adaptive multi-step plans but costs more computation and design effort.[^2_2][^2_6]

## Practical tuning workflow

- Log every decision: `unit, action, score, component scores`.
- Add a “why did the NPC do that?” debug overlay.
- Tune weights through scripted scenarios: lone player, surrounded NPC, low HP, ranged enemy, blocked path.
- Keep scores normalized to roughly 0–1 so weights remain interpretable.
- Use small noise only on near-ties, e.g. choose randomly among actions within 5% of the best score.

If you want a library rather than custom code, `behaviortree` is a mature JavaScript behavior-tree option, and there are TypeScript-focused behavior-tree libraries such as `fluent-behavior-tree` and `mistreevous`; however, for utility-driven combat, a few hundred lines of bespoke scoring code will likely be simpler than forcing everything into a behavior tree.[^2_7][^2_8]

<span style="display:none">[^2_10][^2_11][^2_12][^2_13][^2_14][^2_15][^2_16][^2_17][^2_18][^2_19][^2_20][^2_21][^2_22][^2_23][^2_24][^2_25][^2_26][^2_27][^2_28][^2_29][^2_30][^2_31][^2_32][^2_33][^2_34][^2_35][^2_36][^2_37][^2_38][^2_39][^2_40][^2_41][^2_9]</span>

<div align="center">⁂</div>

[^2_1]: https://ieee-cog.org/2021/assets/papers/paper_254.pdf

[^2_2]: https://capz.pro/posts/building-intelligent-npcs-practical-ai-for-game-developers-and-modders

[^2_3]: https://aesopacademy.org/ai-academy/modules/ai-in-game-design-i/ai-in-game-design-i-m3

[^2_4]: https://www.gamedeveloper.com/programming/behavior-trees-and-the-future-of-intelligent-control-2

[^2_5]: https://www.jmis.org/archive/view_article?pid=jmis-10-4-321

[^2_6]: https://geetauniversity.edu.in/blog/game-balancing-ai-npc-behavior/

[^2_7]: https://www.npmjs.com/package/behaviortree?activeTab=readme

[^2_8]: https://github.com/topics/behavior-tree?l=typescript

[^2_9]: http://www.gameaipro.com/GameAIPro/GameAIPro_Chapter04_Behavior_Selection_Algorithms.pdf

[^2_10]: https://sol.sbc.org.br/index.php/se4games/article/download/36934/36719/

[^2_11]: https://ejournal.undiksha.ac.id/index.php/janapati/article/download/82040/29860/233844

[^2_12]: https://genies.com/blog/how-to-create-ai-npcs-for-games-in-5-simple-steps

[^2_13]: https://checkmygit.com/esengine

[^2_14]: https://arxiv.org/html/2110.07594

[^2_15]: https://github.com/topics/behaviour-tree

[^2_16]: https://arxiv.org/html/2604.03091v1

[^2_17]: https://docs.web-engine.dev/packages/gameplay/ai

[^2_18]: https://arxiv.org/html/2510.14154v1

[^2_19]: https://arxiv.org/pdf/2505.20011.pdf

[^2_20]: https://www.skillsdirectory.com/skills/levalencia-game-development

[^2_21]: https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/ai-behavior-trees-utility-ai/SKILL.md

[^2_22]: https://www.abbacustechnologies.com/how-to-create-ai-gaming-npcs-with-autonomous-behavior/

[^2_23]: https://generalistprogrammer.com/tutorials/npc-behavior-complete-game-ai-tutorial

[^2_24]: https://tonogameconsultants.com/game-ai-planning/

[^2_25]: https://www.socratopia.app/library/game-code-anatomy-en/chapter-12

[^2_26]: https://code-note-vr.vercel.app/game-ai

[^2_27]: https://www.socratopia.app/library/game-ai-patterns-en/chapter-12

[^2_28]: https://github.com/topics/behavior-trees

[^2_29]: https://github.com/topics/behaviour-trees

[^2_30]: https://marketplace.visualstudio.com/items?itemName=codetypess.vscode-behavior3

[^2_31]: https://repos.ecosyste.ms/topics/behaviour

[^2_32]: https://dev.to/guinhx/porting-mistreevous-to-c-a-high-performance-behavior-tree-library-for-modern-net-l4p

[^2_33]: https://www.behaviortrees.com/learn/

[^2_34]: https://raw.githubusercontent.com/JanWerder/awesome-love2d/master/README.md

[^2_35]: https://github.com/topics/game-ai

[^2_36]: http://www.gameaipro.com/GameAIPro2/GameAIPro2_Index.pdf

[^2_37]: https://arxiv.org/html/2609.02931v1

[^2_38]: https://arxiv.org/pdf/2502.19519v2.pdf

[^2_39]: http://www.diag.uniroma1.it/~degiacom/didattica/dottorato-stavros-vassos/AI\&Games-Lecture1-part2.pdf

[^2_40]: https://atlas.atherlabs.com/atherxperiment/onchain-utility-ai

[^2_41]: https://andrewaltimit.github.io/Documentation/docs/ai-ml/game-ai.html

