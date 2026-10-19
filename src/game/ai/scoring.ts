// Track A utility scoring. Pure reads plus engine-backed simulation: a
// technique is scored on the *projected* state produced by applyGameAction, so
// the AI's expectations can never drift from the real rules
// (specs/npc_ai_plan.md §2.A.3).
//
// Every signal is normalized to 0..1 and multiplied by its weight; `components`
// stores the post-weight contributions so the trace sums back to `score`.
import { CHARACTERS } from "../content/characters";
import { getTerrainDefinition } from "../content/terrain";
import { applyGameAction } from "../rules/cards";
import { hasLineOfSight, manhattan } from "../rules/grid";
import { hasStatus } from "../rules/statuses";
import { pendingHealing } from "../rules/healing";
import { getLegalTargets } from "../rules/targeting";
import {
  isWaterEmpowered,
  sightBlockingTiles,
  terrainAt,
} from "../rules/terrain";
import type {
  CardDefinition,
  CharacterDefinition,
  CharacterState,
  GameAction,
  GameState,
  Position,
  TargetSelection,
} from "../types";
import type { Scored, Weights } from "./types";

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function defOf(c: CharacterState | undefined): CharacterDefinition | undefined {
  return c ? CHARACTERS.find((d) => d.id === c.definitionId) : undefined;
}

/** Reference damage/heal magnitude used to normalize "points" signals. */
const POINT_SCALE = 6;

/** Tiles of gradient over which the approach signal decays outside range. */
const APPROACH_SPAN = 8;

/** Mirror of the engine's affordability check so the policy prefers payable plays. */
export function canAfford(
  state: GameState,
  playerId: string,
  characterId: string,
  card: CardDefinition,
): boolean {
  const c = state.characters.find((ch) => ch.id === characterId);
  const player = state.players.find((p) => p.id === playerId);
  const def = defOf(c);
  if (!c || !player || !def) return false;
  let energy = card.energyCost + (hasStatus(c, "Exhausted") ? 1 : 0);
  if (
    def.attributes.discipline >= 4 &&
    card.energyCost >= 2 &&
    !c.passiveUsesThisRound["disciplineDiscount"]
  ) {
    energy = Math.max(1, energy - 1);
  }
  return (
    player.energy >= energy &&
    c.focus >= card.focusCost &&
    player.chi >= (card.economy?.chiCost ?? 0)
  );
}

// ---------------------------------------------------------------------------
// Position scoring (move decisions).
// ---------------------------------------------------------------------------

/** Approximate incoming threat at a tile from living enemies (0..1). */
export function incomingThreatAt(
  state: GameState,
  pos: Position,
  actor: CharacterState,
): number {
  const enemies = state.characters.filter(
    (c) => c.health > 0 && c.ownerId !== actor.ownerId,
  );
  if (enemies.length === 0) return 0;
  const sightBlocked = sightBlockingTiles(state);
  let threat = 0;
  for (const e of enemies) {
    const d = manhattan(e.position, pos);
    if (d === 0) continue;
    // Only nearby tiles are genuinely threatened: adjacent melee, close
    // ranged. Beyond that is treated as safe so archetypes still close in.
    let t = d <= 1 ? 0.7 : d <= 2 ? 0.3 : 0;
    if (t > 0 && !hasLineOfSight(e.position, pos, sightBlocked)) t *= 0.35;
    threat += t;
  }
  return clamp01(threat / Math.max(1, enemies.length));
}

/** Cover value of a tile vs ranged attacks (0..1). */
export function coverSignalAt(state: GameState, pos: Position): number {
  const def = getTerrainDefinition(terrainAt(state, pos)?.terrainId ?? "");
  return def?.cover ? clamp01(def.cover.reduction / 2) : 0;
}

/** Entry hazard / on-entry status penalty of a tile (0..1). */
export function hazardPenaltyAt(state: GameState, pos: Position): number {
  const def = getTerrainDefinition(terrainAt(state, pos)?.terrainId ?? "");
  let p = 0;
  if (def?.hazard) p += 1;
  if (def?.onEntryStatus) p += 0.5;
  return clamp01(p);
}

/** Score a destination tile (and the "stay" option) on positioning signals.
 *  `desiredRange` is the distance the actor wants from its nearest enemy
 *  (derived from the assigned card): approach saturates inside that range, so
 *  characters stop at their effective distance instead of hugging or idling. */
