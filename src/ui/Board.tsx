import type { CSSProperties } from "react";
import type { GameState } from "../game/types";
import { GRID_COLS, GRID_ROWS, key } from "../game/rules/grid";
import { bendingColor } from "./elements";
import { terrainVisual } from "./terrainTiles";
import type { AttackFx } from "./attackFx";
import type { CombatText } from "./combatText";
import { ANIMATION_TIMING } from "./animationTiming";
import "./Board.css";

interface BoardProps {
  state: GameState;
  selectedChar: string | null;
  moveTiles: Set<string>;
  legalTargetTiles: Set<string>;
  legalTargetChars: Set<string>;
  /** Transient attack animation; null when nothing is playing. */
  fx?: AttackFx | null;
  /** Transient "-x"/"+y" callouts keyed by receiving character. */
  floats?: CombatText[];
  onTileClick: (x: number, y: number) => void;
  onCharClick: (id: string) => void;
}

/** Deterministic per-tile variation (same hash family as avatar-game's tileHash). */
function tileVariant(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return Math.floor((n - Math.floor(n)) * 3) % 3;
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
  iroh: "🍵",
  ozai: "👑",
  suki: "🥋",
  tylee: "🎪",
  appa: "🦬",
  momo: "🐒",
};

/** Official portraits scraped for the demo (fan prototype, replace with original art). */
export const PORTRAITS: Record<string, string> = {
  aang: "/portraits/aang.webp",
  katara: "/portraits/katara.webp",
  toph: "/portraits/toph.webp",
  zuko: "/portraits/zuko.webp",
  sokka: "/portraits/sokka.webp",
  azula: "/portraits/azula.webp",
  iroh: "/portraits/iroh.webp",
  ozai: "/portraits/ozai.webp",
  suki: "/portraits/suki.webp",
  tylee: "/portraits/tylee.webp",
  appa: "/portraits/appa.webp",
  momo: "/portraits/momo.webp",
};

