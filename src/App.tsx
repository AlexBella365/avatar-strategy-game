import { useEffect, useRef, useState } from "react";
import Board, { FACES, PORTRAITS } from "./ui/Board";
import { TERRAIN_LEGEND } from "./ui/terrainTiles";
import { attackFxKind, type AttackFx } from "./ui/attackFx";
import { healthDeltas, type CombatText } from "./ui/combatText";
import { ATTACK_FX_DISMISS_MS, COMBAT_FLOAT_DISMISS_MS } from "./ui/animationTiming";
import { chooseAutoAction, evadeEscapes } from "./game/auto";
import PlayingCard, { MiniCard, MiniCardBack } from "./ui/PlayingCard";
import "./ui/PlayingCard.css";
import { bendingColor, bendingLabel } from "./ui/elements";
import type {
  CardDefinition,
  CharacterState,
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
import { getLegalTargets, resolveTiles } from "./game/rules/targeting";
import { cloneState, createInitialState, createTestMapTerrain, rollNorthPlayerId } from "./game/state";
import { MAPS, getMap } from "./game/maps";
import { drawCards, endRound, pendingActivations } from "./game/rules/turns";
import { getCardDefinition } from "./game/content/cards";
import { CHARACTERS } from "./game/content/characters";
import { ECONOMY_TUNING, restrictionSatisfied } from "./game/content/economy";
import type { Restriction } from "./game/types";
import { key, reachableTiles } from "./game/rules/grid";
import "./App.css";

/** Edge-row default slots (spec §4.2): north deploys row 0, south row 6.
 *  Lateral position is free per player; the interactive secret-pick UI is
 *  future work — defaults keep the demo playable on the assigned side. */
const NORTH_SLOTS: Position[] = [
  { x: 1, y: 0 },
  { x: 3, y: 0 },
  { x: 5, y: 0 },
];
const SOUTH_SLOTS: Position[] = [
  { x: 1, y: 6 },
  { x: 3, y: 6 },
  { x: 5, y: 6 },
];

/** Draftable fighters (companions like Appa/Momo enter through team rules). */
const FIGHTERS = CHARACTERS.filter((d) => !d.companion);

function demoState(picks?: { p1: string[]; p2: string[] }, mapId = "demo"): GameState {
  const pickDefs = (ids: string[]) =>
    ids.map((id) => CHARACTERS.find((d) => d.id === id)!).filter(Boolean);
  const p1 = picks && picks.p1.length === 3 ? pickDefs(picks.p1) : [CHARACTERS[0], CHARACTERS[1], CHARACTERS[2]];
  const p2 = picks && picks.p2.length === 3 ? pickDefs(picks.p2) : [CHARACTERS[3], CHARACTERS[4], CHARACTERS[5]];
  // Fresh random seed every match: both sides shuffle + draw independently.
  const seed = Math.floor(Math.random() * 1_000_000_000);
  // Seeded north/south roll — done before placement so each side picks on its row.
  const northPlayerId = rollNorthPlayerId(["p1", "p2"], seed);
  const state = createInitialState(
    [
      {
        playerId: "p1",
        characterDefs: p1,
        positions: northPlayerId === "p1" ? NORTH_SLOTS : SOUTH_SLOTS,
      },
      {
        playerId: "p2",
        characterDefs: p2,
        positions: northPlayerId === "p2" ? NORTH_SLOTS : SOUTH_SLOTS,
      },
    ],
    seed,
    { northPlayerId },
  );
  drawCards(state, "p1", ECONOMY_TUNING.drawPerRound);
  drawCards(state, "p2", ECONOMY_TUNING.drawPerRound);
  state.terrain = createTestMapTerrain(mapId);
  state.log.push("Round 1 begins (initiative: p1). Draw your cards and assign one per character.");
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

/** Build the transient attack overlay for a card play, or null if the card is
 *  not offensive. Pure: resolves affected tiles from the pre-action state. */
function buildAttackFx(
  state: GameState,
  card: CardDefinition,
  sourceId: string,
  selection: TargetOption["selection"],
  seq: number,
): AttackFx | null {
  const kind = attackFxKind(card);
  if (!kind) return null;
  const tiles = resolveTiles(state, sourceId, card, selection).map(key);
  if (tiles.length === 0) return null;
  return { kind, tiles, seq };
}

/** Build floating "-x"/"+y" callouts for the HP changes of one action. */
function buildFloats(before: GameState, after: GameState, startSeq: number): CombatText[] {
  return healthDeltas(before, after).map((d, i) => ({ ...d, seq: startSeq + i }));
}

/** How a character's assigned-ability slot reads for the current viewer (the
 *  acting side in hot-seat):
 *  - `front`: the viewer owns this character — show the assigned card's face.
 *  - `back`:  the opponent holds a face-down card here — show only the card back.
 *  - `none`:  nothing assigned to show. */
type AssignmentView = { kind: "front"; def: CardDefinition } | { kind: "back" } | { kind: "none" };

/** One character sheet: a narrower sheet flanked by a gear slot (left) and the
 *  assigned-ability slot (right). Cards replace the old "Card: …" text row. */
function SheetCard(props: {
  c: CharacterState;
  selected: boolean;
  assignment: AssignmentView;
  gear: CardDefinition[];
  onSelect: (id: string) => void;
}) {
  const { c, selected, assignment, gear, onSelect } = props;
  const charDef = CHARACTERS.find((d) => d.id === c.definitionId);
  const hpPct = Math.max(0, Math.min(100, (c.health / c.maxHealth) * 100));
  const portrait = PORTRAITS[c.definitionId];
  const bending = bendingColor(c.definitionId);
  return (
    <div className="sheet-with-slots">
      <div
        className={`sheet-slot ${gear.length > 0 ? "filled" : ""}`}
        title="Gear (equipped)"
      >
        {gear.length > 0 ? (
          gear.map((d, i) => <MiniCard key={`${d.id}-${i}`} def={d} />)
        ) : (
          <span className="slot-label">Gear</span>
        )}
      </div>
      <div
        className={`sheet ${selected ? "selected" : ""} ${c.health <= 0 ? "ko" : ""}`}
        style={{ borderTopColor: bending }}
        onClick={() => onSelect(c.id)}
      >
        {portrait ? (
          <img className="sheet-portrait" src={portrait} alt={c.definitionId} />
        ) : (
          <span className="sheet-face" aria-hidden>
            {FACES[c.definitionId] ?? "❓"}
          </span>
        )}
        <div className="sheet-body">
          <div className="sheet-title">
            <strong>{charDef?.name ?? c.definitionId}</strong>
            <span className="dim small">
              <span
                className="element-dot"
                style={{ backgroundColor: bending }}
                title={bendingLabel(c.definitionId)}
              />{" "}
              {charDef?.class}
              {c.activatedThisRound ? " · done" : ""}
            </span>
          </div>
          <div className="sheet-hp" title={`Health ${c.health}/${c.maxHealth}`}>
            <span className="sheet-hp-fill" style={{ width: `${hpPct}%` }} />
            <span className="sheet-hp-text">❤ {c.health}/{c.maxHealth}</span>
          </div>
          <div className="sheet-row">
            <span title="Focus">◉ {c.focus}</span>
            <span title="Movement spent">👟 {c.movementSpent}</span>
            {c.momentum > 0 && <span title="Momentum">🔥 Mo</span>}
          </div>
          {c.statuses.length > 0 && (
            <div className="sheet-row statuses">
              {c.statuses.map((s) => s.statusId).join(" · ")}
            </div>
          )}
          {c.avatarState && !c.avatarState.active && (
            <div className="sheet-row dim small">
              Res {c.avatarState.resonance}/{charDef?.avatarState?.threshold ?? 6}
            </div>
          )}
          {c.avatarState?.active && (
            <div className="sheet-row avatar-warn">🌀 ACTIVE — lose if KO'd!</div>
          )}
        </div>
      </div>
      <div
        className={`sheet-slot ${assignment.kind !== "none" ? "filled" : ""}`}
        title={
          assignment.kind === "back"
            ? "Face-down assigned ability"
            : "Assigned ability (this activation)"
        }
      >
        {assignment.kind === "front" ? (
          <MiniCard def={assignment.def} />
        ) : assignment.kind === "back" ? (
          <MiniCardBack />
        ) : (
          <span className="slot-label">Ability</span>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [actingSide, setActingSide] = useState("p1");
  const [selected, setSelected] = useState<string | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [targeting, setTargeting] = useState<TargetingState | null>(null);
  const [evade, setEvade] = useState<EvadeState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [autoSides, setAutoSides] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ charId: string; x: number; y: number } | null>(null);
  const [plan, setPlan] = useState<"play-first" | "move-first" | null>(null);
  const [attackFx, setAttackFx] = useState<AttackFx | null>(null);
  const [floats, setFloats] = useState<CombatText[]>([]);
  const fxSeq = useRef(0);
  const floatSeq = useRef(0);

  // Auto-dismiss the attack animation (see ui/animationTiming.ts).
  useEffect(() => {
    if (!attackFx) return;
    const t = setTimeout(() => setAttackFx(null), ATTACK_FX_DISMISS_MS);
    return () => clearTimeout(t);
  }, [attackFx]);

  // Auto-dismiss floating "-x"/"+y" callouts (see ui/animationTiming.ts).
  useEffect(() => {
    if (floats.length === 0) return;
    const t = setTimeout(() => setFloats([]), COMBAT_FLOAT_DISMISS_MS);
    return () => clearTimeout(t);
  }, [floats]);
  const [draft, setDraft] = useState<{ p1: string[]; p2: string[] }>({
    p1: ["aang", "katara", "toph"],
    p2: ["zuko", "sokka", "azula"],
  });
  const [mapId, setMapId] = useState("demo");

  const toggleAuto = (side: string) => {
    setAutoSides((prev) => {
      const next = new Set(prev);
      if (next.has(side)) next.delete(side);
      else next.add(side);
      return next;
    });
  };

  // Test-only auto-player loop (all hooks stay above the early return).
  useEffect(() => {
    if (autoSides.size === 0 || !state) return;
    if (state.winnerId !== null || state.isDraw) return;
    const ownerOf = (id: string) => state.characters.find((c) => c.id === id)?.ownerId;
    const autoPending = pendingActivations(state).filter((id) => autoSides.has(ownerOf(id) ?? ""));
    if (autoPending.length === 0) {
      if (pendingActivations(state).length > 0) return; // waiting on human
      const t = setTimeout(() => {
        const next = cloneState(state);
        endRound(next);
        setState(next);
        setSelected(null);
        setActingSide(next.initiativePlayerId);
      }, 600);
      return () => clearTimeout(t);
    }
    const side = ownerOf(autoPending[0])!;
    const action = chooseAutoAction(state, side);
    if (!action) return;
    const t = setTimeout(() => {
      const result = applyGameAction(state, action);
      if (result.errors.length > 0) {
        // Guarantee progress: pass instead of retrying a failing action.
        const characterId = (action as { characterId: string }).characterId;
        const fallback = applyGameAction(state, {
          type: "PASS_ACTIVATION",
          playerId: side,
          characterId,
        });
        if (fallback.errors.length === 0) {
          setState(fallback.state);
          setMessage(`Auto (${side}) passed after: ${result.errors[0].message}`);
        } else {
          setMessage(result.errors[0].message);
        }
        return;
      }
      setMessage(null);
      if (action.type === "PLAY_CARD") {
        const fx = buildAttackFx(
          state,
          action.card,
          action.characterId,
          action.selection,
          fxSeq.current++,
        );
        if (fx) setAttackFx(fx);
      }
      const nextFloats = buildFloats(state, result.state, floatSeq.current);
      floatSeq.current += nextFloats.length;
      if (nextFloats.length > 0) setFloats(nextFloats);
      setState(result.state);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, autoSides]);

  if (!state) {
    const toggleDraft = (side: "p1" | "p2", id: string) => {
      setDraft((prev) => {
        const cur = prev[side];
        if (cur.includes(id)) return { ...prev, [side]: cur.filter((c) => c !== id) };
        if (cur.length >= 3) return prev;
        return { ...prev, [side]: [...cur, id] };
      });
    };
    const phase: "p1" | "p2" | "done" =
      draft.p1.length < 3 ? "p1" : draft.p2.length < 3 ? "p2" : "done";
    const pickForPhase = (defId: string) => {
      if (phase === "done") {
        // Deselect (prefer the side that picked first on mirrors).
        if (draft.p1.includes(defId)) toggleDraft("p1", defId);
        else if (draft.p2.includes(defId)) toggleDraft("p2", defId);
        return;
      }
      toggleDraft(phase, defId);
    };
    const draftTile = (defId: string) => {
      const def = CHARACTERS.find((d) => d.id === defId)!;
      const inP1 = draft.p1.includes(defId);
      const inP2 = draft.p2.includes(defId);
      const portrait = PORTRAITS[defId];
      return (
        <div
          key={defId}
          className={`draft-tile ${(inP1 || inP2) ? "picked" : ""} ${phase !== "done" && !inP1 && !inP2 ? "choosable" : ""}`}
          style={{ borderColor: bendingColor(defId) }}
          onClick={() => pickForPhase(defId)}
          title={`${def.name} — ${def.element}`}
        >
          {portrait ? (
            <img className="draft-photo" src={portrait} alt={def.name} />
          ) : (
            <span className="draft-face" aria-hidden>
              {FACES[defId] ?? "❓"}
            </span>
          )}
          <span className="draft-name">{def.name}</span>
          {inP1 && <span className="draft-badge badge-p1">P1</span>}
          {inP2 && <span className="draft-badge badge-p2">P2</span>}
        </div>
      );
    };
    const versusSlot = (side: "p1" | "p2", index: number) => {
      const defId = draft[side][index];
      const def = defId ? CHARACTERS.find((d) => d.id === defId)! : null;
      const portrait = defId ? PORTRAITS[defId] : undefined;
      return (
        <div
          key={`${side}-${index}`}
          className={`versus-slot ${def ? "filled" : "empty"}`}
          style={def ? { borderColor: bendingColor(def.id) } : undefined}
        >
          {def && portrait ? (
            <img className="versus-photo" src={portrait} alt={def.name} />
          ) : def ? (
            <span className="versus-face" aria-hidden>
              {FACES[def.id] ?? "❓"}
            </span>
          ) : (
            <span className="versus-empty">?</span>
          )}
          <span className="versus-name">{def ? def.name : "—"}</span>
        </div>
      );
    };
    const ready = phase === "done";
    const map = getMap(mapId);
    const mapIndex = MAPS.findIndex((m) => m.id === map.id);
    const cycleMap = (dir: 1 | -1) =>
      setMapId(MAPS[(mapIndex + dir + MAPS.length) % MAPS.length].id);
    return (
      <div className="app">
        <header>
          <h1>Avatar Tactical Card Game — Prototype</h1>
          <p className="fan-note">
            Unofficial fan prototype. Non-commercial, no affiliation with Nickelodeon or Avatar Studios.
          </p>
        </header>
        <section className="setup versus">
          <p>
            Hot-seat 3v3 duel on a 7×7 grid. P1 drafts first, then P2 (mirror picks
            allowed), then each round: draw 5, assign 1 face-down per character, alternate
            activations (Play or Scrap + move), end the round to bank leftovers and draw again.
          </p>
          <h2 className="phase-banner">
            {phase === "done" ? "READY — FIGHT!" : `${phase.toUpperCase()} — CHOOSE YOUR FIGHTERS`}
          </h2>
          <div className="versus-grid">
            <div className="versus-side">
              <h3>P1</h3>
              {[0, 1, 2].map((i) => versusSlot("p1", i))}
            </div>
            <div className="draft-grid">{FIGHTERS.map((d) => draftTile(d.id))}</div>
            <div className="versus-side">
              <h3>P2</h3>
              {[0, 1, 2].map((i) => versusSlot("p2", i))}
            </div>
          </div>
          <div className="map-cycler">
            <button
              type="button"
              className="map-arrow"
              aria-label="Previous map"
              onClick={() => cycleMap(-1)}
            >
              ‹
            </button>
            <div className="map-info" title={map.blurb}>
              <strong>
                Map {mapIndex + 1}/{MAPS.length}: {map.name}
              </strong>
              <span className="dim small">{map.blurb}</span>
            </div>
            <button
              type="button"
              className="map-arrow"
              aria-label="Next map"
              onClick={() => cycleMap(1)}
            >
              ›
            </button>
          </div>
          <button
            disabled={!ready}
            className="fight-button"
            onClick={() => { setState(demoState(draft, mapId)); setActingSide("p1"); }}
          >
            {ready ? "⚔ FIGHT!" : `P1 ${draft.p1.length}/3 · P2 ${draft.p2.length}/3`}
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

  // Cards played since the current round began (parsed from the battle log).
  let roundStartIdx = 0;
  state.log.forEach((entry, i) => {
    if (entry.includes("begins")) roundStartIdx = i;
  });
  const turnPlays = state.log
    .slice(roundStartIdx + 1)
    .map((entry) => /^(\S+) plays (.+?) \(-/.exec(entry))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ who: m[1], what: m[2] }));

  const dispatch = (action: GameAction): boolean => {
    const result = applyGameAction(state, action);
    if (result.errors.length > 0) {
      setMessage(result.errors[0].message);
      return false;
    }
    setMessage(null);
    const nextFloats = buildFloats(state, result.state, floatSeq.current);
    floatSeq.current += nextFloats.length;
    if (nextFloats.length > 0) setFloats(nextFloats);
    setState(result.state);
    return true;
  };

  const clearTransient = () => {
    setTargeting(null);
    setEvade(null);
    setMoveMode(false);
    setAssigning(null);
    setMenu(null);
    setPlan(null);
    setAttackFx(null);
    setFloats([]);
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

  const doPlayWith = (
    card: CardDefinition,
    instanceId: string,
    selection: TargetOption["selection"],
    reactions: { characterId: string; dest: Position }[],
    afterMove: boolean,
  ) => {
    if (!selectedChar) return;
    const ok = dispatch({
      type: "PLAY_CARD",
      playerId: actingSide,
      characterId: selectedChar.id,
      cardInstanceId: instanceId,
      selection,
      card,
      reactions,
    });
    if (ok) {
      const fx = buildAttackFx(state, card, selectedChar.id, selection, fxSeq.current++);
      if (fx) setAttackFx(fx);
      setTargeting(null);
      setEvade(null);
      setPlan(null);
      if (afterMove) setMoveMode(true); // technique done — move with what is left
    }
  };

  const chooseTarget = (option: TargetOption) => {
    if (!targeting || !selectedChar) return;
    if (!option.isLegal) {
      setMessage(option.illegalReason?.message ?? "Illegal target.");
      return;
    }
    const afterMove = plan === "play-first";
    // Focused attacks offer the Evade reaction before resolving.
    if (
      targeting.card.targeting.kind === "character" &&
      option.primaryCharacterId &&
      option.primaryCharacterId !== selectedChar.id
    ) {
      const targetId = option.primaryCharacterId;
      const target = state.characters.find((c) => c.id === targetId)!;
      if (canEvade(state, targetId, targeting.card.canBeEvaded !== false).ok) {
        // Auto side evades only to tiles that actually dodge the attack.
        if (autoSides.has(target.ownerId)) {
          const escaping = getEvadeDestinations(state, targetId).filter((dest) =>
            evadeEscapes(state, selectedChar.id, targeting.card, targetId, dest),
          );
          const use =
            escaping.length > 0 ? escaping[Math.floor(Math.random() * escaping.length)] : null;
          doPlayWith(targeting.card, targeting.instanceId, option.selection, use ? [{ characterId: targetId, dest: use }] : [], afterMove);
          return;
        }
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
    doPlayWith(targeting.card, targeting.instanceId, option.selection, [], afterMove);
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
        if (plan === "move-first") {
          setPlan(null);
          setMoveMode(false);
          startPlay(true); // moved first — now play the assigned card
        } else {
          setMoveMode(false);
        }
      }
      return;
    }
    const charHere = state.characters.find((c) => c.position.x === x && c.position.y === y);
    if (charHere) onCharClick(charHere.id);
    else {
      setSelected(null);
      setMoveMode(false);
      setMenu(null);
      setPlan(null);
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
      setMoveMode(true); // show where this character can move
      setTargeting(null);
      setMenu({ charId: id, x: c.position.x, y: c.position.y });
      setPlan(null);
    } else {
      setMessage(c.health <= 0 ? "That character is knocked out." : "That character is not yours.");
    }
  };

  const startPlay = (afterMove: boolean) => {
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
    setMenu(null); // targeting takes over from here
    if (afterMove) setPlan("play-first");
    const options = getLegalTargets(state, selectedChar.id, card);
    const automatic = options.length === 1 && options[0].selection.kind === "automatic";
    if (automatic && options[0].isLegal) {
      setTargeting({ card, instanceId: assigned.id, options });
      doPlayWith(card, assigned.id, options[0].selection, [], afterMove);
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
    const other = actingSide === "p1" ? "p2" : "p1";
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
    setSelected(null);
    clearTransient();
    const nextFloats = buildFloats(state, next, floatSeq.current);
    floatSeq.current += nextFloats.length;
    if (nextFloats.length > 0) setFloats(nextFloats);
    setState(next);
    setActingSide(next.initiativePlayerId);
    setMessage(null);
  };

  /** Resolve a character's assignment into what the current viewer (the acting
   *  side) is allowed to see: the face for the owner, a card back for the
   *  opponent while the assignment is still face down. */
  const assignmentView = (charId: string): AssignmentView => {
    const owner = state.characters.find((c) => c.id === charId)?.ownerId;
    const inst = state.players.find((p) => p.id === owner)?.assignments[charId];
    if (!inst) return { kind: "none" };
    if (owner !== actingSide) return { kind: "back" }; // opponent cards stay face down
    const def = getCardDefinition(inst.definitionId);
    return def ? { kind: "front", def } : { kind: "back" };
  };

  /** The owner's own assigned card, or null when hidden/absent (used for the
   *  owner-only actions in the puck menu and activation panel). */
  const assignedDef = (charId: string): CardDefinition | null => {
    const view = assignmentView(charId);
    return view.kind === "front" ? view.def : null;
  };

  /** Equipped gear as card definitions (for the sheet's gear slot). */
  const gearDefs = (c: CharacterState): CardDefinition[] =>
    c.equippedGear
      .map((g) => getCardDefinition(g.definitionId))
      .filter((d): d is CardDefinition => d !== undefined);

  const avatarThreshold = (definitionId: string): number =>
    CHARACTERS.find((d) => d.id === definitionId)?.avatarState?.threshold ?? 6;

  const resourcesLine = (playerId: string): string => {
    const p = state.players.find((pl) => pl.id === playerId)!;
    return `⚡${p.energy} 🌀${p.chi} 🃏${p.deck.length} 🗑${p.discard.length}`;
  };

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

  /** The acting side's hand, shown under that player's own sheets (not the map). */
  const handPanel = (
    <section className="hand">
      <h2>
        {actingSide} hand ({me.teamHand.length})
        {assigning ? " — click a card, then one of your characters" : ""}
      </h2>
      {me.teamHand.length === 0 && <p className="dim">Hand empty — banked or assigned.</p>}
      <div className="hand-row">
        {me.teamHand.map((c) => {
          const def = getCardDefinition(c.definitionId);
          if (!def) return null;
          return (
            <PlayingCard
              key={c.id}
              def={def}
              assigning={assigning === c.id}
              fits={fitsWhom(def)}
              onAssign={() => setAssigning(assigning === c.id ? null : c.id)}
            />
          );
        })}
      </div>
      <p className="dim small">
        Foe hand: {foe.teamHand.length} cards (hidden). Foe chi: {foe.chi} (secret in competitive play).
      </p>
    </section>
  );

  return (
    <div className="app">
      <header>
        <h1>Avatar Tactical Card Game — Prototype</h1>
        <p>
          Round {state.round}/{state.maxRounds} · Sides: {state.northPlayerId}→north · Initiative:{" "}
          {state.initiativePlayerId} · Acting:{" "}
          <button className={actingSide === "p1" ? "active-side" : ""} onClick={() => switchSide("p1")}>P1</button>{" "}
          <button className={actingSide === "p2" ? "active-side" : ""} onClick={() => switchSide("p2")}>P2</button>
          {" · "}
          <button onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? "Hide log & legend" : "Show log & legend"}
          </button>
          {" · "}
          <button onClick={() => toggleAuto("p1")}>
            Auto P1: {autoSides.has("p1") ? "on" : "off"}
          </button>
          <button onClick={() => toggleAuto("p2")}>
            Auto P2: {autoSides.has("p2") ? "on" : "off"}
          </button>
        </p>
      </header>

      {gameOver && (
        <section className="gameover">
          <h2>{state.isDraw ? "Draw!" : `${state.winnerId} wins!`}</h2>
          <button onClick={() => { setState(demoState()); setActingSide("p1"); setSelected(null); clearTransient(); setMessage(null); }}>
            New match
          </button>
        </section>
      )}

      <main className="layout">
        <aside className="sheets-col">
          <p className="resources">{resourcesLine("p1")}</p>
          <section className="sheets">
            <h2>
              p1 sheets{actingSide === "p1" ? " (acting)" : ""}
            </h2>
            {state.characters
              .filter((c) => c.ownerId === "p1")
              .map((c) => (
                <SheetCard
                  key={c.id}
                  c={c}
                  selected={c.id === selected}
                  assignment={assignmentView(c.id)}
                  gear={gearDefs(c)}
                  onSelect={onCharClick}
                />
              ))}
          </section>
          {actingSide === "p1" && handPanel}
        </aside>
        <section className="board-col">
          <div className="board-wrap">
            <Board
              state={state}
              selectedChar={selected}
              moveTiles={moveTiles}
              legalTargetTiles={legalTargetTiles}
              legalTargetChars={legalTargetChars}
              fx={attackFx}
              floats={floats}
              onTileClick={onTileClick}
              onCharClick={onCharClick}
            />
            {menu && (() => {
              const menuChar = state.characters.find((c) => c.id === menu.charId);
              if (!menuChar || menuChar.health <= 0) return null;
              const ad = assignedDef(menu.charId);
              return (
                <div
                  className="puck-menu"
                  style={{
                    left: `${Math.min(88, Math.max(12, ((menu.x + 0.5) / 7) * 100))}%`,
                    top: `${Math.min(88, Math.max(12, ((menu.y + 0.5) / 7) * 100))}%`,
                  }}
                >
                  <div className="puck-menu-title">
                    <strong>{menuChar.definitionId}</strong>
                    <button onClick={() => { setMenu(null); setPlan(null); }}>✕</button>
                  </div>
                  <div className="dim small">Card: {ad ? ad.name : "none assigned"}</div>
                  <div className="btn-row">
                    <button disabled={!ad} onClick={() => startPlay(true)}>
                      Play first
                    </button>
                    <button onClick={() => { setPlan("move-first"); setMenu(null); setMoveMode(true); }}>
                      Move first
                    </button>
                    <button
                      disabled={!ad}
                      onClick={() => {
                        if (dispatch({ type: "SCRAP_ASSIGNED", playerId: actingSide, characterId: menu.charId })) {
                          setMenu(null);
                          setMoveMode(true);
                        }
                      }}
                    >
                      Scrap
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
          {message && <p className="message">{message}</p>}
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
                <button key={`${d.x},${d.y}`} onClick={() => doPlayWith(evade.card, evade.instanceId, evade.selection, [{ characterId: evade.targetId, dest: d }], plan === "play-first")}>
                  ({d.x},{d.y})
                </button>
              ))}
              <button onClick={() => doPlayWith(evade.card, evade.instanceId, evade.selection, [], plan === "play-first")}>Take the hit</button>
            </div>
          )}
        </section>

        <aside className="side-col">
          <p className="resources">{resourcesLine("p2")}</p>
          <section className="sheets">
            <h2>
              p2 sheets{actingSide === "p2" ? " (acting)" : ""}
            </h2>
            {state.characters
              .filter((c) => c.ownerId === "p2")
              .map((c) => (
                <SheetCard
                  key={c.id}
                  c={c}
                  selected={c.id === selected}
                  assignment={assignmentView(c.id)}
                  gear={gearDefs(c)}
                  onSelect={onCharClick}
                />
              ))}
          </section>

          {actingSide === "p2" && handPanel}

          <section className="turn-feed">
            <h2>This round's plays</h2>
            {turnPlays.length === 0 ? (
              <p className="dim small">No cards played yet this round.</p>
            ) : (
              <ul>
                {turnPlays.map((p, i) => (
                  <li key={i}>
                    <strong>{p.who}</strong> played <strong>{p.what}</strong>
                  </li>
                ))}
              </ul>
            )}
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
                  <button onClick={() => startPlay(true)} disabled={!assignedDef(selectedChar.id)}>Play</button>
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
                onClick={() => { setState(demoState()); setActingSide("p1"); setSelected(null); clearTransient(); setMessage(null); }}
              >
                New match
              </button>
            </div>
          </section>
        </aside>

        {sidebarOpen && (
          <aside className="info-sidebar">
            <button className="drawer-close" onClick={() => setSidebarOpen(false)}>
              Close ✕
            </button>
            <section className="legend">
              <h2>Legend</h2>
              <ul>
                <li>❤ health · ◉ Focus (Evade + Avatar State)</li>
                <li>⚡ Energy (4/round) · 🌀 chi bank · 🃏 deck · 🗑 discard</li>
                <li>🌀 active Avatar (KO = instant loss) · Res n/6 meter</li>
                <li>⚙n equipped Gear · 🃏 face-down assigned card</li>
                <li>OB OffBalance · EX Exposed · BD Bound · XH Exhausted</li>
                <li>Green: reachable · Red: legal target</li>
              </ul>
              <h2>Terrain</h2>
              <ul className="terrain-legend">
                {TERRAIN_LEGEND.map((t) => (
                  <li key={t.cls}>
                    <span
                      className="terrain-swatch"
                      style={{
                        backgroundColor: t.color,
                        backgroundImage: t.tile ? `url(${t.tile})` : undefined,
                      }}
                      aria-hidden
                    >
                      {t.tile ? "" : t.glyph}
                    </span>
                    <span>
                      <strong>{t.label}</strong> — {t.blurb}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="log">
              <h2>Battle log</h2>
              <ul>
                {state.log.slice(-60).map((entry, i) => (
                  <li key={i}>{entry}</li>
                ))}
              </ul>
            </section>
          </aside>
        )}
      </main>
    </div>
  );
}
