import { createClient } from "npm:@supabase/supabase-js@2";
import { bytesToBase64, generateInvoicePdf, invoicePdfFilename } from "../_shared/invoicePdf.ts";
import { loadInvoicePdfModel } from "../_shared/loadInvoicePdf.ts";
import { generateProposalPdf, proposalPdfFilename } from "../_shared/proposalPdf.ts";
import { loadProposalPdfModel } from "../_shared/loadProposalPdf.ts";
import { generateContractPdf, contractPdfFilename } from "../_shared/contractPdf.ts";
import { loadContractPdfModel } from "../_shared/loadContractPdf.ts";
import { corsHeadersForRequest } from "../_shared/cors.ts";

type RequestBody = {
  kind?: string;
  id?: string;
  paymentId?: string;
};

function siteUrl(): string {
  return (Deno.env.get("PUBLIC_SITE_URL") ?? Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
}

function resendFrom(): string {
  return Deno.env.get("RESEND_FROM") ?? "MotiveScripts <motivescripts.team@gmail.com>";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatUsdFromCents(cents: number): string {
  const abs = cents < 0 ? -cents : cents;
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const formatted = `${dollars.toLocaleString("en-US")}.${String(remainder).padStart(2, "0")}`;
  return cents < 0 ? `-$${formatted}` : `$${formatted}`;
}

function brandedEmail(input: {
  heading: string;
  company: string;
  number: string;
  title: string;
  summary: string;
  expiresLabel: string;
  url: string;
  cta: string;
  supportEmail: string;
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
              <h1 style="margin:16px 0 0;font-size:24px;line-height:1.3;">${escapeHtml(input.heading)}</h1>
              <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#44505f;">
                Prepared for <strong>${escapeHtml(input.company)}</strong>
              </p>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#44505f;">
                ${escapeHtml(input.number)} — ${escapeHtml(input.title)}
              </p>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#44505f;">${escapeHtml(input.summary)}</p>
              <p style="margin:24px 0;">
                <a href="${escapeHtml(input.url)}" style="display:inline-block;background:#001030;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:10px;">
                  ${escapeHtml(input.cta)}
                </a>
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#667085;">${escapeHtml(input.expiresLabel)}</p>
              <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#667085;">
                Questions:
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
  const corsHeaders = corsHeadersForRequest(req);
  const json = (body: Record<string, unknown>, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  const fail = (error: string, status = 200): Response => json({ ok: false, error }, status);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("invalid_action", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("document-email missing supabase env");
    return fail("server_error", 500);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return fail("invalid_action");
  }
  if (
    (body.kind !== "proposal" &&
      body.kind !== "contract" &&
      body.kind !== "invoice" &&
      body.kind !== "payment") ||
    !body.id
  ) {
    return fail("invalid_action");
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const isServiceRole = token.length > 0 && token === serviceKey;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let userClient: ReturnType<typeof createClient> | null = null;

  if (body.kind === "payment") {
    if (!isServiceRole) return fail("not_allowed", 403);
  } else {
    userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return fail("not_allowed", 401);
  }

  async function assertManage(clientId: string, perm: string): Promise<Response | null> {
    if (!userClient) return fail("not_allowed", 403);
    const { data } = await userClient.rpc("staff_can_access_client", {
      p_client_id: clientId,
      p_perm: perm,
    });
    if (data === true) return null;
    return fail("not_allowed", 403);
  }

  const origin = siteUrl();
  if (!origin) return fail("missing_site_url");
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!apiKey) return fail("email_failed");
  const supportEmail = Deno.env.get("SUPPORT_EMAIL") ?? "motivescripts.team@gmail.com";

  try {
    if (body.kind === "proposal") {
      const { data: proposal } = await admin
        .from("proposals")
        .select("id, client_id, proposal_number, published_revision_id")
        .eq("id", body.id)
        .maybeSingle();
      if (!proposal?.published_revision_id) return fail("not_found");
      const denied = await assertManage(proposal.client_id, "proposals.manage");
      if (denied) return denied;
      const { data: revision } = await admin
        .from("proposal_revisions")
        .select("title, investment_cents, valid_until, status")
        .eq("id", proposal.published_revision_id)
        .maybeSingle();
      const { data: clientRow } = await admin
        .from("clients")
        .select("business_name, email")
        .eq("id", proposal.client_id)
        .maybeSingle();
      const { data: recipients } = await admin
        .from("profiles")
        .select("email")
        .eq("client_id", proposal.client_id)
        .eq("role", "client");
      const emails = [
        ...new Set(
          [...(recipients ?? []).map((row: { email: string | null }) => row.email), clientRow?.email]
            .map((value) => (value ?? "").trim().toLowerCase())
            .filter((value) => value.includes("@")),
        ),
      ];
      if (emails.length === 0) return fail("email_failed");
      const expires = revision?.valid_until
        ? `Valid until ${new Date(revision.valid_until).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
        : "Please review this proposal in your client portal.";
      const html = brandedEmail({
        heading: "A proposal is ready for your review.",
        company: clientRow?.business_name ?? "your team",
        number: proposal.proposal_number,
        title: revision?.title ?? "Proposal",
        summary: `Investment ${formatUsdFromCents(Number(revision?.investment_cents ?? 0))}.`,
        expiresLabel: expires,
        url: `${origin}/client/proposals/${proposal.id}`,
        cta: "Review proposal",
        supportEmail,
      });
      let attachments: { filename: string; content: string }[] | undefined;
      try {
        const model = await loadProposalPdfModel(admin, proposal.id, "client");
        if (model) {
          const bytes = await generateProposalPdf(model);
          attachments = [{ filename: proposalPdfFilename(model.number), content: bytesToBase64(bytes) }];
        }
      } catch {
        console.error("document-email proposal pdf failed");
      }
      await sendResend(apiKey, emails, "Your MotiveScripts proposal is ready", html, attachments);
      console.log("document-email sent", { kind: "proposal", id: proposal.id, attached: Boolean(attachments?.length) });
      return json({ ok: true });
    }

    if (body.kind === "invoice") {
      const { data: invoice } = await admin
        .from("invoices")
        .select("id, client_id, invoice_number, amount_due_cents, total_cents, due_date, status")
        .eq("id", body.id)
        .maybeSingle();
      if (!invoice || invoice.status === "draft") return fail("not_found");
      const deniedInvoice = await assertManage(invoice.client_id, "invoices.manage");
      if (deniedInvoice) return deniedInvoice;
      const { data: clientRow } = await admin
        .from("clients")
        .select("business_name, email")
        .eq("id", invoice.client_id)
        .maybeSingle();
      const { data: recipients } = await admin
        .from("profiles")
        .select("email")
        .eq("client_id", invoice.client_id)
        .eq("role", "client");
      const emails = [
        ...new Set(
          [...(recipients ?? []).map((row: { email: string | null }) => row.email), clientRow?.email]
            .map((value) => (value ?? "").trim().toLowerCase())
            .filter((value) => value.includes("@")),
        ),
      ];
      if (emails.length === 0) return fail("email_failed");
      const due = invoice.due_date
        ? `Due ${new Date(invoice.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
        : "Please review this invoice in your client portal.";
      const html = brandedEmail({
        heading: "A new invoice is ready.",
        company: clientRow?.business_name ?? "your team",
        number: invoice.invoice_number,
        title: "Invoice",
        summary: `Total ${formatUsdFromCents(Number(invoice.total_cents ?? 0))}. Amount due ${formatUsdFromCents(Number(invoice.amount_due_cents ?? 0))}.`,
        expiresLabel: due,
        url: `${origin}/client/invoices/${invoice.id}`,
        cta: "View invoice",
        supportEmail,
      });
      let attachments: { filename: string; content: string }[] | undefined;
      try {
        const model = await loadInvoicePdfModel(admin, invoice.id, "client");
        if (model) {
          const bytes = await generateInvoicePdf(model);
          attachments = [{ filename: invoicePdfFilename(model.number), content: bytesToBase64(bytes) }];
        }
      } catch {
        console.error("document-email invoice pdf failed");
      }
      await sendResend(apiKey, emails, "Your MotiveScripts invoice is ready", html, attachments);
      console.log("document-email sent", { kind: "invoice", id: invoice.id, attached: Boolean(attachments?.length) });
      return json({ ok: true });
    }

    if (body.kind === "payment") {
      const { data: invoice } = await admin
        .from("invoices")
        .select("id, client_id, invoice_number, amount_due_cents, status")
        .eq("id", body.id)
        .maybeSingle();
      if (!invoice || invoice.status === "draft") return fail("not_found");
      let paidCents = 0;
      if (body.paymentId) {
        const { data: payment } = await admin
          .from("payments")
          .select("amount_cents, invoice_id, reversed_at")
          .eq("id", body.paymentId)
          .maybeSingle();
        if (!payment || payment.invoice_id !== invoice.id || payment.reversed_at) return fail("not_found");
        paidCents = Number(payment.amount_cents ?? 0);
      }
      const { data: clientRow } = await admin
        .from("clients")
        .select("business_name, email")
        .eq("id", invoice.client_id)
        .maybeSingle();
      const { data: recipients } = await admin
        .from("profiles")
        .select("email")
        .eq("client_id", invoice.client_id)
        .eq("role", "client");
      const emails = [
        ...new Set(
          [...(recipients ?? []).map((row: { email: string | null }) => row.email), clientRow?.email]
            .map((value) => (value ?? "").trim().toLowerCase())
            .filter((value) => value.includes("@")),
        ),
      ];
      if (emails.length === 0) return fail("email_failed");
      const remaining =
        invoice.status === "paid"
          ? "This invoice is paid in full."
          : `Amount still due ${formatUsdFromCents(invoice.amount_due_cents ?? 0)}.`;
      const html = brandedEmail({
        heading: "We received your payment.",
        company: clientRow?.business_name ?? "your team",
        number: invoice.invoice_number,
        title: "Payment confirmation",
        summary: paidCents > 0 ? `Payment ${formatUsdFromCents(paidCents)}.` : "Your online payment was confirmed.",
        expiresLabel: remaining,
        url: `${origin}/client/invoices/${invoice.id}`,
        cta: "View invoice",
        supportEmail,
      });
      await sendResend(apiKey, emails, "Your MotiveScripts payment was received", html);
      console.log("document-email sent", { kind: "payment", id: invoice.id });
      return json({ ok: true });
    }

    const { data: contract } = await admin
      .from("contracts")
      .select("id, client_id, contract_number, published_revision_id")
      .eq("id", body.id)
      .maybeSingle();
    if (!contract?.published_revision_id) return fail("not_found");
    const deniedContract = await assertManage(contract.client_id, "contracts.manage");
    if (deniedContract) return deniedContract;
    const { data: revision } = await admin
      .from("contract_revisions")
      .select("title, effective_date, expires_at")
      .eq("id", contract.published_revision_id)
      .maybeSingle();
    const { data: clientRow } = await admin
      .from("clients")
      .select("business_name, email")
      .eq("id", contract.client_id)
      .maybeSingle();
    const { data: recipients } = await admin
      .from("profiles")
      .select("email")
      .eq("client_id", contract.client_id)
      .eq("role", "client");
    const emails = [
      ...new Set(
        [...(recipients ?? []).map((row: { email: string | null }) => row.email), clientRow?.email]
          .map((value) => (value ?? "").trim().toLowerCase())
          .filter((value) => value.includes("@")),
      ),
    ];
    if (emails.length === 0) return fail("email_failed");
    const expires = revision?.expires_at
      ? `This agreement expires ${new Date(revision.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
      : "Please review this agreement in your client portal.";
    const html = brandedEmail({
      heading: "A contract is ready for your review.",
      company: clientRow?.business_name ?? "your team",
      number: contract.contract_number,
      title: revision?.title ?? "Agreement",
      summary: revision?.effective_date
        ? `Effective ${new Date(revision.effective_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
        : "Please review the agreement terms.",
      expiresLabel: expires,
      url: `${origin}/client/contracts/${contract.id}`,
      cta: "Review contract",
      supportEmail,
    });
    let attachments: { filename: string; content: string }[] | undefined;
    try {
      const model = await loadContractPdfModel(admin, contract.id, "client");
      if (model) {
        const bytes = await generateContractPdf(model);
        attachments = [{ filename: contractPdfFilename(model.number), content: bytesToBase64(bytes) }];
      }
    } catch {
      console.error("document-email contract pdf failed");
    }
    await sendResend(apiKey, emails, "Your MotiveScripts agreement is ready", html, attachments);
    console.log("document-email sent", { kind: "contract", id: contract.id, attached: Boolean(attachments?.length) });
    return json({ ok: true });
  } catch (caught) {
    console.error("document-email failed", { kind: body.kind });
    const message = caught instanceof Error ? caught.message : "server_error";
    if (message === "email_failed") return fail("email_failed");
    return fail("server_error", 500);
  }
});

async function sendResend(
  apiKey: string,
  to: string[],
  subject: string,
  html: string,
  attachments?: { filename: string; content: string }[],
) {
  const payload: Record<string, unknown> = {
    from: resendFrom(),
    to,
    subject,
    html,
  };
  if (attachments?.length) payload.attachments = attachments;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    console.error("document-email resend failed", { status: response.status });
    throw new Error("email_failed");
  }
}
