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

/** Our technique cards with a classic playing-card look. Each card shares the
 *  hand's width; the rules/fit/bank detail lives in the hover tooltip so the
 *  whole draw stays legible in one row. */
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
      <div className="pc-kind">{kind}</div>
    </div>
  );
}