export function scorePosition(
  state: GameState,
  characterId: string,
  pos: Position,
  w: Weights,
  desiredRange = 3,
): { score: number; components: Record<string, number> } {
  const actor = state.characters.find((c) => c.id === characterId)!;
  const def = defOf(actor);
  const enemies = state.characters.filter(
    (c) => c.health > 0 && c.ownerId !== actor.ownerId,
  );
  let nearest = Infinity;
  for (const e of enemies) nearest = Math.min(nearest, manhattan(pos, e.position));
  // Approach gradient: full credit inside the desired range, then a per-tile
  // falloff that is strong enough to overcome mid-range threat penalties.
  const approach =
    nearest === Infinity
      ? 0
      : nearest <= desiredRange
        ? 1
        : 1 - clamp01((nearest - desiredRange) / APPROACH_SPAN);
  const threat = incomingThreatAt(state, pos, actor);
  const cover = coverSignalAt(state, pos);
  const hazard = hazardPenaltyAt(state, pos);
  const onSource =
    def !== undefined &&
    (def.element === "water" || def.element === "avatar") &&
    isWaterEmpowered(state, pos);

  const components: Record<string, number> = {
    positioning: w.positioning * approach,
    safety: w.safety * (1 - threat),
    cover: w.cover * cover,
    elemental: w.elemental * (onSource ? 1 : 0),
    hazard: -w.safety * hazard,
  };
  const score = Object.values(components).reduce((s, n) => s + n, 0);
  return { score, components };
}

// ---------------------------------------------------------------------------
// Technique scoring (play decisions), simulation-backed.
// ---------------------------------------------------------------------------

function shieldSum(c: CharacterState): number {
  return c.shields.reduce((s, x) => s + x.amount, 0);
}

/** HP still owed by a character's heal-over-time pools. */
function regenValue(c: CharacterState): number {
  return pendingHealing(c);
}

export interface PlayValue {
  card: CardDefinition;
  instanceId: string;
  selection: TargetSelection;
}

/**
 * Score playing `card` at `selection`: simulate the full resolution on a clone
 * and read the deltas. Returns null when the engine rejects the action.
 */
export function scorePlay(
  state: GameState,
  characterId: string,
  card: CardDefinition,
  cardInstanceId: string,
  selection: TargetSelection,
  w: Weights,
): Scored<PlayValue> | null {
  const actor = state.characters.find((c) => c.id === characterId);
  if (!actor) return null;
  const action: GameAction = {
    type: "PLAY_CARD",
    playerId: actor.ownerId,
    characterId,
    cardInstanceId,
    selection,
    card,
    reactions: [],
  };
  const result = applyGameAction(state, action);
  if (result.errors.length > 0) return null;
  const after = result.state;
  const beforePlayer = state.players.find((p) => p.id === actor.ownerId)!;
  const afterPlayer = after.players.find((p) => p.id === actor.ownerId)!;
  const afterActor = after.characters.find((c) => c.id === characterId)!;

  let damage = 0;
  let kills = 0;
  let friendlyFire = 0;
  let allySupport = 0;
  let delayedHeal = 0;
  let selfProtect = 0;
  let selfHpLoss = 0;
  let lowestHpRatio = 1;
  let hitAnyEnemy = false;

  for (const before of state.characters) {
    const now = after.characters.find((c) => c.id === before.id)!;
    const hpLost = Math.max(0, before.health - now.health);
    const shieldLost = Math.max(0, shieldSum(before) - shieldSum(now));
    const hpGained = Math.max(0, now.health - before.health);
    const shieldGained = Math.max(0, shieldSum(now) - shieldSum(before));
    const regenGained = Math.max(0, regenValue(now) - regenValue(before));
    if (before.ownerId !== actor.ownerId) {
      const dealt = hpLost + shieldLost;
      damage += dealt;
      if (before.health > 0 && now.health <= 0) kills += 1;
      if (dealt > 0) {
        hitAnyEnemy = true;
        lowestHpRatio = Math.min(
          lowestHpRatio,
          now.maxHealth > 0 ? now.health / now.maxHealth : 0,
        );
      }
    } else if (before.id === characterId) {
      selfProtect += hpGained + shieldGained;
      delayedHeal += regenGained;
      selfHpLoss += hpLost;
    } else {
      friendlyFire += hpLost + shieldLost;
      allySupport += hpGained + shieldGained;
      delayedHeal += regenGained;
    }
  }

  const energySpent = Math.max(0, beforePlayer.energy - afterPlayer.energy);
  const chiSpent = Math.max(0, beforePlayer.chi - afterPlayer.chi);
  const focusSpent = Math.max(0, actor.focus - afterActor.focus);
  const cost = clamp01(
    (energySpent / 4) * 0.6 + (chiSpent / 3) * 0.25 + (focusSpent / 4) * 0.15,
  );

  const components: Record<string, number> = {
    damage: w.damage * clamp01(damage / POINT_SCALE),
    kill: w.kill * (kills > 0 ? 1 : 0),
    focusFire:
      w.focusFire * (hitAnyEnemy ? clamp01(1 - lowestHpRatio) : 0),
    support:
      w.support * clamp01(allySupport / (POINT_SCALE + 2)) +
      w.support * 0.5 * clamp01(delayedHeal / (POINT_SCALE + 2)) +
      w.survival * 0.5 * clamp01(selfProtect / (POINT_SCALE + 2)),
    friendlyFire: -w.damage * clamp01(friendlyFire / POINT_SCALE) * 1.5,
    hazard: -w.survival * clamp01(selfHpLoss / POINT_SCALE) * 2,
    economy: -w.economy * cost,
  };
  const score = Object.values(components).reduce((s, n) => s + n, 0);
  return {
    value: { card, instanceId: cardInstanceId, selection },
    score,
    components,
    label: `${card.name} → ${describeSelection(selection)}`,
  };
}

