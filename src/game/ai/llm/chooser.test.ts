import { describe, expect, it } from "vitest";
import {
  buildChooserMessages,
  parseChooserReply,
  shouldAsk,
  toCandidates,
  topTwoGap,
} from "./chooser";
import type { Scored } from "../types";

function scored(score: number, label: string): Scored<number> {
  return { value: 0, score, components: { damage: score }, label };
}

describe("shouldAsk", () => {
  it("is false with fewer than two candidates", () => {
    expect(shouldAsk([scored(1, "only")])).toBe(false);
  });

  it("asks when the top two are close", () => {
    expect(shouldAsk([scored(1.0, "a"), scored(0.98, "b")])).toBe(true);
  });

  it("stays quiet when the scorer is confident", () => {
    expect(shouldAsk([scored(1.0, "a"), scored(0.5, "b")])).toBe(false);
  });

  it("topTwoGap reports Infinity for a single candidate", () => {
    expect(topTwoGap([scored(1, "a")])).toBe(Infinity);
  });
});

describe("toCandidates", () => {
  it("numbers candidates from zero and caps at k", () => {
    const ranked = [scored(1, "a"), scored(0.9, "b"), scored(0.8, "c")];
    const c = toCandidates(ranked, 2);
    expect(c.map((x) => x.id)).toEqual([0, 1]);
    expect(c[0].label).toBe("a");
  });
});

describe("parseChooserReply", () => {
  it("accepts an in-range id and keeps the rationale", () => {
    const r = parseChooserReply('{"choiceId":2,"rationale":"flank"}', 3);
    expect(r.ok && r.value).toEqual({ choiceId: 2, rationale: "flank" });
  });

  it("tolerates string ids", () => {
    const r = parseChooserReply('{"choiceId":"1"}', 3);
    expect(r.ok && r.value.choiceId).toBe(1);
  });

  it("rejects an out-of-range id", () => {
    expect(parseChooserReply('{"choiceId":5}', 3).ok).toBe(false);
    expect(parseChooserReply('{"choiceId":-1}', 3).ok).toBe(false);
  });

  it("rejects non-JSON", () => {
    expect(parseChooserReply("attack the nearest", 3).ok).toBe(false);
  });
});

describe("buildChooserMessages", () => {
  it("lists every offered option with its id", () => {
    const msgs = buildChooserMessages("DIGEST", toCandidates([scored(1, "move"), scored(0.9, "hit")]));
    const user = msgs[msgs.length - 1].content;
    expect(user).toContain("0. move");
    expect(user).toContain("1. hit");
    expect(user).toContain("DIGEST");
  });
});
