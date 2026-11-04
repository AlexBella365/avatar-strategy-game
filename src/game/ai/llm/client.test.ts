import { describe, expect, it } from "vitest";
import {
  buildRequest,
  extractChatText,
  joinUrl,
  parseChatResponse,
  postChatJSON,
} from "./client";
import { LlmError } from "./types";
import type { HttpPost, LlmConfig } from "./types";

const base: LlmConfig = {
  baseUrl: "http://localhost:11434",
  model: "qwen3.5:0.8b",
  wire: "ollama",
  timeoutMs: 1000,
  temperature: 0.2,
  maxTokens: 200,
};

const msgs = [{ role: "user" as const, content: "hi" }];

describe("buildRequest", () => {
  it("targets /api/chat for the ollama wire with think:false + json format", () => {
    const req = buildRequest(base, msgs);
    expect(req.url).toBe("http://localhost:11434/api/chat");
    const body = JSON.parse(req.body);
    expect(body.think).toBe(false);
    expect(body.format).toBe("json");
    expect(body.stream).toBe(false);
    expect(body.options.num_predict).toBe(200);
  });

  it("targets /chat/completions for the openai wire and sends the bearer token", () => {
    const req = buildRequest(
      { ...base, wire: "openai", baseUrl: "https://api.example.com/v1", apiKey: "sk-x" },
      msgs,
    );
    expect(req.url).toBe("https://api.example.com/v1/chat/completions");
    expect(req.headers.Authorization).toBe("Bearer sk-x");
    expect(JSON.parse(req.body).response_format).toEqual({ type: "json_object" });
  });

  it("joinUrl collapses duplicate slashes", () => {
    expect(joinUrl("http://x/", "/api/chat")).toBe("http://x/api/chat");
  });
});

describe("parseChatResponse", () => {
  it("reads ollama content + token counts", () => {
    const r = parseChatResponse("ollama", {
      message: { content: '{"a":1}' },
      prompt_eval_count: 10,
      eval_count: 5,
    });
    expect(r).toEqual({ text: '{"a":1}', inputTokens: 10, outputTokens: 5 });
  });

  it("recovers openai reasoning output when content is empty", () => {
    const r = parseChatResponse("openai", {
      choices: [{ message: { content: "", reasoning: '{"stance":"turtle"}' } }],
      usage: { prompt_tokens: 3, completion_tokens: 4 },
    });
    expect(r.text).toBe('{"stance":"turtle"}');
    expect(r.outputTokens).toBe(4);
  });

  it("throws a parse error on a null body", () => {
    expect(() => parseChatResponse("openai", null)).toThrowError(LlmError);
  });

  it("extractChatText delegates to the parser", () => {
    expect(extractChatText("ollama", { message: { content: "ok" } })).toBe("ok");
  });
});

/** Scripted fake HTTP seam (no network). */
function fakeHttp(steps: Array<{ status?: number; body: unknown } | Error>) {
  let calls = 0;
  const http: HttpPost = async (_url, _init) => {
    const step = steps[Math.min(calls, steps.length - 1)];
    calls += 1;
    if (step instanceof Error) throw step;
    return { status: step.status ?? 200, body: step.body };
  };
  return { http, calls: () => calls };
}

const ollamaBody = (content: string) => ({ message: { content }, eval_count: 1, prompt_eval_count: 2 });

describe("postChatJSON", () => {
  it("returns text + usage on success", async () => {
    const { http } = fakeHttp([{ body: ollamaBody('{"a":1}') }]);
    const res = await postChatJSON(base, msgs, { http });
    expect(res.text).toBe('{"a":1}');
    expect(res.usage).toEqual({ inputTokens: 2, outputTokens: 1 });
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("does not retry HTTP errors", async () => {
    const { http, calls } = fakeHttp([{ status: 500, body: {} }, { body: ollamaBody("ok") }]);
    await expect(postChatJSON(base, msgs, { http })).rejects.toMatchObject({ kind: "http" });
    expect(calls()).toBe(1);
  });

  it("retries once on a network error", async () => {
    const { http, calls } = fakeHttp([new Error("boom"), { body: ollamaBody("ok") }]);
    const res = await postChatJSON(base, msgs, { http });
    expect(res.text).toBe("ok");
    expect(calls()).toBe(2);
  });

  it("does not retry parse errors", async () => {
    const { http, calls } = fakeHttp([{ body: null }, { body: ollamaBody("ok") }]);
    await expect(postChatJSON(base, msgs, { http })).rejects.toMatchObject({ kind: "parse" });
    expect(calls()).toBe(1);
  });

  it("aborts on timeout and reports kind=timeout", async () => {
    const http: HttpPost = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    await expect(
      postChatJSON({ ...base, timeoutMs: 5 }, msgs, { http, retries: 0 }),
    ).rejects.toMatchObject({ kind: "timeout" });
  });
});
