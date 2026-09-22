import Anthropic from "npm:@anthropic-ai/sdk@0.127.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersForRequest } from "../_shared/cors.ts";

// AI intake for client messaging: when a client starts (or continues) an AI-active conversation,
// this generates the assistant's next reply and, once it has enough context (or hits its turn
// cap, or the model call fails), hands the thread to a human via conversations_ai_handoff. Called
// only from messages_notify_recipients (dispatch_ai_conversation_reply), never by the browser --
// same service-role-only pattern as check-website-health's sweep mode / document-email's cron and
// webhook kinds. See 20261019000000_ai_conversation_intake.sql for the schema and dispatch side.
//
// The client is never left waiting on a broken model call: any error here still posts a short
// fallback reply and forces an immediate handoff, so a real person always follows up.

const DEFAULT_MODEL = "claude-opus-5";
const MAX_OUTPUT_TOKENS = 500;
/** Matches the backstop in dispatch_ai_conversation_reply -- keep the two in sync. */
const MAX_AI_TURNS = 4;
/** Bounds how much history is sent to the model; an intake thread capped at MAX_AI_TURNS AI
 * replies plus client turns in between never gets close to this. */
const MAX_MESSAGES_LOADED = 40;
const MODEL_TIMEOUT_MS = 20_000;
const HANDOFF_TOOL_NAME = "hand_off_to_team";
const FALLBACK_TEXT = "Thanks for the details -- I'll get a teammate to help with this.";
const ERROR_TEXT = "Sorry, I'm having trouble right now. I've let the team know so someone can follow up with you directly.";

function supportsEffort(model: string): boolean {
  return /^claude-(opus|sonnet|fable|mythos)-/.test(model);
}

type MessageRow = {
  id: string;
  sender_role: "admin" | "client" | "ai";
  body: string;
};

type RequestBody = { conversationId?: string; messageId?: string };

function buildSystemPrompt(input: { businessName: string; projectName: string | null; isFinalTurn: boolean }): string {
  const lines = [
    "You are the MotiveScripts Assistant, a brief intake step in a client's message thread with a web agency (MotiveScripts) -- not the final responder.",
    `You're talking with ${input.businessName || "a client"}${input.projectName ? ` about their project "${input.projectName}"` : ""}.`,
    "Your only job: understand what they need well enough for a human teammate to pick it up, by asking short, focused clarifying questions (what they need, roughly how urgent it is, which page or feature if relevant).",
    "Do not answer support questions yourself, quote prices, promise timelines, or make commitments -- you are gathering context, not resolving it.",
    "Keep replies short (2-4 sentences), warm, plain text, no markdown formatting.",
    `Call the ${HANDOFF_TOOL_NAME} tool as soon as you understand what they need -- don't drag out the questions once you have a clear picture. Always call it immediately if the client asks for a person, seems frustrated, or the request is clearly urgent (e.g. the site is down).`,
  ];
  if (input.isFinalTurn) {
    lines.push(
      "This must be your last message before a teammate takes over: thank them, briefly say a teammate will follow up, and do not ask another question. Still call the tool with your best summary so far.",
    );
  }
  return lines.join(" ");
}

const handoffTool: Anthropic.Tool = {
  name: HANDOFF_TOOL_NAME,
  description:
    "Call this once you understand what the client needs well enough for a human teammate to take over, or immediately if they ask for a person.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "One or two sentences summarizing what the client needs, for the teammate about to join.",
      },
    },
    required: ["summary"],
  },
};

async function generateReply(
  apiKey: string,
  messages: Anthropic.MessageParam[],
  system: string,
): Promise<{ text: string; summary: string | null; toolCalled: boolean }> {
  const model = (Deno.env.get("ANTHROPIC_MODEL") ?? "").trim() || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey, timeout: MODEL_TIMEOUT_MS, maxRetries: 1 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const response = await client.messages.create(
      {
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        tools: [handoffTool],
        ...(supportsEffort(model) ? { output_config: { effort: "low" } } : {}),
        messages,
      },
      { signal: controller.signal },
    );

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === HANDOFF_TOOL_NAME,
    );
    const summary =
      toolUse && toolUse.input && typeof (toolUse.input as { summary?: unknown }).summary === "string"
        ? ((toolUse.input as { summary: string }).summary || "").trim().slice(0, 300)
        : null;

    return { text: text || FALLBACK_TEXT, summary: summary || null, toolCalled: Boolean(toolUse) };
  } finally {
    clearTimeout(timer);
  }
}

