import { useState } from "react";
import Board from "./ui/Board";
import type {
  CardDefinition,
  Direction,
  GameAction,
  GameState,
  Position,
  TargetOption,
} from "./game/types";
import { applyGameAction } from "./game/rules/cards";
import {
  canEvade,
  getEvadeDestinations,
  movementAllowance,
} from "./game/rules/movement";
import { blockingTiles, difficultTiles } from "./game/rules/terrain";
import { getLegalTargets } from "./game/rules/targeting";
import { cloneState, createInitialState } from "./game/state";
import { drawCards, endRound, pendingActivations } from "./game/rules/turns";
import { getCardDefinition } from "./game/content/cards";
import { CHARACTERS } from "./game/content/characters";
import { ECONOMY_TUNING, restrictionSatisfied } from "./game/content/economy";
import type { Restriction } from "./game/types";
import { key, reachableTiles } from "./game/rules/grid";
import "./App.css";

function demoState(): GameState {
  const state = createInitialState(
    [
      {
        playerId: "p0",
        characterDefs: [CHARACTERS[0], CHARACTERS[1], CHARACTERS[2]],
        positions: [
          { x: 1, y: 1 },
          { x: 3, y: 1 },
          { x: 5, y: 1 },
        ],
      },
      {
        playerId: "p1",
        characterDefs: [CHARACTERS[3], CHARACTERS[4], CHARACTERS[5]],
        positions: [
          { x: 1, y: 3 },
          { x: 3, y: 3 },
          { x: 5, y: 3 },
        ],
      },
    ],
    1,
  );
  drawCards(state, "p0", ECONOMY_TUNING.drawPerRound);
  drawCards(state, "p1", ECONOMY_TUNING.drawPerRound);
  state.log.push("Round 1 begins (initiative: p0). Draw your cards and assign one per character.");
  return state;
}

interface TargetingState {
  card: CardDefinition;
  instanceId: string;
  options: TargetOption[];
}

