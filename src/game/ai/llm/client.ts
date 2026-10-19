// Zero-dependency LLM client: a plain `fetch` wrapper (specs/npc_ai_plan.md §3
// B.4). Two wire formats, one interface:
//
//   openai — POST {base}/chat/completions. Portable across OpenAI, Azure,
//            OpenRouter, LM Studio, vLLM, and Ollama's compatibility shim.
//   ollama — POST {base}/api/chat with think:false + format:json. Needed
//            because Ollama 0.40's OpenAI shim routes *thinking* models'
//            output into `reasoning` and returns empty `content` (verified
//            against qwen3.5:0.8b and bonsai-2), while /api/chat with
//            think:false returns clean, fast JSON.
import { LlmError } from "./types";
import type {
  ChatMessage,
  HttpPost,
  LlmConfig,
  LlmResponse,
  LlmWire,
} from "./types";

export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

interface BuiltRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** Pure request builder (unit-tested without any network). */
export function buildRequest(config: LlmConfig, messages: ChatMessage[]): BuiltRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  if (config.wire === "ollama") {
    return {
      url: joinUrl(config.baseUrl, "api/chat"),
      headers,
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        think: false,
        format: "json",
        options: {
          temperature: config.temperature,
          num_predict: config.maxTokens,
        },
      }),
    };
  }

  return {
    url: joinUrl(config.baseUrl, "chat/completions"),
    headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      response_format: { type: "json_object" },
    }),
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** True when the body carries a non-empty assistant message. */
export function extractChatText(wire: LlmWire, body: unknown): string {
  return parseChatResponse(wire, body).text;
}

/** Pull assistant text + token usage out of either wire's response body. */
export function parseChatResponse(
  wire: LlmWire,
  body: unknown,
): { text: string; inputTokens: number; outputTokens: number } {
  const root = asRecord(body);
  if (!root) throw new LlmError("parse", "response body is not an object");

  if (wire === "ollama") {
    const msg = asRecord(root.message) ?? {};
    // Empty `content` with a populated `thinking` still gives us a shot.
    const text = asString(msg.content) || asString(msg.thinking) || "";
    return {
      text,
      inputTokens: asNumber(root.prompt_eval_count) ?? 0,
      outputTokens: asNumber(root.eval_count) ?? 0,
    };
  }

  const choices = Array.isArray(root.choices) ? root.choices : [];
  const first = asRecord(choices[0]) ?? {};
  const msg = asRecord(first.message) ?? {};
  const text = asString(msg.content) || asString(msg.reasoning) || "";
  const usage = asRecord(root.usage);
  return {
    text,
    inputTokens: asNumber(usage?.prompt_tokens) ?? 0,
    outputTokens: asNumber(usage?.completion_tokens) ?? 0,
  };
}

// Guards `fetch` availability so importing this module never throws in a
// non-browser/older runtime (the advisor is simply disabled there).
let warnedNoFetch = false;
const defaultHttp: HttpPost = async (url, init) => {
  if (typeof fetch !== "function") {
    if (!warnedNoFetch) {
      warnedNoFetch = true;
      console.warn("[llm] global fetch unavailable; Track B disabled");
    }
    throw new LlmError("network", "fetch is not available");
  }
  const res = await fetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
    signal: init.signal,
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
};

export interface PostOptions {
  http?: HttpPost;
  /** Retries on network/timeout only — never on an HTTP status or parse error. */
  retries?: number;
}

/** One chat completion, JSON-mode, with timeout + (network-only) retry. */
export async function postChatJSON(
  config: LlmConfig,
  messages: ChatMessage[],
  opts: PostOptions = {},
): Promise<LlmResponse> {
  const http = opts.http ?? defaultHttp;
  const retries = Math.max(0, opts.retries ?? 1);
  const { url, headers, body } = buildRequest(config, messages);

  let lastError: LlmError | undefined;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const { status, body: responseBody } = await http(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      if (status < 200 || status >= 300) {
        throw new LlmError("http", `HTTP ${status}`);
      }
      const parsed = parseChatResponse(config.wire, responseBody);
      return {
        text: parsed.text,
        usage: { inputTokens: parsed.inputTokens, outputTokens: parsed.outputTokens },
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      const e =
        err instanceof LlmError
          ? err
          : new LlmError(
              controller.signal.aborted ? "timeout" : "network",
              (err as Error)?.message ?? String(err),
            );
      lastError = e;
      // Auth/HTTP/parse problems will not fix themselves on retry.
      if (e.kind === "http" || e.kind === "parse") break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new LlmError("network", "unknown failure");
}
