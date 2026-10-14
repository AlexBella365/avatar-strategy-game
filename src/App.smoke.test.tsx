// @vitest-environment jsdom
// UI smoke test: welcome -> start -> full game view renders (no blank screen).
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("demo smoke", () => {
  it("starts a match and renders board, sheets, and hand", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /fight/i }));
    expect(document.querySelectorAll(".tile")).toHaveLength(49);
    expect(document.querySelectorAll(".sheet").length).toBeGreaterThanOrEqual(6);
    expect(document.querySelectorAll(".puck").length).toBeGreaterThanOrEqual(6);
    expect(document.querySelectorAll(".playing-card").length).toBeGreaterThan(0);
  });
});