async function postAiMessage(admin: SupabaseClient, conversationId: string, body: string): Promise<void> {
  const { error } = await admin
    .from("messages")
    .insert({ conversation_id: conversationId, sender_role: "ai", sender_label: "MotiveScripts Assistant", body });
  if (error) throw new Error(`insert ai message failed: ${error.message}`);
}

Deno.serve(async (req) => {
  const cors = corsHeadersForRequest(req);
  const json = (body: Record<string, unknown>, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "invalid_action" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    console.error("ai-conversation-reply: missing supabase env");
    return json({ ok: false, error: "server_error" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  // Same exact-string-equality service-role check used by check-website-health / document-email --
  // this endpoint is never called by a browser, only by dispatch_ai_conversation_reply via pg_net.
  if (!token || token !== serviceKey) {
    return json({ ok: false, error: "not_allowed" }, 403);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ ok: false, error: "invalid_action" }, 400);
  }
  const conversationId = (body.conversationId ?? "").trim();
  const messageId = (body.messageId ?? "").trim();
  if (!conversationId || !messageId) return json({ ok: false, error: "invalid_action" }, 400);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: conv, error: convError } = await admin
    .from("conversations")
    .select("id, client_id, project_id, ai_status")
    .eq("id", conversationId)
    .maybeSingle();
  if (convError) {
    console.error("ai-conversation-reply: conversation lookup failed", convError.message);
    return json({ ok: false, error: "server_error" }, 500);
  }
  // Already handed off or disabled by the time this ran (e.g. a concurrent dispatch, or staff
  // replied in between) -- nothing to do, and posting another AI reply now would be stale.
  if (!conv || conv.ai_status !== "active") {
    return json({ ok: true, skipped: true });
  }

  const [{ data: client }, { data: project }, { data: history, error: historyError }] = await Promise.all([
    admin.from("clients").select("business_name").eq("id", conv.client_id).maybeSingle(),
    conv.project_id
      ? admin.from("projects").select("name").eq("id", conv.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("messages")
      .select("id, sender_role, body")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(MAX_MESSAGES_LOADED),
  ]);
  if (historyError || !history || history.length === 0) {
    console.error("ai-conversation-reply: history lookup failed", historyError?.message);
    return json({ ok: false, error: "server_error" }, 500);
  }

  const priorAiTurns = (history as MessageRow[]).filter((row) => row.sender_role === "ai").length;
  const isFinalTurn = priorAiTurns + 1 >= MAX_AI_TURNS;

  const anthropicMessages: Anthropic.MessageParam[] = (history as MessageRow[]).map((row) => ({
    role: row.sender_role === "client" ? "user" : "assistant",
    content: row.body,
  }));

  const systemPrompt = buildSystemPrompt({
    businessName: client?.business_name ?? "",
    projectName: (project as { name?: string } | null)?.name ?? null,
    isFinalTurn,
  });

  if (!anthropicKey) {
    console.error("ai-conversation-reply: ANTHROPIC_API_KEY not configured");
    await postAiMessage(admin, conversationId, ERROR_TEXT).catch((err) => console.error(err));
    await admin.rpc("conversations_ai_handoff", { p_conversation_id: conversationId, p_message_id: messageId, p_summary: null });
    return json({ ok: true, handedOff: true, reason: "not_configured" });
  }

  try {
    const result = await generateReply(anthropicKey, anthropicMessages, systemPrompt);
    await postAiMessage(admin, conversationId, result.text);

    const handoff = result.toolCalled || isFinalTurn;
    if (handoff) {
      const { error: handoffError } = await admin.rpc("conversations_ai_handoff", {
        p_conversation_id: conversationId,
        p_message_id: messageId,
        p_summary: result.summary,
      });
      if (handoffError) console.error("ai-conversation-reply: handoff RPC failed", handoffError.message);
    }
    return json({ ok: true, handedOff: handoff });
  } catch (error) {
    console.error("ai-conversation-reply: generation failed", {
      name: error instanceof Error ? error.name : "unknown",
      status: (error as { status?: number } | null)?.status ?? null,
    });
    // Never leave the client waiting on a broken model call -- post a short fallback and hand off
    // immediately so a real person follows up.
    await postAiMessage(admin, conversationId, ERROR_TEXT).catch((err) => console.error(err));
    await admin.rpc("conversations_ai_handoff", { p_conversation_id: conversationId, p_message_id: messageId, p_summary: null });
    return json({ ok: true, handedOff: true, reason: "error" });
  }
});
