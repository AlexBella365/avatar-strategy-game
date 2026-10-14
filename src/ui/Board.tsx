import type { GameState } from "../game/types";
import { GRID_COLS, GRID_ROWS, key } from "../game/rules/grid";
import { CHARACTERS } from "../game/content/characters";
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
                  className={`char ${c.ownerId} ${c.id === selectedChar ? "selected" : ""} ${legalTargetChars.has(c.id) ? "target-hl" : ""} ${c.health <= 0 ? "ko" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCharClick(c.id);
                  }}
                >
                  <strong>
                    {c.avatarState?.active ? "🌀" : ""}
                    {c.definitionId} ({c.ownerId})
                  </strong>
                  <span>
                    ❤ {c.health}/{c.maxHealth} · ◉ {c.focus}
                    {c.equippedGear.length > 0 ? ` · ⚙${c.equippedGear.length}` : ""}
                  </span>
                  {c.statuses.length > 0 && (
                    <span className="statuses" title={c.statuses.map((s) => s.statusId).join(", ")}>
                      {c.statuses.map((s) => STATUS_SHORT[s.statusId] ?? s.statusId).join(" ")}
                    </span>
                  )}
                  {c.avatarState && !c.avatarState.active && (
                    <span className="resonance">
                      Res {c.avatarState.resonance}/
                      {CHARACTERS.find((d) => d.id === c.definitionId)?.avatarState?.threshold ?? "?"}
                    </span>
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
