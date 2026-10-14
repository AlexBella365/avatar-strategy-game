import { useState } from "react";
import type { GameState, Position } from "./game/types";
import { createInitialState } from "./game/state";
import { CHARACTERS } from "./game/content/characters";
import { GRID_COLS, GRID_ROWS } from "./game/rules/grid";
import "./App.css";

const P0_POS: Position[] = [
  { x: 1, y: 1 },
  { x: 3, y: 1 },
  { x: 5, y: 1 },
];
const P1_POS: Position[] = [
  { x: 1, y: 3 },
  { x: 3, y: 3 },
  { x: 5, y: 3 },
];

function demoState(): GameState {
  return createInitialState([
    {
      playerId: "p0",
      characterDefs: [CHARACTERS[0], CHARACTERS[1], CHARACTERS[3]],
      positions: P0_POS,
    },
    {
      playerId: "p1",
      characterDefs: [CHARACTERS[2], CHARACTERS[4], CHARACTERS[5]],
      positions: P1_POS,
    },
  ]);
}

function zoneOf(y: number): string {
  if (y <= 1) return "zone-a";
  if (y >= 3) return "zone-b";
  return "zone-neutral";
}

export default function App() {
  const [state] = useState<GameState>(demoState);
  const rows = Array.from({ length: GRID_ROWS }, (_, y) => y);
  const cols = Array.from({ length: GRID_COLS }, (_, x) => x);
  return (
    <div className="app">
      <header>
        <h1>Avatar Tactical Card Game — Prototype</h1>
        <p>
          Round {state.round}/{state.maxRounds} · P0 ⚡{state.players[0].energy} · P1 ⚡
          {state.players[1].energy} · Initiative: {state.initiativePlayerId}
        </p>
      </header>
      <main
        className="grid-board"
        style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
      >
        {rows.map((y) =>
          cols.map((x) => {
            const chars = state.characters.filter(
              (c) => c.position.x === x && c.position.y === y,
            );
            return (
              <div key={`${x},${y}`} className={`tile ${zoneOf(y)}`}>
                <span className="coords">
                  {x},{y}
                </span>
                {chars.map((c) => (
                  <div key={c.id} className={`char ${c.ownerId}`}>
                    <strong>
                      {c.definitionId} ({c.ownerId})
                    </strong>
                    <span>
                      ❤ {c.health}/{c.maxHealth} · ◉ {c.focus}
                    </span>
                  </div>
                ))}
              </div>
            );
          }),
        )}
      </main>
      <section className="log">
        <h2>Battle log</h2>
        <ul>
          {state.log.map((entry, i) => (
            <li key={i}>{entry}</li>
          ))}
        </ul>
      </section>
      <footer>
        <p>Grid scaffold (v2 §18 steps 1–2): geometry in, movement/terrain/cards next.</p>
      </footer>
    </div>
  );
}
