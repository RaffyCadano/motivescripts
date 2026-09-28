import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { StaffAiPilotTemplate } from "@/data/staffAiContext";

/** Keep in step with AI_LIMITS in supabase/functions/_shared/aiChat.ts (the server enforces the real limits). */
export const STAFF_AI_MAX_MESSAGE_CHARS = 800;
export const STAFF_AI_MAX_HISTORY = 10;
const REQUEST_TIMEOUT_MS = 35_000;

export type StaffAiChatMessage = { role: "user" | "assistant"; content: string };

export type AskStaffAiFailure = "rate_limited" | "too_long" | "not_allowed" | "unavailable";

export type AskStaffAiResult = { ok: true; reply: string } | { ok: false; reason: AskStaffAiFailure };

type FunctionErrorLike = { context?: { status?: number; json?: () => Promise<unknown> } } | null;

async function failureFromError(error: FunctionErrorLike): Promise<AskStaffAiFailure> {
  try {
    const body = (await error?.context?.json?.()) as { error?: string } | undefined;
    if (body?.error === "rate_limited") return "rate_limited";
    if (body?.error === "too_long") return "too_long";
    if (body?.error === "not_allowed") return "not_allowed";
  } catch {
    // Non-JSON error body: treat as a generic outage.
  }
  if (error?.context?.status === 401 || error?.context?.status === 403) return "not_allowed";
  return "unavailable";
}

/**
 * Sends this staff member's own question, plus a plain-text summary of their own current tasks
 * (already scoped to what they can see, built client-side by staffAiContext.ts), to the staff AI
 * assistant Edge Function. The provider key lives only in that function.
 */
export async function askStaffAi(
  role: StaffAiPilotTemplate,
  contextSummary: string,
  messages: StaffAiChatMessage[],
): Promise<AskStaffAiResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "unavailable" };
  const client = getSupabase();
  if (!client) return { ok: false, reason: "unavailable" };

  try {
    const { data, error } = await client.functions.invoke("staff-ai-assistant", {
      body: { role, contextSummary, messages: messages.slice(-STAFF_AI_MAX_HISTORY) },
      timeout: REQUEST_TIMEOUT_MS,
    });
    if (error) return { ok: false, reason: await failureFromError(error as FunctionErrorLike) };

    const payload = data as { ok?: boolean; reply?: unknown } | null;
    if (payload?.ok === true && typeof payload.reply === "string" && payload.reply.trim()) {
      return { ok: true, reply: payload.reply };
    }
    return { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