interface EvadeState {
  card: CardDefinition;
  instanceId: string;
  selection: TargetOption["selection"];
  targetId: string;
  dests: Position[];
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [actingSide, setActingSide] = useState("p0");
  const [selected, setSelected] = useState<string | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [targeting, setTargeting] = useState<TargetingState | null>(null);
  const [evade, setEvade] = useState<EvadeState | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!state) {
    return (
      <div className="app">
        <header>
          <h1>Avatar Tactical Card Game — Prototype</h1>
          <p className="fan-note">
            Unofficial fan prototype. Non-commercial, no affiliation with Nickelodeon or Avatar Studios.
          </p>
        </header>
        <section className="setup">
          <p>
            Hot-seat 3v3 duel on a 7×5 grid. P0: Aang, Katara, Toph. P1: Zuko, Sokka, Azula.
            Each round: draw 5, assign 1 face-down per character, alternate activations
            (Play or Scrap + move), end the round to bank leftovers and draw again.
          </p>
          <button onClick={() => { setState(demoState()); setActingSide("p0"); }}>
            Start match
          </button>
        </section>
      </div>
    );
  }

  const me = state.players.find((p) => p.id === actingSide)!;
  const foe = state.players.find((p) => p.id !== actingSide)!;
  const pending = pendingActivations(state);
  const gameOver = state.winnerId !== null || state.isDraw;
  const selectedChar = state.characters.find((c) => c.id === selected) ?? null;

  const dispatch = (action: GameAction): boolean => {
    const result = applyGameAction(state, action);
    if (result.errors.length > 0) {
      setMessage(result.errors[0].message);
      return false;
    }
    setMessage(null);
    setState(result.state);
    return true;
  };

  const clearTransient = () => {
    setTargeting(null);
    setEvade(null);
    setMoveMode(false);
    setAssigning(null);
  };

  const switchSide = (side: string) => {
    setActingSide(side);
    setSelected(null);
    clearTransient();
    setMessage(null);
  };

  // Reachable tiles for the selected character.
  let moveTiles = new Set<string>();
  if (moveMode && selectedChar && selectedChar.health > 0) {
    const occupied = new Set(
      state.characters.filter((c) => c.health > 0).map((c) => key(c.position)),
    );
    const reach = reachableTiles(selectedChar.position, {
      allowance: Math.max(0, movementAllowance(state, selectedChar.id) - selectedChar.movementSpent),
      blocked: blockingTiles(state),
      occupied,
      difficult: difficultTiles(state),
    });
    moveTiles = new Set(reach.keys());
  }

  const legalTargetTiles = new Set<string>();
  const legalTargetChars = new Set<string>();
  if (targeting) {
    for (const o of targeting.options) {
      if (!o.isLegal) continue;
      for (const t of o.affectedTiles) legalTargetTiles.add(key(t));
      for (const id of o.affectedCharacterIds) legalTargetChars.add(id);
    }
  }

  const findOption = (x: number, y: number): TargetOption | undefined => {
    if (!targeting) return undefined;
    const charHere = state.characters.find((c) => c.position.x === x && c.position.y === y && c.health > 0);
    for (const o of targeting.options) {
      if (o.selection.kind === "character" && charHere && o.primaryCharacterId === charHere.id) return o;
      if (o.selection.kind === "tile" && o.selection.pos.x === x && o.selection.pos.y === y) return o;
    }
    return undefined;
  };

  const doPlayWith = (selection: TargetOption["selection"], reactions: { characterId: string; dest: Position }[]) => {
    if (!targeting || !selectedChar) return;
    const ok = dispatch({
      type: "PLAY_CARD",
      playerId: actingSide,
      characterId: selectedChar.id,
      cardInstanceId: targeting.instanceId,
      selection,
      card: targeting.card,
      reactions,
    });
    if (ok) {
      setTargeting(null);
      setEvade(null);
    }
  };

  const chooseTarget = (option: TargetOption) => {
    if (!targeting || !selectedChar) return;
    if (!option.isLegal) {
      setMessage(option.illegalReason?.message ?? "Illegal target.");
      return;
    }
    // Focused attacks offer the Evade reaction before resolving.
    if (
      targeting.card.targeting.kind === "character" &&
      option.primaryCharacterId &&
      option.primaryCharacterId !== selectedChar.id
    ) {
      const targetId = option.primaryCharacterId;
      if (canEvade(state, targetId, targeting.card.canBeEvaded !== false).ok) {
        setEvade({
          card: targeting.card,
          instanceId: targeting.instanceId,
          selection: option.selection,
          targetId,
          dests: getEvadeDestinations(state, targetId),
        });
        return;
      }
    }
    doPlayWith(option.selection, []);
  };

  const onTileClick = (x: number, y: number) => {
    if (gameOver || evade) return;
    if (targeting) {
      const option = findOption(x, y);
      if (!option) {
        setMessage("No target option there.");
        return;
      }
      chooseTarget(option);
      return;
    }
    if (moveMode && selectedChar && moveTiles.has(key({ x, y }))) {
      if (dispatch({ type: "MOVE", playerId: actingSide, characterId: selectedChar.id, to: { x, y } })) {
        setMoveMode(false);
      }
      return;
    }
    const charHere = state.characters.find((c) => c.position.x === x && c.position.y === y);
    if (charHere) onCharClick(charHere.id);
    else {
      setSelected(null);
      setMoveMode(false);
    }
  };

  const onCharClick = (id: string) => {
    if (gameOver || evade) return;
    if (targeting) {
      const c = state.characters.find((ch) => ch.id === id)!;
      const option = findOption(c.position.x, c.position.y);
      if (!option) {
        setMessage("No target option there.");
        return;
      }
      chooseTarget(option);
      return;
    }
    const c = state.characters.find((ch) => ch.id === id)!;
    if (assigning) {
      if (c.ownerId !== actingSide) {
        setMessage("Assign to one of your characters.");
        return;
      }
      if (dispatch({ type: "ASSIGN_CARD", playerId: actingSide, characterId: id, cardInstanceId: assigning })) {
        setAssigning(null);
      }
      return;
    }
    if (c.ownerId === actingSide && c.health > 0) {
      setSelected(id);
      setMoveMode(false);
      setTargeting(null);
    } else {
      setMessage(c.health <= 0 ? "That character is knocked out." : "That character is not yours.");
    }
  };

  const startPlay = () => {
    if (!selectedChar) return;
    const assigned = me.assignments[selectedChar.id];
    if (!assigned) {
      setMessage("No card assigned — assign one from your hand first.");
      return;
    }
    const card = getCardDefinition(assigned.definitionId);
    if (!card) {
      setMessage("Unknown card.");
      return;
    }
    const options = getLegalTargets(state, selectedChar.id, card);
    const automatic = options.length === 1 && options[0].selection.kind === "automatic";
    if (automatic && options[0].isLegal) {
      setTargeting({ card, instanceId: assigned.id, options });
      doPlayWith(options[0].selection, []);
      return;
    }
    if (card.targeting.kind === "direction") {
      setTargeting({ card, instanceId: assigned.id, options });
      setMessage("Pick a direction below.");
      return;
    }
    setTargeting({ card, instanceId: assigned.id, options });
    setMessage("Pick a highlighted target on the board.");
  };

  const doPass = () => {
    if (!selectedChar) return;
    const result = applyGameAction(state, {
      type: "PASS_ACTIVATION",
      playerId: actingSide,
      characterId: selectedChar.id,
    });
    if (result.errors.length > 0) {
      setMessage(result.errors[0].message);
      return;
    }
    setMessage(null);
    setState(result.state);
    setSelected(null);
    clearTransient();
    const other = actingSide === "p0" ? "p1" : "p0";
    const otherHasPending = pendingActivations(result.state).some(
      (id) => result.state.characters.find((c) => c.id === id)?.ownerId === other,
    );
    if (otherHasPending) setActingSide(other);
  };

  const doEndRound = () => {
    if (pending.length > 0) {
      setMessage(`${pending.length} character(s) still to activate.`);
      return;
    }
    const next = cloneState(state);
    endRound(next);
    setState(next);
    setSelected(null);
    clearTransient();
    setActingSide(next.initiativePlayerId);
    setMessage(null);
  };

  const assignedDef = (charId: string): CardDefinition | null => {
    const owner = state.characters.find((c) => c.id === charId)?.ownerId;
    const inst = state.players.find((p) => p.id === owner)?.assignments[charId];
    if (!inst) return null;
    if (owner !== actingSide) return null; // opponent assignments stay secret
    return getCardDefinition(inst.definitionId) ?? null;
  };

  const avatarThreshold = (definitionId: string): number =>
    CHARACTERS.find((d) => d.id === definitionId)?.avatarState?.threshold ?? 6;

  const restrictionLabel = (r: Restriction): string => {
    switch (r.type) {
      case "unique":
        return `${CHARACTERS.find((d) => d.id === r.characterId)?.name ?? r.characterId} only`;
      case "element":
        return r.elements.join(" or ");
      case "alignment":
        return r.alignment === "hero" ? "Heroes" : "Villains";
    }
  };

  /** Who (among the acting side's characters) this card can be assigned to. */
  const fitsWhom = (card: CardDefinition): string => {
    const restrictions = card.economy?.restrictions ?? [];
    const requirement =
      restrictions.length === 0 ? "anyone" : restrictions.map(restrictionLabel).join(" + ");
    const names = state.characters
      .filter((c) => c.ownerId === actingSide)
      .filter((c) => {
        const def = CHARACTERS.find((d) => d.id === c.definitionId)!;
        return restrictions.every((r) =>
          restrictionSatisfied({ definitionId: def.id, element: def.element, role: def.role }, r),
        );
      })
      .map((c) => c.definitionId);
    return names.length > 0 ? `${requirement} (yours: ${names.join(", ")})` : `${requirement} (none of yours — bank it)`;
  };

  return (
    <div className="app">
      <header>
        <h1>Avatar Tactical Card Game — Prototype</h1>
        <p>
          Round {state.round}/{state.maxRounds} · Initiative: {state.initiativePlayerId} · Acting:{" "}
          <button className={actingSide === "p0" ? "active-side" : ""} onClick={() => switchSide("p0")}>P0</button>{" "}
          <button className={actingSide === "p1" ? "active-side" : ""} onClick={() => switchSide("p1")}>P1</button>
        </p>
        <p className="resources">
          P0 ⚡{state.players[0].energy} 🌀{state.players[0].chi} 🂠{state.players[0].deck.length}🗑{state.players[0].discard.length}
          {" · "}
          P1 ⚡{state.players[1].energy} 🌀{state.players[1].chi} 🂠{state.players[1].deck.length}🗑{state.players[1].discard.length}
        </p>
      </header>

      {gameOver && (
        <section className="gameover">
          <h2>{state.isDraw ? "Draw!" : `${state.winnerId} wins!`}</h2>
          <button onClick={() => { setState(demoState()); setActingSide("p0"); setSelected(null); clearTransient(); setMessage(null); }}>
            New match
          </button>
        </section>
      )}

      <main className="layout">
        <section className="board-col">
          <Board
            state={state}
            selectedChar={selected}
            moveTiles={moveTiles}
            legalTargetTiles={legalTargetTiles}
            legalTargetChars={legalTargetChars}
            onTileClick={onTileClick}
            onCharClick={onCharClick}
          />
          {message && <p className="message">{message}</p>}
          <details className="legend">
            <summary>Legend — what the icons mean</summary>
            <ul>
              <li>❤ health (current / max) · ◉ Focus (0–4, fuels Evade + Avatar State)</li>
              <li>⚡ Team Energy (4/round, shared) · 🌀 team chi bank (spendable)</li>
              <li>🂠 deck remaining · 🗑 discard pile</li>
              <li>🌀 before a name: active Avatar State (KO = instant loss) · Res n/6: Resonance meter</li>
              <li>⚙n: equipped Gear count · 🂠 on a character: face-down assigned card</li>
              <li>🧱 wall (blocking, stops movement + sight) · 🪨 rubble (difficult, 2 to enter)</li>
              <li>💧 water source (empowers Water: +bonus) · 🔥 bonfire (1 on entry) · 🌋 embers (1 at round end)</li>
              <li>🧊 ice (difficult + OffBalance on entry) · 🛡 cover (−1 vs ranged)</li>
              <li>Status codes: OB OffBalance · EX Exposed · BD Bound · XH Exhausted</li>
              <li>Green outline: reachable move · Red outline: legal target</li>
            </ul>
          </details>
          {targeting?.card.targeting.kind === "direction" && (
            <div className="directions">
              {(["north", "east", "south", "west"] as Direction[]).map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    const option = targeting.options.find(
                      (o) => o.selection.kind === "direction" && o.selection.direction === d,
                    );
                    if (option) chooseTarget(option);
                  }}
                >
                  {d}
                </button>
              ))}
              <button onClick={() => setTargeting(null)}>Cancel</button>
            </div>
          )}
          {targeting && targeting.card.targeting.kind !== "direction" && (
            <button onClick={() => setTargeting(null)}>Cancel targeting</button>
          )}
          {evade && (
            <div className="evade-prompt">
              <p>
                {evade.targetId} is targeted! Spend 1 Focus to Evade? (AoE note: moving
                inside the area still hits.)
              </p>
              {evade.dests.map((d) => (
                <button key={`${d.x},${d.y}`} onClick={() => doPlayWith(evade.selection, [{ characterId: evade.targetId, dest: d }])}>
                  ({d.x},{d.y})
                </button>
              ))}
              <button onClick={() => doPlayWith(evade.selection, [])}>Take the hit</button>
            </div>
          )}
        </section>

        <aside className="side-col">
          <section className="hand">
            <h2>
              {actingSide} hand ({me.teamHand.length})
              {assigning ? " — click one of your characters to assign" : ""}
            </h2>
            {me.teamHand.length === 0 && <p className="dim">Hand empty — banked or assigned.</p>}
            <ul>
              {me.teamHand.map((c) => {
                const def = getCardDefinition(c.definitionId);
                return (
                  <li key={c.id} className={assigning === c.id ? "assigning" : ""}>
                    <strong>{def?.name ?? c.definitionId}</strong>{" "}
                    <span className="dim">
                      ⚡{def?.energyCost ?? "?"} 🌀{def?.economy?.chiCost ?? "?"} ⇪{def?.economy?.value ?? "?"}
                    </span>
                    <div className="dim small">{def?.rulesText}</div>
                    {def && <div className="dim small">Fits: {fitsWhom(def)}</div>}
                    <button onClick={() => setAssigning(assigning === c.id ? null : c.id)}>
                      {assigning === c.id ? "Cancel" : "Assign"}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="dim small">
              Foe hand: {foe.teamHand.length} cards (hidden). Foe chi: {foe.chi} (secret in competitive play).
            </p>
          </section>

          <section className="activation">
            <h2>Activation ({pending.length} left)</h2>
            {!selectedChar && <p className="dim">Click one of your glowing characters.</p>}
            {selectedChar && (
              <div>
                <p>
                  <strong>{selectedChar.definitionId}</strong> ❤ {selectedChar.health}/{selectedChar.maxHealth} ◉{" "}
                  {selectedChar.focus} · moved {selectedChar.movementSpent}
                  {selectedChar.avatarState?.active ? " · 🌀 AVATAR STATE — lose if KO'd!" : ""}
                  {selectedChar.avatarState && !selectedChar.avatarState.active
                    ? ` · Res ${selectedChar.avatarState.resonance}/${avatarThreshold(selectedChar.definitionId)}`
                    : ""}
                </p>
                {(() => {
                  const ad = assignedDef(selectedChar.id);
                  return (
                    <p>
                      Assigned: {ad ? <strong>{ad.name}</strong> : <span className="dim">none</span>}{" "}
                      {ad && <span className="dim small">{ad.rulesText}</span>}
                    </p>
                  );
                })()}
                <div className="btn-row">
                  <button onClick={startPlay} disabled={!assignedDef(selectedChar.id)}>Play</button>
                  <button
                    onClick={() => {
                      if (dispatch({ type: "SCRAP_ASSIGNED", playerId: actingSide, characterId: selectedChar.id })) {
                        setMessage("Scrapped secretly (+chi banked).");
                      }
                    }}
                  >
                    Scrap
                  </button>
                  <button onClick={() => setMoveMode(!moveMode)}>{moveMode ? "Stop moving" : "Move"}</button>
                  {selectedChar.avatarState &&
                    !selectedChar.avatarState.active &&
                    selectedChar.avatarState.resonance >= avatarThreshold(selectedChar.definitionId) && (
                      <button
                        onClick={() =>
                          dispatch({ type: "ACTIVATE_AVATAR_STATE", playerId: actingSide, characterId: selectedChar.id })
                        }
                      >
                        Enter Avatar State (2 ◉)
                      </button>
                    )}
                  <button onClick={doPass}>Pass (auto-scraps)</button>
                </div>
              </div>
            )}
            <div className="btn-row">
              <button onClick={doEndRound} disabled={pending.length > 0 || gameOver}>
                End round{pending.length > 0 ? ` (${pending.length} left)` : ""}
              </button>
              <button
                onClick={() => { setState(demoState()); setActingSide("p0"); setSelected(null); clearTransient(); setMessage(null); }}
              >
                New match
              </button>
            </div>
          </section>

          <section className="log">
            <h2>Battle log</h2>
            <ul>
              {state.log.slice(-40).map((entry, i) => (
                <li key={i}>{entry}</li>
              ))}
            </ul>
          </section>
        </aside>
      </main>
    </div>
  );
}
