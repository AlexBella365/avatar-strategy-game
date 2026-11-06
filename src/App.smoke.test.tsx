// @vitest-environment jsdom
// UI smoke test: welcome -> start -> full game view renders (no blank screen).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { CARDS } from "./game/content/cards";
import { CHARACTERS } from "./game/content/characters";
import { PORTRAITS } from "./ui/Board";

afterEach(cleanup);

describe("demo smoke", () => {
  it("shows the full character roster and uses an artwork placeholder when needed", () => {
    render(<App />);

    expect(document.querySelectorAll(".draft-tile")).toHaveLength(CHARACTERS.length);
    expect(
      Array.from(document.querySelectorAll(".draft-name"), (name) => name.textContent),
    ).toEqual(CHARACTERS.map((character) => character.name).sort((a, b) => a.localeCompare(b)));
    for (const id of Object.keys(PORTRAITS)) {
      expect(CHARACTERS.some((character) => character.id === id), `${id} has a portrait`).toBe(true);
    }
    for (const character of CHARACTERS) {
      const tile = screen.getByRole("button", {
        name: `${character.name}, ${character.element}`,
      }) as HTMLButtonElement;
      expect(tile.disabled).toBe(false);
    }

    const aangTile = screen.getByRole("button", { name: "Aang, avatar" });
    const aangPortrait = aangTile.querySelector("img");
    if (!aangPortrait) throw new Error("Aang portrait should render before simulating a load failure");
    fireEvent.error(aangPortrait);
    expect(within(aangTile).getByRole("img", { name: "Aang artwork placeholder" })).toBeTruthy();
  });

  it("allows Appa and Momo to be drafted as fighters", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Aang, avatar" }));
    await user.click(screen.getByRole("button", { name: "Katara, water" }));
    await user.click(screen.getByRole("button", { name: "Toph, earth" }));
    await user.click(screen.getByRole("button", { name: "Appa, air" }));
    await user.click(screen.getByRole("button", { name: "Momo, nonbender" }));
    await user.click(screen.getByRole("button", { name: "Aang, avatar" }));
    await user.click(screen.getByRole("button", { name: /fight/i }));

    const p1Sheets = document.querySelector(".sheets-col")?.textContent ?? "";
    expect(p1Sheets).toContain("Appa");
    expect(p1Sheets).toContain("Momo");
  });

  it("starts a match and renders board, sheets, and hand", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /fight/i }));
    expect(screen.getByLabelText("Latest action").textContent).toContain(
      "Round 1 begins (initiative:",
    );
    expect(document.querySelectorAll(".tile")).toHaveLength(49);
    expect(document.querySelectorAll(".sheet").length).toBeGreaterThanOrEqual(6);
    expect(document.querySelectorAll(".puck").length).toBeGreaterThanOrEqual(6);
    expect(document.querySelectorAll(".playing-card").length).toBeGreaterThan(0);
    // Ability text is printed verbatim on every card face (never tooltip-only).
    const rules = document.querySelectorAll(".pc-rules");
    expect(rules.length).toBeGreaterThan(0);
    for (const el of rules) expect((el.textContent ?? "").trim().length).toBeGreaterThan(0);
    // Each sheet is flanked by two dotted slots (gear + ability).
    const slotRows = document.querySelectorAll(".sheet-with-slots");
    expect(slotRows.length).toBeGreaterThanOrEqual(6);
    for (const row of slotRows) expect(row.querySelectorAll(".sheet-slot").length).toBe(2);
  });

  it("shows an assigned card face-up to its owner and a card back to the opponent", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /fight/i }));

    // Assign a p1 card to p1's first character (picking one that actually fits).
    const firstP1Sheet = document.querySelector(".sheets-col .sheet") as HTMLElement;
    const ownerMini = () =>
      document.querySelector(".sheets-col .sheet-slot .mini-card:not(.mini-back)");
    for (const card of Array.from(document.querySelectorAll<HTMLElement>(".hand-row .playing-card"))) {
      await user.click(card);
      await user.click(firstP1Sheet);
      if (ownerMini()) break;
    }
    // The owner sees the assigned card's face on their own sheet.
    expect(ownerMini()).toBeTruthy();
    expect(document.querySelectorAll(".sheets-col .mini-back").length).toBe(0);

    // Pass the view to the opponent: the same face-down card is now shown as a back.
    await user.click(screen.getByRole("button", { name: "P2" }));
    expect(document.querySelector(".sheets-col .mini-back")).toBeTruthy();
    expect(document.querySelector(".sheets-col .mini-card:not(.mini-back)")).toBeFalsy();
  });

  it("sorts and filters the card roster", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /fight/i }));
    await user.click(screen.getByRole("button", { name: "Card roster" }));

    const visibleNames = () =>
      Array.from(document.querySelectorAll(".roster-card .pc-name"), (node) => node.textContent);
    const expectedAlphabetical = [...CARDS].map((card) => card.name).sort((a, b) => a.localeCompare(b));
    expect(visibleNames()).toEqual(expectedAlphabetical);

    await user.selectOptions(screen.getByLabelText("Sort cards"), "type");
    const expectedByType = [...CARDS]
      .sort((a, b) => a.cardType.localeCompare(b.cardType) || a.name.localeCompare(b.name))
      .map((card) => card.name);
    expect(visibleNames()).toEqual(expectedByType);

    await user.selectOptions(screen.getByLabelText("Filter card type"), "attack");
    expect(visibleNames()).toHaveLength(CARDS.filter((card) => card.cardType === "attack").length);
  });
});