function describeSelection(selection: TargetSelection): string {
  switch (selection.kind) {
    case "character":
      return selection.characterId;
    case "tile":
      return `(${selection.pos.x},${selection.pos.y})`;
    case "direction":
      return selection.direction;
    case "automatic":
      return "auto";
  }
}

// ---------------------------------------------------------------------------
// Assignment + Avatar valuation (analytic, no simulation).
// ---------------------------------------------------------------------------

/** Heuristic use-value of a card from the current position (assignment choice). */
export function scoreCardPotential(
  state: GameState,
  characterId: string,
  card: CardDefinition,
  w: Weights,
): number {
  const actor = state.characters.find((c) => c.id === characterId);
  const def = defOf(actor);
  if (!actor || !def) return Number.NEGATIVE_INFINITY;
  const hasTarget = getLegalTargets(state, characterId, card).some((o) => o.isLegal);

  let value = 0;
  for (const e of card.effects) {
    switch (e.type) {
      case "damage":
        value += (e.amount + (e.bonusVsStatus?.amount ?? 0)) * w.damage;
        break;
      case "heal":
        value += e.amount * w.support;
        break;
      case "healOverTime":
        // Delayed healing is worth less than an instant heal of the same size.
        value += e.amount * e.rounds * w.support * 0.6;
        break;
      case "shield":
        value += e.amount * ((w.support + w.survival) / 2);
        break;
      case "applyStatus":
        value += 0.6 * w.focusFire;
        break;
      case "removeStatus":
        value += 0.4 * w.survival;
        break;
      case "push":
      case "pull":
      case "move":
      case "swap":
        value += 0.4 * w.positioning;
        break;
      case "gainFocus":
        value += e.amount * 0.5 * w.economy;
        break;
      case "gainMomentum":
        value += 0.3 * w.damage;
        break;
      case "createTerrain":
        value += 0.5 * w.cover;
        break;
      default:
        value += 0.2;
    }
  }
  if (card.economy?.kind === "gear") {
    value += 0.5;
    value += (card.gearBonus?.damage ?? 0) * w.damage;
    value += (card.gearBonus?.movement ?? 0) * w.positioning;
  }
  // A card with no legal target is still worth holding (setup/banking), but less.
  if (!hasTarget) value *= 0.35;

  const cost =
    (card.energyCost / 4) * 0.6 +
    ((card.economy?.chiCost ?? 0) / 3) * 0.25 +
    (card.focusCost / 4) * 0.15;
  value -= cost * w.economy * 0.5;
  if (!canAfford(state, actor.ownerId, characterId, card)) value *= 0.5;
  return value;
}

export interface AvatarValuation {
  score: number;
  components: Record<string, number>;
}

/**
 * Worth of activating Avatar State now (null when not eligible). Activation is
 * instant-loss if the character is KO'd while active, so low HP is scored as a
 * real risk rather than ignored.
 */
export function avatarScore(
  state: GameState,
  characterId: string,
  w: Weights,
): AvatarValuation | null {
  const c = state.characters.find((ch) => ch.id === characterId);
  const def = defOf(c);
  const av = def?.avatarState;
  if (!c || !av?.enabled || !c.avatarState) return null;
  if (c.avatarState.active || c.avatarState.activatedThisMatch) return null;
  if (c.avatarState.resonance < av.threshold) return null;
  if (c.focus < av.activationFocusCost) return null;

  const hpRatio = c.maxHealth > 0 ? c.health / c.maxHealth : 0;
  const enemies = state.characters.filter(
    (x) => x.health > 0 && x.ownerId !== c.ownerId,
  ).length;
  const payoff = clamp01((av.damageBonus + av.shieldBonus + enemies / 3) / 3);
  const risk = clamp01(1 - hpRatio);

  const components: Record<string, number> = {
    damage: w.damage * payoff,
    survival: -w.survival * risk * 0.8,
    safety: hpRatio >= 0.4 ? w.safety * 0.2 : -w.safety * 0.4,
  };
  const score = Object.values(components).reduce((s, n) => s + n, 0);
  return { score, components };
}
