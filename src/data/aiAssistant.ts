import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/** Keep in step with AI_LIMITS in supabase/functions/_shared/aiChat.ts (the server enforces the real limits). */
export const AI_MAX_MESSAGE_CHARS = 800;
export const AI_MAX_HISTORY = 10;
const REQUEST_TIMEOUT_MS = 35_000;

export type AiChatMessage = { role: "user" | "assistant"; content: string };

export type AskAiFailure = "rate_limited" | "too_long" | "unavailable";

export type AskAiResult =
  | { ok: true; reply: string; cta: "start_project" | null }
  | { ok: false; reason: AskAiFailure };

type FunctionErrorLike = { context?: { json?: () => Promise<unknown> } } | null;

async function failureFromError(error: FunctionErrorLike): Promise<AskAiFailure> {
  try {
    const body = (await error?.context?.json?.()) as { error?: string } | undefined;
    if (body?.error === "rate_limited") return "rate_limited";
    if (body?.error === "too_long") return "too_long";
  } catch {
    // Non-JSON error body: treat as a generic outage.
  }
  return "unavailable";
}

/**
 * Sends the visitor's recent conversation to the MotiveScripts AI Edge Function. The AI provider key
 * lives only in that function; the browser never sees it and never talks to the provider directly.
 */
export async function askMotiveScriptsAi(messages: AiChatMessage[]): Promise<AskAiResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "unavailable" };
  const client = getSupabase();
  if (!client) return { ok: false, reason: "unavailable" };

  try {
    const { data, error } = await client.functions.invoke("motivescripts-ai", {
      body: { messages: messages.slice(-AI_MAX_HISTORY) },
      timeout: REQUEST_TIMEOUT_MS,
    });
    if (error) return { ok: false, reason: await failureFromError(error as FunctionErrorLike) };

    const payload = data as { ok?: boolean; reply?: unknown; cta?: unknown } | null;
    if (payload?.ok === true && typeof payload.reply === "string" && payload.reply.trim()) {
      return { ok: true, reply: payload.reply, cta: payload.cta === "start_project" ? "start_project" : null };
    }
    return { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
