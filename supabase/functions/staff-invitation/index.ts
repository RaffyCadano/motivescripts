import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersForRequest } from "../_shared/cors.ts";

const INVITE_TTL_DAYS = 7;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEMPLATE_KEYS = new Set(["admin", "staff", "project_manager", "sales", "accounting"]);
const PERMISSION_PATTERN = /^[a-z]+\.[a-z]+$/;

type Action = "send" | "resend" | "revoke";
type ServiceClient = SupabaseClient;

type RequestBody = {
  action?: string;
  email?: string;
  fullName?: string;
  jobTitle?: string;
  templateKey?: string;
  permissionCodes?: string[];
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
  inviteeName: string;
  roleLabel: string;
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
              <h1 style="margin:16px 0 0;font-size:24px;line-height:1.3;">You're invited to join the MotiveScripts team.</h1>
              <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#44505f;">${greeting}</p>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#44505f;">
                MotiveScripts invited you to work as <strong>${escapeHtml(input.roleLabel)}</strong> on the agency workspace.
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
    console.error("staff-invitation missing supabase env");
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
  const { data: staffRow } = await admin
    .from("staff_profiles")
    .select("is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (staffRow && staffRow.is_active === false) {
    return fail("not_allowed", 403);
  }

  try {
    if (action === "revoke") {
      return await revokeInvitation(admin, body.invitationId, json);
    }
    return await sendOrResend(admin, {
      action,
      email: body.email,
      fullName: body.fullName,
      jobTitle: body.jobTitle,
      templateKey: body.templateKey,
      permissionCodes: body.permissionCodes,
      createdBy: user.id,
    }, json);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "server_error";
    if (
      message === "pending_exists" ||
      message === "invalid_email" ||
      message === "invalid_role" ||
      message === "already_staff" ||
      message === "is_client" ||
      message === "not_found" ||
      message === "not_pending" ||
      message === "email_failed" ||
      message === "missing_site_url" ||
      message === "required_name"
    ) {
      return fail(message);
    }
    console.error("staff-invitation failed", { action });
    return fail("server_error", 500);
  }
});

async function revokeInvitation(admin: ServiceClient, invitationId: string | undefined, json: JsonFn) {
  if (!invitationId) throw new Error("not_found");
  const { data, error } = await admin
    .from("staff_invitations")
    .select("id, status")
    .eq("id", invitationId)
    .maybeSingle();
  if (error || !data) throw new Error("not_found");
  if (data.status === "accepted") throw new Error("not_pending");
  if (data.status === "revoked") {
    return json({ ok: true, invitationId: data.id });
  }

  const { error: updateError } = await admin
    .from("staff_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .in("status", ["pending", "expired"]);
  if (updateError) throw new Error("server_error");

  return json({ ok: true, invitationId: data.id });
}

async function sendOrResend(
  admin: ServiceClient,
  input: {
    action: "send" | "resend";
    email?: string;
    fullName?: string;
    jobTitle?: string;
    templateKey?: string;
    permissionCodes?: string[];
    createdBy: string;
  },
  json: JsonFn,
) {
  const email = normalizeEmail(input.email ?? "");
  if (!EMAIL_PATTERN.test(email)) throw new Error("invalid_email");
  const fullName = (input.fullName ?? "").trim();
  if (!fullName) throw new Error("required_name");
  const jobTitle = (input.jobTitle ?? "").trim();
  const templateKey = (input.templateKey ?? "").trim();
  if (!TEMPLATE_KEYS.has(templateKey)) throw new Error("invalid_role");

  const { data: template } = await admin
    .from("staff_templates")
    .select("key, label")
    .eq("key", templateKey)
    .maybeSingle();
  if (!template) throw new Error("invalid_role");

  const permissionCodes = Array.isArray(input.permissionCodes)
    ? [...new Set(input.permissionCodes.map((code) => code.trim()).filter((code) => PERMISSION_PATTERN.test(code)))]
    : [];

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, role, client_id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (existingProfile?.role === "client" && existingProfile.client_id) {
    throw new Error("is_client");
  }

  if (existingProfile && (existingProfile.role === "admin" || existingProfile.role === "staff")) {
    const { data: existingStaff } = await admin
      .from("staff_profiles")
      .select("is_active")
      .eq("user_id", existingProfile.id)
      .maybeSingle();
    if (existingStaff?.is_active) throw new Error("already_staff");
  }

  const { data: pending } = await admin
    .from("staff_invitations")
    .select("id")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (pending && input.action === "send") {
    throw new Error("pending_exists");
  }

  if (pending) {
    await admin.from("staff_invitations").update({ status: "expired" }).eq("id", pending.id);
  }

  await ensureAuthUser(admin, email, fullName);

  const origin = siteUrl();
  if (!origin) throw new Error("missing_site_url");

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: created, error: insertError } = await admin
    .from("staff_invitations")
    .insert({
      email,
      invitee_name: fullName,
      job_title: jobTitle,
      template_key: templateKey,
      permission_codes: permissionCodes,
      token_hash: tokenHash,
      status: "pending",
      expires_at: expiresAt,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (insertError || !created) throw new Error("server_error");

  const inviteUrl = `${origin}/staff-invite/${token}`;
  const expiresLabel = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  try {
    await sendResendEmail({
      to: email,
      inviteeName: fullName,
      roleLabel: String(template.label),
      inviteUrl,
      expiresLabel,
    });
  } catch {
    await admin.from("staff_invitations").update({ status: "expired" }).eq("id", created.id);
    throw new Error("email_failed");
  }

  return json({ ok: true, invitationId: created.id, expiresAt });
}

async function ensureAuthUser(admin: ServiceClient, email: string, fullName: string) {
  const { error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (!error) return;
  const message = (error.message ?? "").toLowerCase();
  if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
    return;
  }
  console.error("staff-invitation createUser failed");
  throw new Error("server_error");
}

async function sendResendEmail(input: {
  to: string;
  inviteeName: string;
  roleLabel: string;
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
      subject: "You're invited to the MotiveScripts team",
      html: invitationEmailHtml({
        inviteeName: input.inviteeName,
        roleLabel: input.roleLabel,
        inviteUrl: input.inviteUrl,
        expiresLabel: input.expiresLabel,
        supportEmail,
      }),
    }),
  });
  if (!response.ok) {
    console.error("staff-invitation resend failed", { status: response.status });
    throw new Error("email_failed");
  }
}
