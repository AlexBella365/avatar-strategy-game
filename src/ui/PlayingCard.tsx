import { CHARACTERS } from "../game/content/characters";
import type { CardDefinition, Restriction, Targeting } from "../game/types";
import "./PlayingCard.css";

const ELEMENT_SUIT: Record<string, string> = {
  water: "🌊",
  fire: "🔥",
  earth: "🪨",
  air: "🌪️",
  nonbender: "🪃",
};

const KIND_ICON: Record<string, string> = {
  attack: "⚔",
  defense: "⛨",
  gear: "⚙",
};

function affinityBadge(restrictions: Restriction[] = []) {
  const unique = restrictions.find((restriction) => restriction.type === "unique");
  if (unique?.type === "unique") {
    const character = CHARACTERS.find((entry) => entry.id === unique.characterId);
    return {
      className: "character",
      label: `${character?.name ?? unique.characterId} only`,
      portrait: `/faces/${unique.characterId}.webp`,
      marks: [] as string[],
    };
  }

  const elements = restrictions
    .filter((restriction): restriction is Extract<Restriction, { type: "element" }> => restriction.type === "element")
    .flatMap((restriction) => restriction.elements)
    .filter((element, index, all) => all.indexOf(element) === index);
  if (elements.length) {
    return {
      className: "element",
      label: `${elements.map((element) => `${element}bender`).join(" or ")} only`,
      marks: elements.map((element) => ELEMENT_SUIT[element] ?? "✦"),
    };
  }

  const alignment = restrictions.find((restriction) => restriction.type === "alignment");
  if (alignment?.type === "alignment") {
    return {
      className: "alignment",
      label: `${alignment.alignment === "hero" ? "Heroes" : "Villains"} only`,
      marks: [alignment.alignment === "hero" ? "☀" : "☾"],
    };
  }

  const team = restrictions.find((restriction) => restriction.type === "team");
  if (team?.type === "team") {
    const label = team.teamId === "team-avatar" ? "Team Avatar" : team.teamId;
    return {
      className: "team",
      label: `${label} only`,
      marks: ["👥"],
    };
  }

  return { className: "open", label: "Any character", marks: ["✦"] };
}

function combatBadge(targeting: Targeting) {
  switch (targeting.kind) {
    case "self":
      return { className: "self", label: "Self", mark: "●" };
    case "character":
      if (targeting.range === "melee") return { className: "melee", label: "Melee", mark: "⚔" };
      if (targeting.range === "any") return { className: "ranged", label: "Any range", mark: "⌁" };
      return { className: "ranged", label: `Range ${targeting.range}`, mark: "➹" };
    case "tile":
      return { className: "tile", label: targeting.range === "any" ? "Any tile" : `Tile ${targeting.range}`, mark: "◇" };
    case "direction":
      return { className: "line", label: `Line ${targeting.maxLength}`, mark: "↠" };
    case "area":
      return { className: "area", label: "Area", mark: "✹" };
  }
}

function symbolElement(def: CardDefinition): string {
  if (def.tags.some((tag) => ["machine", "machines", "technology", "tech", "techno"].includes(tag.toLowerCase()))) {
    return "technology";
  }
  return def.element ?? "neutral";
}

interface PlayingCardProps {
  def: CardDefinition;
  assigning: boolean;
  fits: string;
  onAssign: () => void;
}

/** Compact card token for the sheet-side slots (assigned ability / gear). */
export function MiniCard({ def, scouted = false }: { def: CardDefinition; scouted?: boolean }) {
  const suit = ELEMENT_SUIT[def.element ?? ""] ?? "⚙️";
  const kind = def.economy?.kind ?? def.cardType;
  const elementClass = symbolElement(def);
  return (
    <div className={`mini-card kind-${kind} element-${elementClass} ${scouted ? "scouted" : ""}`} title={`${scouted ? "Scouted card\n" : ""}${def.name}\n${def.rulesText}`}>
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
  const affinity = affinityBadge(def.economy?.restrictions);
  const combat = combatBadge(def.targeting);
  const elementClass = symbolElement(def);
  const title = [
    def.name,
    def.rulesText,
    `Fits: ${fits}`,
    `Cost: ⚡${def.energyCost}${chi ? ` + 🌀${chi} chi` : ""} · ⇪${bank} chi banked`,
  ].join("\n");
  return (
    <div
      className={`playing-card kind-${kind} element-${elementClass} ${assigning ? "assigning" : ""}`}
      onClick={onAssign}
      title={title}
    >
      <div className="pc-meta-row">
        <div className="pc-costs" aria-label={`Energy cost ${def.energyCost}; chi cost ${chi}`}>
          <span className="pc-cost">⚡ {def.energyCost}</span>
          <span className="pc-cost">🌀 {chi}</span>
        </div>
        <div className={`pc-combat pc-combat-${combat.className}`} title={combat.label}>
          <span aria-hidden="true">{combat.mark}</span> {combat.label}
        </div>
      </div>
      <div className={`pc-type-ribbon kind-${kind}`} aria-label={`${kind} card`}>
        <span aria-hidden="true">{KIND_ICON[kind] ?? "✦"}</span> {kind}
      </div>
      <div className="pc-name">{def.name}</div>
      <div className="pc-art">{def.art ?? suit}</div>
      <div className="pc-rules">{def.rulesText}</div>
      <div className={`pc-affinity pc-affinity-${affinity.className}`} title={affinity.label} aria-label={affinity.label}>
        {affinity.portrait ? (
          <img src={affinity.portrait} alt="" />
        ) : (
          affinity.marks.map((mark, index) => <span key={`${mark}-${index}`} aria-hidden="true">{mark}</span>)
        )}
      </div>
    </div>
  );
}
