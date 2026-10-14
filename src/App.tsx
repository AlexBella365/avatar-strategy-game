import { useState } from "react";
import type { GameState } from "./game/types";
import { createInitialState } from "./game/state";
import { CHARACTERS } from "./game/content/characters";
import "./App.css";

function demoState(): GameState {
  return createInitialState([
    {
      playerId: "p0",
      characterDefs: [CHARACTERS[0], CHARACTERS[1], CHARACTERS[3]],
      positions: [
        { lane: "left", rank: "front" },
        { lane: "center", rank: "front" },
        { lane: "right", rank: "front" },
      ],
    },
    {
      playerId: "p1",
      characterDefs: [CHARACTERS[2], CHARACTERS[4], CHARACTERS[5]],
      positions: [
        { lane: "left", rank: "front" },
        { lane: "center", rank: "front" },
        { lane: "right", rank: "front" },
      ],
    },
  ]);
}

const LANES = ["left", "center", "right"] as const;

export default function App() {
  const [state] = useState<GameState>(demoState);
  return (
    <div className="app">
      <header>
        <h1>Avatar Tactical Card Game — Prototype</h1>
        <p>
          Round {state.round}/{state.maxRounds} · P0 ⚡{state.players[0].energy} · P1 ⚡
          {state.players[1].energy} · Initiative: {state.initiativePlayerId}
        </p>
      </header>
      <main className="board">
        {LANES.map((lane) => (
          <section key={lane} className="lane">
            <h2>{lane}</h2>
            {(["front", "rear"] as const).map((rank) => (
              <div key={rank} className="rank-row">
                <span className="rank-label">{rank}</span>
                {(["p0", "p1"] as const).map((owner) => {
                  const chars = state.characters.filter(
                    (c) =>
                      c.ownerId === owner &&
                      c.position.lane === lane &&
                      c.position.rank === rank,
                  );
                  return (
                    <div key={owner} className={`slot ${owner}`}>
                      {chars.length === 0 ? (
                        <span className="empty">—</span>
                      ) : (
                        chars.map((c) => (
                          <div key={c.id} className="char">
                            <strong>
                              {c.definitionId} ({c.ownerId})
                            </strong>
                            <span>
                              ❤ {c.health}/{c.maxHealth} · ◉ {c.focus}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        ))}
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
        <p>Scaffold only — engine steps 2–4 (targeting, cards, rounds) not yet implemented.</p>
      </footer>
    </div>
  );
}
