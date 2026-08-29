import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersForRequest } from "../_shared/cors.ts";

const INVITE_TTL_DAYS = 7;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Action = "send" | "resend" | "revoke";
type ServiceClient = SupabaseClient;

type RequestBody = {
  action?: string;
  clientId?: string;
  email?: string;
  fullName?: string;
  invitationId?: string;
};

type JsonFn = (body: Record<string, unknown>, status?: number) => Response;

function jsonWith(req: Request): JsonFn {
  const cors = corsHeadersForRequest(req);
  return (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
}

function failWith(json: JsonFn) {
  return (error: string, status = 200) => json({ ok: false, error }, status);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function siteUrl(): string {
  return (Deno.env.get("PUBLIC_SITE_URL") ?? Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
}

function resendFrom(): string {
  return Deno.env.get("RESEND_FROM") ?? "MotiveScripts <no-reply@motivescripts.com>";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function invitationEmailHtml(input: {
  companyName: string;
  inviteeName: string;
  inviteUrl: string;
  expiresLabel: string;
  supportEmail: string;
}): string {
  const greeting = input.inviteeName ? `Hi ${escapeHtml(input.inviteeName)},` : "Hello,";
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f8ff;font-family:Arial,sans-serif;color:#07111f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8ff;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5eaf0;border-radius:16px;padding:32px;">
          <tr>
            <td>
              <p style="margin:0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#667085;font-weight:700;">MotiveScripts</p>
              <h1 style="margin:16px 0 0;font-size:24px;line-height:1.3;">You're invited to your MotiveScripts client portal.</h1>
              <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#44505f;">${greeting}</p>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#44505f;">
                You've been invited to access the client portal for <strong>${escapeHtml(input.companyName)}</strong>.
                Use this link to continue. You'll sign in with a magic link sent to the invited email address.
              </p>
              <p style="margin:24px 0;">
                <a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;background:#001030;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:10px;">
                  Open invitation
                </a>
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#667085;">This invitation expires ${escapeHtml(input.expiresLabel)}.</p>
              <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#667085;">
                If you weren't expecting this, you can ignore the email. Questions:
                <a href="mailto:${escapeHtml(input.supportEmail)}" style="color:#0050f0;">${escapeHtml(input.supportEmail)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  const json = jsonWith(req);
  const fail = failWith(json);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersForRequest(req) });
  }
  if (req.method !== "POST") {
    return fail("invalid_action", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("client-invitation missing supabase env");
    return fail("server_error", 500);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return fail("invalid_action");
  }

  const action = body.action as Action | undefined;
  if (action !== "send" && action !== "resend" && action !== "revoke") {
    return fail("invalid_action");
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return fail("not_allowed", 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, client_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile || profile.role !== "admin") {
    return fail("not_allowed", 403);
  }

  try {
    if (action === "revoke") {
      return await revokeInvitation(admin, body.invitationId, json);
    }
    return await sendOrResend(admin, {
      action,
      clientId: body.clientId,
      email: body.email,
      fullName: body.fullName,
      createdBy: user.id,
    }, json);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "server_error";
    if (
      message === "pending_exists" ||
      message === "invalid_email" ||
      message === "client_not_found" ||
      message === "already_linked" ||
      message === "is_admin" ||
      message === "not_found" ||
      message === "not_pending" ||
      message === "email_failed" ||
      message === "missing_site_url"
    ) {
      return fail(message);
    }
    console.error("client-invitation failed", { action });
    return fail("server_error", 500);
  }
});

async function revokeInvitation(admin: ServiceClient, invitationId: string | undefined, json: JsonFn) {
  if (!invitationId) throw new Error("not_found");
  const { data, error } = await admin
    .from("client_invitations")
    .select("id, client_id, status")
    .eq("id", invitationId)
    .maybeSingle();
  if (error || !data) throw new Error("not_found");
  if (data.status === "accepted") throw new Error("not_pending");
  if (data.status === "revoked") {
    return json({ ok: true, invitationId: data.id });
  }

  const { error: updateError } = await admin
    .from("client_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .in("status", ["pending", "expired"]);
  if (updateError) throw new Error("server_error");

  await admin.rpc("append_client_staff_activity", {
    p_client_id: data.client_id,
    p_description: "Client portal invitation revoked",
  });
  return json({ ok: true, invitationId: data.id });
}

async function sendOrResend(
  admin: ServiceClient,
  input: {
    action: "send" | "resend";
    clientId?: string;
    email?: string;
    fullName?: string;
    createdBy: string;
  },
  json: JsonFn,
) {
  if (!input.clientId) throw new Error("client_not_found");
  const email = normalizeEmail(input.email ?? "");
  if (!EMAIL_PATTERN.test(email)) throw new Error("invalid_email");
  const fullName = (input.fullName ?? "").trim();

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("id, business_name")
    .eq("id", input.clientId)
    .maybeSingle();
  if (clientError || !client) throw new Error("client_not_found");

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, role, client_id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (existingProfile?.role === "admin" || existingProfile?.role === "staff") throw new Error("is_admin");
  if (existingProfile?.client_id && existingProfile.client_id !== input.clientId) {
    throw new Error("already_linked");
  }

  const { data: pending } = await admin
    .from("client_invitations")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (pending && input.action === "send") {
    throw new Error("pending_exists");
  }

  if (pending) {
    await admin.from("client_invitations").update({ status: "expired" }).eq("id", pending.id);
  }

  await ensureAuthUser(admin, email, fullName);

  const origin = siteUrl();
  if (!origin) throw new Error("missing_site_url");

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: created, error: insertError } = await admin
    .from("client_invitations")
    .insert({
      client_id: input.clientId,
      email,
      invitee_name: fullName,
      token_hash: tokenHash,
      status: "pending",
      expires_at: expiresAt,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (insertError || !created) throw new Error("server_error");

  const inviteUrl = `${origin}/invite/${token}`;
  const expiresLabel = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  try {
    await sendResendEmail({
      to: email,
      companyName: client.business_name,
      inviteeName: fullName,
      inviteUrl,
      expiresLabel,
    });
  } catch {
    await admin.from("client_invitations").update({ status: "expired" }).eq("id", created.id);
    throw new Error("email_failed");
  }

  const description =
    input.action === "resend"
      ? `Client portal invitation resent to ${email}`
      : `Client portal invitation sent to ${email}`;
  await admin.rpc("append_client_staff_activity", {
    p_client_id: input.clientId,
    p_description: description,
  });

  return json({ ok: true, invitationId: created.id, expiresAt });
}

async function ensureAuthUser(admin: ServiceClient, email: string, fullName: string) {
  const { error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });
  if (!error) return;
  const message = (error.message ?? "").toLowerCase();
  if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
    return;
  }
  console.error("client-invitation createUser failed");
  throw new Error("server_error");
}

async function sendResendEmail(input: {
  to: string;
  companyName: string;
  inviteeName: string;
  inviteUrl: string;
  expiresLabel: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!apiKey) throw new Error("email_failed");
  const supportEmail = Deno.env.get("SUPPORT_EMAIL") ?? "support@motivescripts.com";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom(),
      to: [input.to],
      subject: "You're invited to your MotiveScripts client portal",
      html: invitationEmailHtml({
        companyName: input.companyName,
        inviteeName: input.inviteeName,
        inviteUrl: input.inviteUrl,
        expiresLabel: input.expiresLabel,
        supportEmail,
      }),
    }),
  });
  if (!response.ok) {
    console.error("client-invitation resend failed", { status: response.status });
    throw new Error("email_failed");
  }
}
