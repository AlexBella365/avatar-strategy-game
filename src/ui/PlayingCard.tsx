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

/** Our technique cards with a classic playing-card look. */
export default function PlayingCard({ def, assigning, fits, onAssign }: PlayingCardProps) {
  const suit = ELEMENT_SUIT[def.element ?? ""] ?? "⚙️";
  const kind = def.economy?.kind ?? def.cardType;
  return (
    <div
      className={`playing-card kind-${kind} ${assigning ? "assigning" : ""}`}
      onClick={onAssign}
      title={def.rulesText}
    >
      <div className="pc-corner pc-tl">
        <span className="pc-cost">⚡{def.energyCost}</span>
        <span className="pc-suit">{suit}</span>
      </div>
      <div className="pc-corner pc-br">
        <span className="pc-cost">🌀{def.economy?.chiCost ?? 0}</span>
        <span className="pc-suit">{suit}</span>
      </div>
      <div className="pc-name">{def.name}</div>
      <div className="pc-art">{def.art ?? suit}</div>
      <div className="pc-kind">{kind}</div>
      <div className="pc-rules">{def.rulesText}</div>
      <div className="pc-fits">Fits: {fits}</div>
      <div className="pc-bank">⇪ {def.economy?.value ?? 1} chi banked</div>
    </div>
  );
}
