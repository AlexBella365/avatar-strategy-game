import type { CardDefinition } from "../game/types";
import "./PlayingCard.css";

const ELEMENT_SUIT: Record<string, string> = {
  water: "🌊",
  fire: "🔥",
  earth: "🪨",
  air: "🌪️",
  nonbender: "🪃",
};

interface PlayingCardProps {
  def: CardDefinition;
  assigning: boolean;
  fits: string;
  onAssign: () => void;
}

/** Compact card token for the sheet-side slots (assigned ability / gear). */
export function MiniCard({ def }: { def: CardDefinition }) {
  const suit = ELEMENT_SUIT[def.element ?? ""] ?? "⚙️";
  const kind = def.economy?.kind ?? def.cardType;
  return (
    <div className={`mini-card kind-${kind}`} title={`${def.name}\n${def.rulesText}`}>
      <span className="mini-art">{def.art ?? suit}</span>
      <span className="mini-name">{def.name}</span>
    </div>
  );
}

/** Face-down card back for a hidden (opponent) assignment. Uses the shared
 *  card-back art (public/card_back.png, served at /card_back.png). */
export function MiniCardBack() {
  return (
    <div
      className="mini-card mini-back"
      title="Face-down card"
      role="img"
      aria-label="Face-down card"
    />
  );
}

/** Our technique cards with a classic playing-card look. Each card shares the
 *  hand's width; the full rules text is printed verbatim on the face (spec:
 *  never abbreviated), with fit/bank detail in the hover tooltip. */
export default function PlayingCard({ def, assigning, fits, onAssign }: PlayingCardProps) {
  const suit = ELEMENT_SUIT[def.element ?? ""] ?? "⚙️";
  const kind = def.economy?.kind ?? def.cardType;
  const chi = def.economy?.chiCost ?? 0;
  const bank = def.economy?.value ?? 1;
  const title = [
    def.name,
    def.rulesText,
    `Fits: ${fits}`,
    `Cost: ⚡${def.energyCost}${chi ? ` + 🌀${chi} chi` : ""} · ⇪${bank} chi banked`,
  ].join("\n");
  return (
    <div
      className={`playing-card kind-${kind} ${assigning ? "assigning" : ""}`}
      onClick={onAssign}
      title={title}
    >
      <div className="pc-corner pc-tl">
        <span className="pc-cost">⚡{def.energyCost}</span>
        <span className="pc-suit">{suit}</span>
      </div>
      <div className="pc-corner pc-br">
        <span className="pc-cost">🌀{chi}</span>
        <span className="pc-suit">{suit}</span>
      </div>
      <div className="pc-name">{def.name}</div>
      <div className="pc-art">{def.art ?? suit}</div>
      <div className="pc-rules">{def.rulesText}</div>
      <div className="pc-kind">{kind}</div>
    </div>
  );
}
