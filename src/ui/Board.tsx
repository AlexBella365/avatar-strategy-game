import type { GameState } from "../game/types";
import { GRID_COLS, GRID_ROWS, key } from "../game/rules/grid";
import "./Board.css";

interface BoardProps {
  state: GameState;
  selectedChar: string | null;
  moveTiles: Set<string>;
  legalTargetTiles: Set<string>;
  legalTargetChars: Set<string>;
  onTileClick: (x: number, y: number) => void;
  onCharClick: (id: string) => void;
}

function zoneOf(y: number): string {
  if (y <= 1) return "zone-a";
  if (y >= 3) return "zone-b";
  return "zone-neutral";
}

const STATUS_SHORT: Record<string, string> = {
  OffBalance: "OB",
  Exposed: "EX",
  Bound: "BD",
  Exhausted: "XH",
};

/** Placeholder faces for characters without a portrait (matches roster glyphs). */
export const FACES: Record<string, string> = {
  aang: "🧑‍🦲",
  katara: "🌊",
  toph: "🪨",
  zuko: "🔥",
  sokka: "🪃",
  azula: "⚡",
};

/** Official portraits scraped for the demo (fan prototype, replace with original art). */
export const PORTRAITS: Record<string, string> = {
  aang: "/portraits/aang.webp",
  katara: "/portraits/katara.webp",
  toph: "/portraits/toph.webp",
  zuko: "/portraits/zuko.webp",
  sokka: "/portraits/sokka.webp",
  azula: "/portraits/azula.webp",
};

const TERRAIN_SHORT: Record<string, string> = {
  "rock-wall": "🧱 wall",
  rubble: "🪨 rubble",
  "water-source": "💧 water",
  bonfire: "🔥 fire",
  "ember-field": "🌋 embers",
  ice: "🧊 ice",
  cover: "🛡 cover",
};

export default function Board({
  state,
  selectedChar,
  moveTiles,
  legalTargetTiles,
  legalTargetChars,
  onTileClick,
  onCharClick,
}: BoardProps) {
  const rows = Array.from({ length: GRID_ROWS }, (_, y) => y);
  const cols = Array.from({ length: GRID_COLS }, (_, x) => x);
  return (
    <div className="grid-board" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}>
      {rows.map((y) =>
        cols.map((x) => {
          const k = key({ x, y });
          const chars = state.characters.filter((c) => c.position.x === x && c.position.y === y);
          const terrain = state.terrain.find((t) => t.x === x && t.y === y);
          const cls = [
            "tile",
            zoneOf(y),
            moveTiles.has(k) ? "move-hl" : "",
            legalTargetTiles.has(k) ? "target-hl" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div key={k} className={cls} onClick={() => onTileClick(x, y)}>
              <span className="coords">
                {x},{y}
              </span>
              {terrain && (
                <span className="terrain" title={`${terrain.terrainId} (${terrain.remainingRounds ?? "∞"})`}>
                  {TERRAIN_SHORT[terrain.terrainId] ?? terrain.terrainId}
                </span>
              )}
              {chars.map((c) => (
                <div
                  key={c.id}
                  className="puck-wrap"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCharClick(c.id);
                  }}
                >
                  <div
                    className={`puck ${c.ownerId} ${c.id === selectedChar ? "selected" : ""} ${legalTargetChars.has(c.id) ? "target-hl" : ""} ${c.health <= 0 ? "ko" : ""}`}
                    title={`${c.definitionId} (${c.ownerId}) ❤ ${c.health}/${c.maxHealth} ◉ ${c.focus}`}
                  >
                    <span className="face" aria-hidden>
                      {FACES[c.definitionId] ?? "❓"}
                    </span>
                    {PORTRAITS[c.definitionId] && (
                      <img
                        className="face-photo"
                        src={PORTRAITS[c.definitionId]}
                        alt=""
                        aria-hidden
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    {c.avatarState?.active && <span className="avatar-ring" title="AVATAR STATE — lose if KO'd">🌀</span>}
                    <span
                      className="hp-bar"
                      style={{ width: `${Math.max(0, Math.min(100, (c.health / c.maxHealth) * 100))}%` }}
                    />
                  </div>
                  <span className="puck-caption">
                    {c.definitionId} {c.health}/{c.maxHealth}
                  </span>
                  {c.statuses.length > 0 && (
                    <span className="statuses" title={c.statuses.map((s) => s.statusId).join(", ")}>
                      {c.statuses.map((s) => STATUS_SHORT[s.statusId] ?? s.statusId).join(" ")}
                    </span>
                  )}
                  {c.avatarState && !c.avatarState.active && c.avatarState.resonance > 0 && (
                    <span className="resonance">Res {c.avatarState.resonance}</span>
                  )}
                </div>
              ))}
            </div>
          );
        }),
      )}
    </div>
  );
}
