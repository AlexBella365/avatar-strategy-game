// @vitest-environment jsdom
// UI smoke test: welcome -> start -> full game view renders (no blank screen).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

afterEach(cleanup);

describe("demo smoke", () => {
  it("starts a match and renders board, sheets, and hand", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /fight/i }));
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
});
