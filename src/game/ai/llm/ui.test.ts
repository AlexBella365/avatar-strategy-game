import { describe, expect, it, vi } from "vitest";
import { cloneState } from "../../state";
import { setup } from "../../testutils";
import { createStrategyController } from "./ui";
import type { EnvLike } from "./ui";
import type { HttpPost } from "./types";

const env: EnvLike = { VITE_AI_LLM: "1", VITE_LLM_BASE_URL: "http://localhost:11434" };

function fakeHttp(content: string): HttpPost {
  return async () => ({ status: 200, body: { message: { content } } });
}

describe("createStrategyController", () => {
  it("returns null when Track B is disabled", () => {
    expect(createStrategyController({ env: {}, onChange: () => {} })).toBeNull();
  });

  it("starts a request, then serves the advice on the next tick", async () => {
    const onChange = vi.fn();
    const controller = createStrategyController({
      env,
      onChange,
      http: fakeHttp('{"stance":"aggressive","notes":"press"}'),
    })!;

    const state = setup();
    expect(controller.adviceFor(state, "p1")).toBeUndefined();
    expect(controller.status()).toBeNull();

    await vi.waitFor(() => expect(controller.status()).not.toBeNull());
    expect(controller.status()).toContain("aggressive");
    const deltas = controller.adviceFor(state, "p1");
    expect(deltas?.damage).toBeGreaterThan(0);
    expect(onChange).toHaveBeenCalled();
  });

  it("drops a late response once the round has advanced", async () => {
    const resolvers: Array<() => void> = [];
    const http: HttpPost = () =>
      new Promise((resolve) => {
        resolvers.push(() =>
          resolve({ status: 200, body: { message: { content: '{"stance":"turtle"}' } } }),
        );
      });
    const controller = createStrategyController({ env, onChange: () => {}, http })!;

    const state = setup();
    controller.adviceFor(state, "p1"); // request for round 1

    const later = cloneState(state);
    later.round += 1;
    controller.adviceFor(later, "p1"); // advances to round 2, second request

    resolvers[0]?.(); // the round-1 response arrives stale
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.status()).toBeNull();

    resolvers[1]?.(); // clean up the pending round-2 request
    await Promise.resolve();
  });

  it("reports a graceful fallback when the model is unavailable", async () => {
    const http: HttpPost = async () => ({ status: 500, body: {} });
    const controller = createStrategyController({ env, onChange: () => {}, http })!;
    controller.adviceFor(setup(), "p1");
    await vi.waitFor(() => expect(controller.status()).not.toBeNull());
    expect(controller.status()).toContain("Track A");
    expect(controller.metrics().calls).toBe(0);
  });
});
