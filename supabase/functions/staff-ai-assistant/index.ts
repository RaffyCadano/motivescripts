import Anthropic from "npm:@anthropic-ai/sdk@0.127.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersForRequest } from "../_shared/cors.ts";
import { AI_LIMITS, cleanText, createRateLimiter, parseMessages, stripMarkdown, type ChatMessage } from "../_shared/aiChat.ts";
import { staffKnowledgeForRole } from "../_shared/staffAiKnowledge.ts";

// Staff AI assistant (pilot: developer, project_manager -- see isStaffAiPilotTemplate in
// src/data/staffAiContext.ts, which this must stay in sync with). Answers "what needs to be
// done" and "how do I do this job" for one logged-in staff member, inside their own workspace.
//
// Unlike motivescripts-ai (the public site bot), the caller must be an authenticated, active
// staff member: verify_jwt is off at the platform level (same as every other function here --
// see refund-stripe-payment for the same pattern), so auth is checked here instead, against the
// caller's own token. This function never touches the database beyond that one identity check --
// the browser sends its own already-RLS-scoped task/project summary as `contextSummary`, so there
// is no server-side query to get wrong and no cross-user data exposure surface: the model only ever
// sees what the caller could already see on their own dashboard.

const DEFAULT_MODEL = "claude-opus-5";
const MAX_OUTPUT_TOKENS = 500;
const MAX_CONTEXT_CHARS = 4_000;
const MAX_ROLE_CHARS = 40;

function supportsEffort(model: string): boolean {
  return /^claude-(opus|sonnet|fable|mythos)-/.test(model);
}

// Per-instance, best-effort limits -- same shape as motivescripts-ai's limiter, keyed by user id
// instead of IP so it actually tracks a person across requests.
const limiter = createRateLimiter({ windowMs: 5 * 60 * 1000, maxPerKey: 20, maxGlobal: 300 });

async function generate(
  role: string,
  contextSummary: string,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  const model = (Deno.env.get("ANTHROPIC_MODEL") ?? "").trim() || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey, timeout: AI_LIMITS.modelTimeoutMs, maxRetries: 1 });
  const knowledge = staffKnowledgeForRole(role);
  if (!knowledge) throw new Error("unknown_role");

  const response = await client.messages.create(
    {
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      // The knowledge half is identical for everyone in this role and cacheable; the status
      // snapshot is per-request and per-person, so it's kept out of the cached block.
      system: [
        { type: "text", text: knowledge, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Current status:\n${contextSummary}` },
      ],
      ...(supportsEffort(model) ? { output_config: { effort: "low" } } : {}),
      messages,
    },
    { signal },
  );

  if (response.stop_reason === "refusal") {
    return "I'm not able to help with that one -- try rephrasing, or ask about your tasks or how something in the app works.";
  }
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n");
  let reply = cleanText(stripMarkdown(text));
  if (reply.length > AI_LIMITS.maxReplyChars) reply = `${reply.slice(0, AI_LIMITS.maxReplyChars - 1).trimEnd()}…`;
  return reply || "I don't have a good answer for that one -- try asking about your tasks or how something in the app works.";
}

Deno.serve(async (req) => {
  const cors = corsHeadersForRequest(req);
  const respond = (body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ ok: false, error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  if (!supabaseUrl || !anonKey) {
    console.error("staff-ai-assistant missing supabase env");
    return respond({ ok: false, error: "server_error" }, 500);
  }
  if (!apiKey) return respond({ ok: false, error: "unavailable" }, 503);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return respond({ ok: false, error: "not_allowed" }, 401);

  // Active staff or admin only -- current_staff_context() is the same helper the app already
  // uses to read "who am I, in this workspace" (auth/AuthProvider's own profile load). It has no
  // role field, but is_active is only ever true for an admin or an active staff member (a client,
  // or a deactivated staff member, both come back false) -- that alone is the gate this needs.
  const { data: staffContext } = await userClient.rpc("current_staff_context");
  const context = Array.isArray(staffContext) ? staffContext[0] : staffContext;
  if (!context || context.is_active !== true) return respond({ ok: false, error: "not_allowed" }, 403);

  const { data: isAdminRaw } = await userClient.rpc("is_admin");
  const isAdmin = isAdminRaw === true;
  const templateKey = String(context.template_key ?? "");

  const limit = limiter.check(user.id);
  if ("retryAfterSeconds" in limit) {
    return respond({ ok: false, error: "rate_limited" }, 429, { "Retry-After": String(limit.retryAfterSeconds) });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return respond({ ok: false, error: "invalid_request" }, 400);
  }
  if (!payload || typeof payload !== "object") return respond({ ok: false, error: "invalid_request" }, 400);
  const body = payload as { role?: unknown; contextSummary?: unknown; messages?: unknown };

  // The role the assistant answers as comes from the caller's OWN staff profile, not whatever the
  // client claims -- admins may pilot either role's knowledge (there's no "admin" knowledge yet),
  // everyone else is pinned to their own template.
  const requestedRole = typeof body.role === "string" ? body.role.trim().slice(0, MAX_ROLE_CHARS) : "";
  const role = isAdmin ? requestedRole : templateKey;
  const knowledge = staffKnowledgeForRole(role);
  if (!knowledge) return respond({ ok: false, error: "invalid_request" }, 400);

  if (typeof body.contextSummary !== "string") return respond({ ok: false, error: "invalid_request" }, 400);
  const contextSummary = cleanText(body.contextSummary).slice(0, MAX_CONTEXT_CHARS);

  const parsed = parseMessages(body.messages);
  if ("error" in parsed) return respond({ ok: false, error: parsed.error }, parsed.error === "too_long" ? 413 : 400);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_LIMITS.modelTimeoutMs);
  try {
    const reply = await generate(role, contextSummary, parsed.messages, controller.signal);
    return respond({ ok: true, reply });
  } catch (error) {
    console.error("staff-ai-assistant generation failed", {
      name: error instanceof Error ? error.name : "unknown",
      status: (error as { status?: number } | null)?.status ?? null,
    });
    return respond({ ok: false, error: "unavailable" }, 503);
  } finally {
    clearTimeout(timer);
  }
});
