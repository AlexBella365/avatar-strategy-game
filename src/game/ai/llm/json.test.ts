import { describe, expect, it } from "vitest";
import { parseJsonObject, vEnum, vFinite, vObject, vOptional, vString } from "./json";

describe("parseJsonObject", () => {
  it("parses a plain object", () => {
    const r = parseJsonObject('{"a":1}');
    expect(r.ok && r.value).toEqual({ a: 1 });
  });

  it("tolerates markdown fences and prose", () => {
    const r = parseJsonObject('Sure!\n```json\n{"stance":"aggressive"}\n```');
    expect(r.ok && r.value.stance).toBe("aggressive");
  });

  it("takes the first balanced object and ignores trailing chatter", () => {
    const r = parseJsonObject('{"a":{"b":2}} and then {oops');
    expect(r.ok && r.value).toEqual({ a: { b: 2 } });
  });

  it("ignores braces inside strings", () => {
    const r = parseJsonObject('{"notes":"use {} wisely"}');
    expect(r.ok && r.value).toEqual({ notes: "use {} wisely" });
  });

  it("fails cleanly on non-JSON", () => {
    expect(parseJsonObject("no object here").ok).toBe(false);
    expect(parseJsonObject(undefined).ok).toBe(false);
  });
});

describe("validators", () => {
  it("vEnum accepts allowed values only", () => {
    const v = vEnum(["a", "b"] as const);
    expect(v("a").ok).toBe(true);
    expect(v("c").ok).toBe(false);
  });

  it("vFinite coerces numeric strings and enforces bounds", () => {
    expect(vFinite(0, 1)("0.5").ok).toBe(true);
    expect(vFinite(0, 1)(2).ok).toBe(false);
    expect(vFinite()("nope").ok).toBe(false);
  });

  it("vOptional passes undefined/null through", () => {
    const v = vOptional(vString());
    expect(v(undefined).ok).toBe(true);
    expect(v(null).ok).toBe(true);
    expect(v(7).ok).toBe(false);
  });

  it("vObject reports the failing field", () => {
    const v = vObject<{ a: string; b?: number }>({ a: vString(), b: vOptional(vFinite()) });
    expect(v({ a: "x" }).ok).toBe(true);
    const bad = v({ a: 3 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain("a:");
  });
});