export default function Board({
  state,
  selectedChar,
  moveTiles,
  legalTargetTiles,
  legalTargetChars,
  fx,
  floats,
  onTileClick,
  onCharClick,
}: BoardProps) {
  const rows = Array.from({ length: GRID_ROWS }, (_, y) => y);
  const cols = Array.from({ length: GRID_COLS }, (_, x) => x);
  const floatByChar = new Map((floats ?? []).map((f) => [f.charId, f]));
  // Feed the timing config to CSS (Board.css reads these custom properties).
  const timingVars = {
    "--fx-fire-ms": `${ANIMATION_TIMING.attackFx.fire}ms`,
    "--fx-water-ms": `${ANIMATION_TIMING.attackFx.water}ms`,
    "--fx-air-ms": `${ANIMATION_TIMING.attackFx.air}ms`,
    "--fx-earth-ms": `${ANIMATION_TIMING.attackFx.earth}ms`,
    "--fx-slash-ms": `${ANIMATION_TIMING.attackFx.slash}ms`,
    "--combat-float-ms": `${ANIMATION_TIMING.combatFloat}ms`,
  } as CSSProperties;
  // Roads render as a rotated path tile; orientation comes from neighbouring
  // road tiles so segments connect into a continuous road.
  const roadKeys = new Set(
    state.terrain.filter((t) => t.terrainId === "road").map((t) => key({ x: t.x, y: t.y })),
  );
  return (
    <div
      className="grid-board"
      style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, ...timingVars }}
    >
      {rows.map((y) =>
        cols.map((x) => {
          const k = key({ x, y });
          const chars = state.characters.filter((c) => c.position.x === x && c.position.y === y);
          const terrain = state.terrain.find((t) => t.x === x && t.y === y);
          const visual = terrain ? terrainVisual(terrain.terrainId) : undefined;
          const isRoad = terrain?.terrainId === "road";
          let roadDir: "ns" | "ew" | "cross" | null = null;
          if (isRoad) {
            const roadAt = (dx: number, dy: number) => roadKeys.has(key({ x: x + dx, y: y + dy }));
            const ns = roadAt(0, -1) || roadAt(0, 1);
            const ew = roadAt(-1, 0) || roadAt(1, 0);
            roadDir = ns && ew ? "cross" : ew && !ns ? "ew" : "ns";
          }
          const cls = [
            "tile",
            visual ? `terrain-${visual.cls}` : "",
            `tv${tileVariant(x, y)}`,
            moveTiles.has(k) ? "move-hl" : "",
            legalTargetTiles.has(k) ? "target-hl" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={k}
              className={cls}
              style={
                visual && !isRoad
                  ? {
                      backgroundColor: visual.color,
                      backgroundImage: visual.tile ? `url(${visual.tile})` : undefined,
                      backgroundSize: "100% 100%",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                    }
                  : undefined
              }
              title={
                visual
                  ? `${visual.label} — ${visual.blurb}${
                      terrain?.remainingRounds != null ? ` (${terrain.remainingRounds} rounds left)` : ""
                    }`
                  : undefined
              }
              onClick={() => onTileClick(x, y)}
            >
              {roadDir && <span className={`road road-${roadDir}`} aria-hidden />}
              {fx && fx.tiles.includes(k) && (
                <span key={fx.seq} className={`attack-fx fx-${fx.kind}`} aria-hidden />
              )}
              {chars.map((c) => {
                const hpPct = Math.max(0, Math.min(100, (c.health / c.maxHealth) * 100));
                const float = floatByChar.get(c.id);
                return (
                <div
                  key={c.id}
                  className="puck-wrap"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCharClick(c.id);
                  }}
                >
                  <div
                    className={`puck ${c.id === selectedChar ? "selected" : ""} ${legalTargetChars.has(c.id) ? "target-hl" : ""} ${c.health <= 0 ? "ko" : ""} ${c.avatarState?.active ? "avatar-active" : ""}`}
                    style={
                      {
                        "--owner": c.ownerId === "p2" ? "var(--p2-color)" : "var(--p1-color)",
                        "--element": bendingColor(c.definitionId),
                      } as CSSProperties
                    }
                    title={`${c.definitionId} (${c.ownerId}) ❤ ${c.health}/${c.maxHealth} ◉ ${c.focus}`}
                  >
                    <span className="puck-face" aria-hidden>
                      <span className="face">{FACES[c.definitionId] ?? "❓"}</span>
                      {PORTRAITS[c.definitionId] && (
                        <img
                          className="face-photo"
                          src={`/faces/${c.definitionId}.webp`}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      )}
                    </span>
                    {c.avatarState?.active && (
                      <span className="puck-avatar" title="AVATAR STATE — lose if KO'd">
                        🌀
                      </span>
                    )}
                    <span className="puck-hp" aria-hidden>
                      <span className="puck-hp-fill" style={{ width: `${hpPct}%` }} />
                    </span>
                    <span className="puck-owner" title={`Owner: ${c.ownerId}`}>
                      {c.ownerId.toUpperCase()}
                    </span>
                  </div>
                  {float && (
                    <span
                      key={float.seq}
                      className={`combat-float ${float.kind}`}
                      aria-hidden
                    >
                      {float.kind === "heal" ? "+" : "−"}
                      {float.amount}
                    </span>
                  )}
                  {(c.statuses.length > 0 ||
                    (c.avatarState && !c.avatarState.active && c.avatarState.resonance > 0)) && (
                    <div className="puck-badges">
                      {c.statuses.length > 0 && (
                        <span className="statuses" title={c.statuses.map((s) => s.statusId).join(", ")}>
                          {c.statuses.map((s) => STATUS_SHORT[s.statusId] ?? s.statusId).join(" ")}
                        </span>
                      )}
                      {c.avatarState && !c.avatarState.active && c.avatarState.resonance > 0 && (
                        <span className="resonance">Res {c.avatarState.resonance}</span>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          );
        }),
      )}
    </div>
  );
}
