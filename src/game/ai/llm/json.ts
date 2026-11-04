// Tiny hand-rolled validators (no zod, no runtime deps). Every failure is a
// *value*, never a throw, so callers can cleanly fall back to Track A
// (specs/npc_ai_plan.md §3 B.4).
export type Parsed<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function ok<T>(value: T): Parsed<T> {
  return { ok: true, value };
}

export function fail<T = never>(error: string): Parsed<T> {
  return { ok: false, error };
}

/**
 * Extract the first balanced `{...}` object from model text. Tolerates prose
 * preamble, markdown fences, and trailing chatter — small models produce all
 * three even when asked for "JSON only".
 */
export function parseJsonObject(text: unknown): Parsed<Record<string, unknown>> {
  if (typeof text !== "string") return fail("not a string");
  const start = text.indexOf("{");
  if (start === -1) return fail("no JSON object found");
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const slice = text.slice(start, i + 1);
        try {
          const value: unknown = JSON.parse(slice);
          if (value && typeof value === "object" && !Array.isArray(value)) {
            return ok(value as Record<string, unknown>);
          }
          return fail("top-level JSON is not an object");
        } catch (err) {
          return fail(`invalid JSON: ${(err as Error).message}`);
        }
      }
    }
  }
  return fail("unbalanced JSON object");
}

export type Validator<T> = (value: unknown) => Parsed<T>;

export function vEnum<T extends string>(allowed: readonly T[]): Validator<T> {
  return (value) =>
    typeof value === "string" && (allowed as readonly string[]).includes(value)
      ? ok(value as T)
      : fail(`expected one of ${allowed.join("|")}`);
}

export function vString(): Validator<string> {
  return (value) => (typeof value === "string" ? ok(value) : fail("expected string"));
}

/** Accepts numbers and numeric strings (models like to quote numbers). */
export function vFinite(min = -Infinity, max = Infinity): Validator<number> {
  return (value) => {
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : NaN;
    return Number.isFinite(n) && n >= min && n <= max
      ? ok(n)
      : fail(`expected number in [${min},${max}]`);
  };
}

export function vOptional<T>(parse: Validator<T>): Validator<T | undefined> {
  return (value) => (value === undefined || value === null ? ok(undefined) : parse(value));
}

export function vObject<T extends Record<string, unknown>>(shape: {
  [K in keyof T]: Validator<T[K]>;
}): Validator<T> {
  return (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return fail("expected object");
    }
    const src = value as Record<string, unknown>;
    const out = {} as T;
    for (const key of Object.keys(shape) as (keyof T)[]) {
      const parsed = shape[key](src[key as string]);
      if (!parsed.ok) return fail(`${String(key)}: ${parsed.error}`);
      out[key] = parsed.value;
    }
    return ok(out);
  };
}
