// Compact, *visible-only* state digest for the LLM prompts (specs/npc_ai_plan.md
// §3 B.1/B.2). Hard rule: never leak hidden information — the enemy's hand,
// deck order, and face-down assignments are omitted entirely.
import { getCardDefinition } from "../../content/cards";
import { CHARACTERS } from "../../content/characters";
import type { CharacterState, GameState } from "../../types";

function byId(a: CharacterState, b: CharacterState): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function pos(c: CharacterState): string {
  return `(${c.position.x},${c.position.y})`;
}

function elementOf(c: CharacterState): string {
  return CHARACTERS.find((d) => d.id === c.definitionId)?.element ?? "?";
}

function statusesOf(c: CharacterState): string {
  return c.statuses.length === 0
    ? "-"
    : c.statuses.map((s) => `${s.statusId}(${s.remainingRounds})`).join(",");
}

function regenOf(c: CharacterState): string {
  const total = c.regeneration.reduce((sum, r) => sum + r.amount, 0);
  return total > 0 ? `regen+${total}` : "regen-";
}

function shieldsOf(c: CharacterState): string {
  const total = c.shields.reduce((sum, s) => sum + s.amount, 0);
  return total > 0 ? `shield${total}` : "shield-";
}

function ownLine(c: CharacterState): string {
  return (
    `${c.id} ${c.definitionId} (${elementOf(c)}) at ${pos(c)} ` +
    `hp ${c.health}/${c.maxHealth} focus ${c.focus} ` +
    `status ${statusesOf(c)} ${regenOf(c)} ${shieldsOf(c)}` +
    `${c.activatedThisRound ? " [done]" : ""}`
  );
}

function foeLine(c: CharacterState): string {
  return (
    `${c.id} ${c.definitionId} (${elementOf(c)}) at ${pos(c)} ` +
    `hp ${c.health}/${c.maxHealth} status ${statusesOf(c)}`
  );
}

function cardLine(definitionId: string): string {
  const card = getCardDefinition(definitionId);
  if (!card) return `${definitionId} (unknown)`;
  const kind = card.economy?.kind ?? card.cardType;
  const cost =
    card.economy !== undefined
      ? `${card.energyCost}E+${card.economy.chiCost}chi`
      : `${card.energyCost}E`;
  const tags = card.tags.length > 0 ? ` [${card.tags.join(",")}]` : "";
  return `${card.name} (${kind}, ${cost})${tags}`;
}

function terrainHighlights(state: GameState): string {
  if (state.terrain.length === 0) return "";
  return state.terrain
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((t) => `${t.terrainId}@(${t.x},${t.y})`)
    .join(" ");
}

export interface DigestOptions {
  /** Hard cap so a pathological roster cannot blow the prompt budget. */
  maxChars?: number;
}

/** Deterministic, visible-only digest of `state` from `playerId`'s seat. */
export function buildDigest(
  state: GameState,
  playerId: string,
  opts: DigestOptions = {},
): string {
  const maxChars = opts.maxChars ?? 1600;
  const mine = state.characters.filter((c) => c.ownerId === playerId).sort(byId);
  const foes = state.characters.filter((c) => c.ownerId !== playerId).sort(byId);
  const player = state.players.find((p) => p.id === playerId);

  const lines: string[] = [];
  lines.push(
    `Round ${state.round}/${state.maxRounds}. You are ${playerId}. ` +
      `Initiative: ${state.initiativePlayerId === playerId ? "you" : "enemy"}.`,
  );
  lines.push("Your characters:");
  for (const c of mine) lines.push(`  ${ownLine(c)}`);

  lines.push("Your hand:");
  const hand = player?.teamHand ?? [];
  if (hand.length === 0) lines.push("  (empty)");
  for (const instance of hand) lines.push(`  ${cardLine(instance.definitionId)}`);

  lines.push("Visible enemies:");
  for (const c of foes) lines.push(`  ${foeLine(c)}`);

  const terrain = terrainHighlights(state);
  if (terrain) lines.push(`Terrain: ${terrain}`);

  const out = lines.join("\n");
  return out.length > maxChars ? out.slice(0, maxChars) : out;
}
