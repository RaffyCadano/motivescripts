/**
 * Request handling for the public MotiveScripts AI endpoint, kept free of Deno APIs and of the AI
 * SDK so it can be unit-tested in plain Node. `index.ts` wires it to Deno.serve and the model.
 *
 * This endpoint is PUBLIC (verify_jwt = false, like public-lead), so everything here treats the
 * request as hostile: size caps, strict validation, rate limiting, a hard timeout, no tools, no
 * database access, and plain-text-only output.
 */
import { START_PROJECT_TOKEN } from "./aiKnowledge.ts";

export const AI_LIMITS = {
  /** Raw request body cap. */
  maxBodyBytes: 16_000,
  /** Reject a request that sends more history than this at all. */
  maxMessagesReceived: 30,
  /** Most recent messages actually sent to the model: keeps cost and context bounded. */
  maxMessagesKept: 10,
  maxMessageChars: 800,
  maxTotalChars: 6_000,
  maxReplyChars: 2_000,
  modelTimeoutMs: 25_000,
} as const;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatErrorCode =
  | "invalid_request"
  | "too_long"
  | "rate_limited"
  | "unavailable"
  | "method_not_allowed";

export type GenerateResult = { text: string; refused?: boolean };

export type ChatCta = "start_project" | null;

// deno-lint-ignore no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Trims, normalizes newlines, and strips control characters (keeps \n). */
export function cleanText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(CONTROL_CHARS, "").trim();
}

export type ParseResult = { ok: true; messages: ChatMessage[] } | { ok: false; error: "invalid_request" | "too_long" };

/**
 * Validates the client-supplied conversation. Returns at most the last `maxMessagesKept`
 * messages, starting with a user turn and ending with a user turn.
 */
export function parseMessages(input: unknown): ParseResult {
  if (!Array.isArray(input) || input.length === 0 || input.length > AI_LIMITS.maxMessagesReceived) {
    return { ok: false, error: "invalid_request" };
  }

  const cleaned: ChatMessage[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return { ok: false, error: "invalid_request" };
    const { role, content } = item as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return { ok: false, error: "invalid_request" };
    }
    const text = cleanText(content);
    if (!text) return { ok: false, error: "invalid_request" };
    if (text.length > AI_LIMITS.maxMessageChars) return { ok: false, error: "too_long" };
    cleaned.push({ role, content: text });
  }

  let kept = cleaned.slice(-AI_LIMITS.maxMessagesKept);
  while (kept.length > 0 && kept[0].role !== "user") kept = kept.slice(1);
  if (kept.length === 0 || kept[kept.length - 1].role !== "user") {
    return { ok: false, error: "invalid_request" };
  }

  const total = kept.reduce((sum, message) => sum + message.content.length, 0);
  if (total > AI_LIMITS.maxTotalChars) return { ok: false, error: "too_long" };

  return { ok: true, messages: kept };
}

export type RateLimiter = {
  check: (key: string) => { ok: true } | { ok: false; retryAfterSeconds: number };
};

/**
 * In-memory sliding-window limiter: `maxPerKey` requests per `windowMs` per visitor, plus a
 * `maxGlobal` cap across all visitors. Best effort only: Edge Function instances are ephemeral and
 * not shared, so this slows abuse and caps runaway cost per instance but is not a hard guarantee.
 * Set a spend limit at the AI provider as the real backstop (see docs/motivescripts-ai.md).
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxPerKey: number;
  maxGlobal: number;
  now?: () => number;
}): RateLimiter {
  const now = options.now ?? (() => Date.now());
  const perKey = new Map<string, number[]>();
  let global: number[] = [];
  const MAX_KEYS = 5_000;

  return {
    check(key) {
      const t = now();
      const cutoff = t - options.windowMs;

      global = global.filter((stamp) => stamp > cutoff);
      if (global.length >= options.maxGlobal) {
        const oldest = global[0] ?? t;
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + options.windowMs - t) / 1000)) };
      }

      const hits = (perKey.get(key) ?? []).filter((stamp) => stamp > cutoff);
      if (hits.length >= options.maxPerKey) {
        perKey.set(key, hits);
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((hits[0] + options.windowMs - t) / 1000)) };
      }

      hits.push(t);
      perKey.set(key, hits);
      global.push(t);

      if (perKey.size > MAX_KEYS) {
        for (const [k, stamps] of perKey) {
          if (!stamps.some((stamp) => stamp > cutoff)) perKey.delete(k);
        }
        if (perKey.size > MAX_KEYS) perKey.clear();
      }
      return { ok: true };
    },
  };
}

/** Best-effort visitor key. The platform sets these headers; a missing one falls back to a shared bucket. */
export function clientKey(req: Request): string {
  const direct = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip");
  if (direct) return direct.trim().slice(0, 64);
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 64) || "unknown";
  return "unknown";
}

