import Anthropic from "npm:@anthropic-ai/sdk@0.127.0";
import { corsHeadersForRequest } from "../_shared/cors.ts";
import { AI_LIMITS, createRateLimiter, handleChatRequest, type ChatMessage, type GenerateResult } from "../_shared/aiChat.ts";
import { buildSystemPrompt } from "../_shared/aiKnowledge.ts";

// MotiveScripts AI: the public website assistant. The browser calls this function; the provider
// key (ANTHROPIC_API_KEY) exists only here as an Edge Function secret and is never sent to the
// client. The function has no database access, no tools, and no arbitrary network access: it
// sends the visitor's bounded conversation plus a fixed, curated knowledge prompt to Claude and
// returns plain text. See docs/motivescripts-ai.md.

const DEFAULT_MODEL = "claude-opus-5";
const MAX_OUTPUT_TOKENS = 600;

/** Effort is supported on the Opus / Sonnet / Fable families; Haiku rejects it. */
function supportsEffort(model: string): boolean {
  return /^claude-(opus|sonnet|fable|mythos)-/.test(model);
}

// Per-instance, best-effort limits (see createRateLimiter). ~12 questions per 5 minutes per
// visitor, and a global ceiling that bounds worst-case spend per instance.
const limiter = createRateLimiter({ windowMs: 5 * 60 * 1000, maxPerKey: 12, maxGlobal: 240 });

const systemPrompt = buildSystemPrompt();

async function generate(messages: ChatMessage[], signal: AbortSignal): Promise<GenerateResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  const model = (Deno.env.get("ANTHROPIC_MODEL") ?? "").trim() || DEFAULT_MODEL;
  // ANTHROPIC_BASE_URL is honored by the SDK for local testing against a stub; unset in production.
  const client = new Anthropic({ apiKey, timeout: AI_LIMITS.modelTimeoutMs, maxRetries: 1 });

  const response = await client.messages.create(
    {
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      // The knowledge prompt is identical on every request, so mark it cacheable.
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      ...(supportsEffort(model) ? { output_config: { effort: "low" } } : {}),
      messages,
    },
    { signal },
  );

  if (response.stop_reason === "refusal") return { text: "", refused: true };
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n");
  return { text };
}

Deno.serve((req) =>
  handleChatRequest(req, {
    generate,
    limiter,
    cors: corsHeadersForRequest(req),
    configured: Boolean(Deno.env.get("ANTHROPIC_API_KEY")),
    log: (message, meta) => console.error(message, meta ?? {}),
  }),
);
