import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersForRequest } from "../_shared/cors.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const INDUSTRIES = [
  "Home services",
  "Contractor",
  "Landscaping",
  "Tree service",
  "Cleaning",
  "Restaurant",
  "Salon / barber",
  "Auto",
  "Professional services",
  "Other",
] as const;

type ServiceClient = SupabaseClient;

type RequestBody = {
  name?: string;
  business?: string;
  email?: string;
  phone?: string;
  industry?: string;
  goal?: string;
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

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isIndustry(value: string): value is (typeof INDUSTRIES)[number] {
  return (INDUSTRIES as readonly string[]).includes(value);
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

function siteUrl(): string {
  return (Deno.env.get("PUBLIC_SITE_URL") ?? Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
}

function leadEmailHtml(input: {
  name: string;
  business: string;
  email: string;
  phone: string;
  industry: string;
  request: string;
  details: string;
  adminUrl: string;
}): string {
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
              <h1 style="margin:16px 0 0;font-size:24px;line-height:1.3;">New project inquiry</h1>
              <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#44505f;">
                <strong>${escapeHtml(input.business)}</strong> submitted Start a Project.
              </p>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#44505f;">
                ${escapeHtml(input.name)} · ${escapeHtml(input.email)} · ${escapeHtml(input.phone)}
              </p>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#44505f;">
                Industry: ${escapeHtml(input.industry)}<br />
                Request: ${escapeHtml(input.request)}
              </p>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#44505f;white-space:pre-wrap;">${escapeHtml(input.details)}</p>
              <p style="margin:24px 0 0;">
                <a href="${escapeHtml(input.adminUrl)}" style="display:inline-block;background:#001030;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:10px;">
                  Open leads
                </a>
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

async function notifyAgency(input: {
  name: string;
  business: string;
  email: string;
  phone: string;
  industry: string;
  request: string;
  details: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const to = (Deno.env.get("SUPPORT_EMAIL") ?? "contact-us@motivescripts.com").trim();
  if (!apiKey || !to) return;
  const origin = siteUrl();
  const adminUrl = origin ? `${origin}/admin/leads` : "";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom(),
        to: [to],
        subject: `New lead — ${input.business}`,
        html: leadEmailHtml({ ...input, adminUrl: adminUrl || "#" }),
      }),
    });
    if (!response.ok) {
      console.error("public-lead resend failed", { status: response.status });
    }
  } catch (error) {
    console.error("public-lead resend error", error);
  }
}

Deno.serve(async (req) => {
  const json = jsonWith(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersForRequest(req) });
  }
  if (req.method !== "POST") {
    return json({ ok: false }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    console.error("public-lead missing supabase env");
    return json({ ok: false }, 500);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ ok: false }, 400);
  }

  const name = clip(body.name, 120);
  const business = clip(body.business, 160);
  const email = normalizeEmail(clip(body.email, 254));
  const phone = clip(body.phone, 40) || "—";
  const industry = clip(body.industry, 40);
  const goal = clip(body.goal, 4000);
  const request = goal.slice(0, 80) || "New Website";

  if (!name || !business || !EMAIL_PATTERN.test(email) || !isIndustry(industry) || !goal) {
    return json({ ok: false }, 400);
  }

  const admin: ServiceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count, error: countError } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", since);
  if (countError) {
    console.error("public-lead rate lookup failed");
    return json({ ok: false }, 500);
  }
  if ((count ?? 0) > 0) {
    return json({ ok: true });
  }

  const now = new Date().toISOString();
  const { error: insertError } = await admin.from("leads").insert({
    name,
    business_name: business,
    email,
    phone,
    industry,
    request,
    project_details: goal,
    status: "New",
    source: "Start a Project",
    notes: [],
    activity: [
      {
        id: `act-${crypto.randomUUID()}`,
        description: "Lead submitted project inquiry",
        createdAt: now,
      },
    ],
  });
  if (insertError) {
    console.error("public-lead insert failed");
    return json({ ok: false }, 500);
  }

  await notifyAgency({
    name,
    business,
    email,
    phone,
    industry,
    request,
    details: goal,
  });

  return json({ ok: true });
});