/** Reads the request body but refuses to buffer more than `maxBytes`. Returns null if over the cap. */
async function readBodyLimited(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return "";

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * The chat shows plain text, so drop markdown emphasis the model sometimes adds anyway
 * (**bold**, __bold__, `code`, leading # headings). List dashes are left alone.
 */
export function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*([^*\n]+?)\*\*/g, "$1")
    .replace(/__([^_\n]+?)__/g, "$1")
    .replace(/`([^`\n]+?)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "");
}

const FALLBACK_REPLY =
  "I'm not able to help with that one. You can ask me about MotiveScripts' services, pricing, or process, or describe your project through Start a Project.";

/**
 * Turns raw model text into what the browser receives: control characters removed, length capped,
 * and the start-project token (the only model-controlled signal) converted into a structured flag.
 */
export function shapeReply(raw: string): { reply: string; cta: ChatCta } {
  const withoutToken = raw.split(START_PROJECT_TOKEN).join("");
  const cta: ChatCta = raw.includes(START_PROJECT_TOKEN) ? "start_project" : null;
  let reply = cleanText(stripMarkdown(withoutToken));
  if (reply.length > AI_LIMITS.maxReplyChars) reply = `${reply.slice(0, AI_LIMITS.maxReplyChars - 1).trimEnd()}…`;
  return { reply: reply || FALLBACK_REPLY, cta };
}

export type ChatDeps = {
  generate: (messages: ChatMessage[], signal: AbortSignal) => Promise<GenerateResult>;
  limiter: RateLimiter;
  cors: Record<string, string>;
  /** False when the provider secret is not set; the endpoint then answers "unavailable". */
  configured: boolean;
  log: (message: string, meta?: Record<string, unknown>) => void;
};

export async function handleChatRequest(req: Request, deps: ChatDeps): Promise<Response> {
  const respond = (body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...deps.cors, "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
    });
  const fail = (error: ChatErrorCode, status: number, extra: Record<string, string> = {}) =>
    respond({ ok: false, error }, status, extra);

  if (req.method === "OPTIONS") return new Response("ok", { headers: deps.cors });
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const limit = deps.limiter.check(clientKey(req));
  if ("retryAfterSeconds" in limit) {
    return fail("rate_limited", 429, { "Retry-After": String(limit.retryAfterSeconds) });
  }

  const rawBody = await readBodyLimited(req, AI_LIMITS.maxBodyBytes);
  if (rawBody === null) return fail("too_long", 413);

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return fail("invalid_request", 400);
  }
  const messagesInput = payload && typeof payload === "object" ? (payload as { messages?: unknown }).messages : null;
  const parsed = parseMessages(messagesInput);
  if ("error" in parsed) return fail(parsed.error, parsed.error === "too_long" ? 413 : 400);

  if (!deps.configured) {
    deps.log("motivescripts-ai: provider key not configured");
    return fail("unavailable", 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_LIMITS.modelTimeoutMs);
  try {
    const result = await deps.generate(parsed.messages, controller.signal);
    if (result.refused) return respond({ ok: true, reply: FALLBACK_REPLY, cta: null });
    const shaped = shapeReply(result.text);
    return respond({ ok: true, reply: shaped.reply, cta: shaped.cta });
  } catch (error) {
    // Never echo provider error text to the visitor; it can contain request details.
    deps.log("motivescripts-ai: generation failed", {
      name: error instanceof Error ? error.name : "unknown",
      status: (error as { status?: number } | null)?.status ?? null,
    });
    return fail("unavailable", 503);
  } finally {
    clearTimeout(timer);
  }
}
