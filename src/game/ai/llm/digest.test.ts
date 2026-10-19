import { describe, expect, it } from "vitest";
import { setup } from "../../testutils";
import { buildDigest } from "./digest";

function handOf(state: ReturnType<typeof setup>, playerId: string) {
  return state.players.find((p) => p.id === playerId)!.teamHand;
}

describe("buildDigest", () => {
  it("includes your own hand and character stats", () => {
    const state = setup();
    handOf(state, "p1").push({ id: "h1", definitionId: "water-whip" });
    const digest = buildDigest(state, "p1");
    expect(digest).toContain("Your hand");
    expect(digest).toContain("Water Whip");
    expect(digest).toContain("hp ");
  });

  it("never leaks the opponent's hidden hand", () => {
    const state = setup();
    handOf(state, "p1").length = 0;
    handOf(state, "p2").push({ id: "h2", definitionId: "miraculous-balm" });
    const digest = buildDigest(state, "p1");
    expect(digest).not.toContain("Miraculous Balm");
    // The same state seen from p2's seat *does* show it.
    expect(buildDigest(state, "p2")).toContain("Miraculous Balm");
  });

  it("is deterministic for the same state and seat", () => {
    const state = setup();
    expect(buildDigest(state, "p1")).toBe(buildDigest(state, "p1"));
  });

  it("honors the maxChars cap", () => {
    const state = setup();
    const digest = buildDigest(state, "p1", { maxChars: 40 });
    expect(digest.length).toBeLessThanOrEqual(40);
  });
});
