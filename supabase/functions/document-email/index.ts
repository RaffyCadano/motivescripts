import { createClient } from "npm:@supabase/supabase-js@2";
import { bytesToBase64, generateInvoicePdf, invoicePdfFilename } from "../_shared/invoicePdf.ts";
import { loadInvoicePdfModel } from "../_shared/loadInvoicePdf.ts";
import { generateProposalPdf, proposalPdfFilename } from "../_shared/proposalPdf.ts";
import { loadProposalPdfModel } from "../_shared/loadProposalPdf.ts";
import { generateContractPdf, contractPdfFilename } from "../_shared/contractPdf.ts";
import { loadContractPdfModel } from "../_shared/loadContractPdf.ts";
import { corsHeadersForRequest } from "../_shared/cors.ts";
import { validateExtraRecipients } from "../_shared/emailRecipients.ts";

type RequestBody = {
  kind?: string;
  id?: string;
  /** client_reminder only: what the reminder is about ("proposal", "contract", "invoice", "invite", "discovery", "review" or "info_request"); id is that item (the project for "review" and "info_request"), stage is "1", "2" or "3". */
  remind?: string;
  /** scope_reminder only: "1", "2" or "3", which reminder this is (the last one says so). */
  /** launch_trial only: "7d" and "1d" (the free period is about to end), "paused" (it ended and the site is paused) or "manual" (an admin paused it). */
  stage?: string;
  paymentId?: string;
  /** Invoice emails only: up to 3 extra addresses that receive a copy (CC). Ignored for every other kind. */
  extraRecipients?: unknown;
};

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
      body.kind !== "payment" &&
      body.kind !== "invoice_overdue" &&
      body.kind !== "plan_past_due" &&
      body.kind !== "plan_canceled" &&
      body.kind !== "launch_trial" &&
      body.kind !== "scope_reminder" &&
      body.kind !== "client_reminder" &&
      body.kind !== "new_message") ||
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
  let actorEmail = "";

  // Same as "payment": no interactive user triggers these either -- invoice_overdue
  // is called by the daily overdue-reminder cron job, plan_past_due / plan_canceled
  // are called by the stripe-webhook function reacting to a Stripe event, launch_trial is called by the
  // daily launch-trial sweep (run_launch_trial_sweep), scope_reminder is called by the daily scope-reminder
  // sweep (run_scope_reminder_sweep), client_reminder by run_client_reminder_sweep, and
  // new_message is called by the messages_notify_recipients trigger on every new
  // message. All are authenticated with the service role key, never a browser session.
  if (
    body.kind === "payment" ||
    body.kind === "invoice_overdue" ||
    body.kind === "plan_past_due" ||
    body.kind === "plan_canceled" ||
    body.kind === "launch_trial" ||
    body.kind === "scope_reminder" ||
    body.kind === "client_reminder" ||
    body.kind === "new_message"
  ) {
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
    actorEmail = (user.email ?? "").trim().toLowerCase();
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
  const supportEmail = Deno.env.get("SUPPORT_EMAIL") ?? "support@motivescripts.com";

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
      if (emails.length === 0) return fail("no_recipient");
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
      const extra = validateExtraRecipients(body.extraRecipients);
      if (!extra.ok) return fail("invalid_recipient");
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
      if (emails.length === 0) return fail("no_recipient");
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
        attachments = await Promise.race([
          (async () => {
            const model = await loadInvoicePdfModel(admin, invoice.id, "client");
            if (!model) return undefined;
            const bytes = await generateInvoicePdf(model);
            return [{ filename: invoicePdfFilename(model.number), content: bytesToBase64(bytes) }];
          })(),
          new Promise<undefined>((resolve) => {
            setTimeout(() => resolve(undefined), 8000);
          }),
        ]);
      } catch {
        console.error("document-email invoice pdf failed");
      }
      // Copies go out as CC, so everyone on the email can see who else received it. Anyone who
      // already receives the invoice as the client is not repeated.
      const copyTo = extra.emails.filter((email) => !emails.includes(email));
      await sendResend(
        apiKey,
        emails,
        "Your MotiveScripts invoice is ready",
        html,
        attachments,
        copyTo.length > 0 ? copyTo : undefined,
      );
      console.log("document-email sent", {
        kind: "invoice",
        id: invoice.id,
        attached: Boolean(attachments?.length),
        copies: copyTo.length,
      });
      if (copyTo.length > 0) {
        // Audit trail (staff-only client activity). A failure here never undoes a sent email.
        const { error: activityError } = await admin.rpc("append_client_staff_activity", {
          p_client_id: invoice.client_id,
          p_description: `Invoice ${invoice.invoice_number} emailed to the client with a copy to ${copyTo.join(", ")}${
            actorEmail ? ` (sent by ${actorEmail})` : ""
          }.`,
        });
        if (activityError) console.error("document-email copy activity failed");
      }
      return json({ ok: true });
    }

    if (body.kind === "invoice_overdue") {
      const { data: invoice } = await admin
        .from("invoices")
        .select("id, client_id, invoice_number, amount_due_cents, due_date, status")
        .eq("id", body.id)
        .maybeSingle();
      if (!invoice || invoice.status === "draft" || invoice.status === "cancelled") return fail("not_found");
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
      if (emails.length === 0) return fail("no_recipient");
      const daysOverdue = invoice.due_date
        ? Math.max(1, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000))
        : null;
      const wasDue = invoice.due_date
        ? `Was due ${new Date(invoice.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}${daysOverdue ? ` (${daysOverdue} day${daysOverdue === 1 ? "" : "s"} ago)` : ""}.`
        : "This invoice is past due.";
      const html = brandedEmail({
        heading: "Your invoice is overdue.",
        company: clientRow?.business_name ?? "your team",
        number: invoice.invoice_number,
        title: "Invoice overdue",
        summary: `Amount due ${formatUsdFromCents(Number(invoice.amount_due_cents ?? 0))}.`,
        expiresLabel: wasDue,
        url: `${origin}/client/invoices/${invoice.id}`,
        cta: "Pay invoice",
        supportEmail,
      });
      await sendLogged(
        admin,
        { clientId: invoice.client_id as string, kind: "invoice_overdue", relatedId: invoice.id as string },
        apiKey,
        emails,
        `Overdue: invoice ${invoice.invoice_number}`,
        html,
      );
      console.log("document-email sent", { kind: "invoice_overdue", id: invoice.id });
      return json({ ok: true });
    }

    if (body.kind === "plan_past_due" || body.kind === "plan_canceled") {
      const { data: plan } = await admin
        .from("service_plans")
        .select("id, client_id, label, amount_cents, status")
        .eq("id", body.id)
        .maybeSingle();
      if (!plan) return fail("not_found");
      const { data: clientRow } = await admin
        .from("clients")
        .select("business_name, email")
        .eq("id", plan.client_id)
        .maybeSingle();
      const { data: recipients } = await admin
        .from("profiles")
        .select("email")
        .eq("client_id", plan.client_id)
        .eq("role", "client");
      const emails = [
        ...new Set(
          [...(recipients ?? []).map((row: { email: string | null }) => row.email), clientRow?.email]
            .map((value) => (value ?? "").trim().toLowerCase())
            .filter((value) => value.includes("@")),
        ),
      ];
      if (emails.length === 0) return fail("no_recipient");
      const isPastDue = body.kind === "plan_past_due";
      const html = brandedEmail({
        heading: isPastDue ? "Your recurring payment didn't go through." : "Your recurring plan was canceled.",
        company: clientRow?.business_name ?? "your team",
        number: plan.label,
        title: isPastDue ? "Payment issue" : "Plan canceled",
        summary: isPastDue
          ? `The ${formatUsdFromCents(Number(plan.amount_cents ?? 0))}/mo charge for this plan didn't go through. Please check the card on file so service isn't interrupted.`
          : `This plan (${formatUsdFromCents(Number(plan.amount_cents ?? 0))}/mo) has been canceled and will no longer be billed.`,
        expiresLabel: isPastDue
          ? "We'll retry the charge automatically, but updating your card sooner avoids any gap in service."
          : "Contact us if this wasn't expected or you'd like to restart the plan.",
        url: `${origin}/client/plans`,
        cta: isPastDue ? "Update payment info" : "View your plans",
        supportEmail,
      });
      await sendLogged(
        admin,
        { clientId: plan.client_id as string, kind: String(body.kind), relatedId: plan.id as string },
        apiKey,
        emails,
        isPastDue ? "Action needed: recurring payment failed" : "Your recurring plan was canceled",
        html,
      );
      console.log("document-email sent", { kind: body.kind, id: plan.id });
      return json({ ok: true });
    }

    if (body.kind === "client_reminder") {
      // The daily client-reminder sweep decides what and when; this only finds the item and words the email.
      const remind = String(body.remind ?? "");
      const stage = body.stage === "3" ? 3 : body.stage === "2" ? 2 : 1;
      const fmt = (value: string | null | undefined): string =>
        value
          ? new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
          : "";
      const pick = (texts: [string, string, string]): string => texts[stage - 1];

      let clientId: string | null = null;
      let onlyTo: string | null = null;
      let content: {
        subject: string;
        heading: string;
        number: string;
        title: string;
        summary: string;
        expiresLabel: string;
        url: string;
        cta: string;
      } | null = null;

      if (remind === "proposal") {
        const { data: proposal } = await admin
          .from("proposals")
          .select("id, client_id, proposal_number, published_revision_id")
          .eq("id", body.id)
          .maybeSingle();
        if (!proposal) return fail("not_found");
        const { data: rev } = await admin
          .from("proposal_revisions")
          .select("status, valid_until, title")
          .eq("id", proposal.published_revision_id)
          .maybeSingle();
        if (!rev || (rev.status !== "sent" && rev.status !== "viewed")) return json({ ok: true, skipped: "not_waiting" });
        clientId = proposal.client_id as string;
        const until = fmt(rev.valid_until as string | null);
        content = {
          subject: stage === 3 ? "Your proposal is about to expire" : "Your proposal is waiting for your review",
          heading: stage === 3 ? "Your proposal expires soon." : "Your proposal is waiting for you.",
          number: String(proposal.proposal_number ?? "Proposal"),
          title: stage === 3 ? "Proposal expiring" : "Proposal",
          summary: pick([
            "We sent you a proposal for your website project. Have a look when you can. It takes a couple of minutes to review, and you can accept it right from your portal.",
            "A quick reminder that your proposal is still waiting. If you have questions about the scope or the price, reply to this email and we'll walk you through it.",
            until
              ? `Your proposal is valid until ${until}. Review and accept it before then to keep the scope and price as quoted.`
              : "Your proposal is still open. Review and accept it to keep your project moving.",
          ]),
          expiresLabel: "Questions before you decide? Reply to this email and we'll help.",
          url: `${origin}/client/proposals/${proposal.id}`,
          cta: "Review your proposal",
        };
      } else if (remind === "contract") {
        const { data: contract } = await admin
          .from("contracts")
          .select("id, client_id, contract_number, published_revision_id")
          .eq("id", body.id)
          .maybeSingle();
        if (!contract) return fail("not_found");
        const { data: rev } = await admin
          .from("contract_revisions")
          .select("status, expires_at")
          .eq("id", contract.published_revision_id)
          .maybeSingle();
        if (!rev || (rev.status !== "sent" && rev.status !== "viewed")) return json({ ok: true, skipped: "not_waiting" });
        clientId = contract.client_id as string;
        const until = fmt(rev.expires_at as string | null);
        content = {
          subject: stage === 3 ? "Your contract is about to expire" : "Your contract is waiting for your signature",
          heading: stage === 3 ? "Your contract expires soon." : "Your contract is ready to sign.",
          number: String(contract.contract_number ?? "Contract"),
          title: stage === 3 ? "Contract expiring" : "Contract",
          summary: pick([
            "Your contract is ready. Read it over and accept it from your portal, and we can move on to the next step.",
            "A quick reminder that your contract is still waiting for you. If anything needs changing before you sign, reply to this email and we'll sort it out.",
            until
              ? `Your contract is open until ${until}. Please review and accept it before then so your project isn't held up.`
              : "Your contract is still open. Please review and accept it so your project isn't held up.",
          ]),
          expiresLabel: "Need a change before you sign? Reply to this email.",
          url: `${origin}/client/contracts/${contract.id}`,
          cta: "Review your contract",
        };
      } else if (remind === "invoice") {
        const { data: invoice } = await admin
          .from("invoices")
          .select("id, client_id, invoice_number, status, due_date, amount_due_cents")
          .eq("id", body.id)
          .maybeSingle();
        if (!invoice) return fail("not_found");
        if (!["sent", "viewed", "partially_paid"].includes(String(invoice.status)) || Number(invoice.amount_due_cents) <= 0) {
          return json({ ok: true, skipped: "not_waiting" });
        }
        clientId = invoice.client_id as string;
        const due = fmt(invoice.due_date as string | null);
        content = {
          subject: `Invoice ${invoice.invoice_number} is due soon`,
          heading: "Your invoice is due soon.",
          number: String(invoice.invoice_number),
          title: "Invoice due",
          summary: `Invoice ${invoice.invoice_number} for ${formatUsdFromCents(Number(invoice.amount_due_cents))} is due on ${due}. You can pay it online from your portal.`,
          expiresLabel: "Already paid? Thank you, and you can ignore this. Questions? Reply to this email.",
          url: `${origin}/client/invoices/${invoice.id}`,
          cta: "View and pay invoice",
        };
      } else if (remind === "invite") {
        const { data: invite } = await admin
          .from("client_invitations")
          .select("id, client_id, email, status, expires_at")
          .eq("id", body.id)
          .maybeSingle();
        if (!invite) return fail("not_found");
        if (invite.status !== "pending" || new Date(invite.expires_at as string).getTime() <= Date.now()) {
          return json({ ok: true, skipped: "not_waiting" });
        }
        clientId = invite.client_id as string;
        onlyTo = String(invite.email).trim().toLowerCase();
        const until = fmt(invite.expires_at as string);
        content = {
          subject: stage === 2 ? "Your MotiveScripts invitation expires tomorrow" : "Your MotiveScripts invitation is waiting",
          heading: stage === 2 ? "Your invitation expires tomorrow." : "Your invitation is waiting.",
          number: "Client portal",
          title: "Portal invitation",
          summary: `We invited you to your MotiveScripts client portal, where you'll complete your Website Scope and follow your project. The invitation link in that first email works until ${until}. Open that email and use its button to set up your account.`,
          expiresLabel: "Can't find it, or the link has expired? Reply to this email and we'll send you a new one.",
          url: `${origin}/login`,
          cta: "Go to sign in",
        };
      } else if (remind === "discovery") {
        const { data: intake } = await admin
          .from("discovery_intakes")
          .select("id, client_id, project_id, status")
          .eq("id", body.id)
          .maybeSingle();
        if (!intake) return fail("not_found");
        if (intake.status !== "awaiting_client" && intake.status !== "more_information_needed") {
          return json({ ok: true, skipped: "not_waiting" });
        }
        clientId = intake.client_id as string;
        const moreInfo = intake.status === "more_information_needed";
        content = {
          subject: moreInfo ? "We need a little more information for your project" : "We're waiting on your project details",
          heading: moreInfo ? "We need a little more from you." : "We're waiting on your project details.",
          number: "Project discovery",
          title: "Action needed",
          summary: moreInfo
            ? pick([
                "We reviewed your project details and need a bit more information before we can move ahead. Your portal shows exactly what's missing.",
                "A quick reminder that we're still waiting on a few details for your project. Adding them lets us keep the work moving.",
                "We still need a few details to keep your project on schedule. It only takes a few minutes in your portal.",
              ])
            : pick([
                "Your project is set up and the next step is yours: fill in your project details so we can start planning. It only takes a few minutes in your portal.",
                "A quick reminder that we're waiting on your project details. Once they're in, we can start on your website.",
                "We can't start your website until we have your project details, so the sooner they're in, the sooner we begin.",
              ]),
          expiresLabel: "Prefer to talk it through? Reply to this email and we'll go over it with you.",
          url: `${origin}/client/project/${intake.project_id}`,
          cta: "Add your project details",
        };
      } else if (remind === "review" || remind === "info_request") {
        const { data: project } = await admin
          .from("projects")
          .select("id, name, client_id")
          .eq("id", body.id)
          .maybeSingle();
        if (!project) return fail("not_found");
        clientId = project.client_id as string;
        if (remind === "review") {
          const { count } = await admin
            .from("deliverables")
            .select("id", { count: "exact", head: true })
            .eq("project_id", project.id)
            .eq("status", "In Review")
            .is("archived_at", null);
          const n = count ?? 0;
          if (n === 0) return json({ ok: true, skipped: "not_waiting" });
          const noun = n === 1 ? "file is" : "files are";
          content = {
            subject: n === 1 ? "A file is waiting for your review" : `${n} files are waiting for your review`,
            heading: `${n} ${noun} waiting for your review.`,
            number: String(project.name),
            title: "Review needed",
            summary: pick([
              `We've shared ${n === 1 ? "a file" : n + " files"} for you to review on ${project.name}. Take a look and approve it, or tell us what to change.`,
              "A quick reminder that we're waiting on your feedback. Your project can't move to the next stage until it's approved.",
              "We're still waiting on your review, and it's holding up your project. Approving it, or telling us what to change, gets things moving again.",
            ]),
            expiresLabel: "Not sure about something? Leave a comment on the file or reply to this email.",
            url: `${origin}/client/files`,
            cta: "Review your files",
          };
        } else {
          const { count } = await admin
            .from("task_client_requests")
            .select("id", { count: "exact", head: true })
            .eq("project_id", project.id)
            .eq("status", "awaiting_client");
          const n = count ?? 0;
          if (n === 0) return json({ ok: true, skipped: "not_waiting" });
          content = {
            subject: n === 1 ? "We need a reply from you" : `We need replies on ${n} requests`,
            heading: n === 1 ? "We need a reply from you." : `We need replies on ${n} requests.`,
            number: String(project.name),
            title: "Information needed",
            summary: pick([
              `We've asked for some information to keep ${project.name} moving. You can answer in your portal in a few minutes.`,
              "A quick reminder that we're waiting on the information we asked for. We can't finish that part of your project without it.",
              "We're still waiting on the information we asked for, and it's holding up your project. Please send it when you can.",
            ]),
            expiresLabel: "Don't have it handy? Reply to this email and tell us when you can send it.",
            url: `${origin}/client/project/${project.id}`,
            cta: "Reply in your portal",
          };
        }
      } else {
        return fail("invalid_action");
      }

      const { data: clientRow } = await admin
        .from("clients")
        .select("business_name, email")
        .eq("id", clientId)
        .maybeSingle();
      let emails: string[];
      if (onlyTo) {
        emails = [onlyTo];
      } else {
        const { data: recipients } = await admin
          .from("profiles")
          .select("email")
          .eq("client_id", clientId)
          .eq("role", "client");
        emails = [
          ...new Set(
            [...(recipients ?? []).map((row: { email: string | null }) => row.email), clientRow?.email]
              .map((value) => (value ?? "").trim().toLowerCase())
              .filter((value) => value.includes("@")),
          ),
        ];
      }
      if (emails.length === 0) return fail("no_recipient");
      const html = brandedEmail({
        heading: content.heading,
        company: clientRow?.business_name ?? "your team",
        number: content.number,
        title: content.title,
        summary: content.summary,
        expiresLabel: content.expiresLabel,
        url: content.url,
        cta: content.cta,
        supportEmail,
      });
      await sendLogged(
        admin,
        { clientId: clientId as string, kind: `reminder_${remind}`, stage, relatedId: body.id as string },
        apiKey,
        emails,
        content.subject,
        html,
      );
      console.log("document-email sent", { kind: "client_reminder", remind, stage, id: body.id });
      return json({ ok: true });
    }

    if (body.kind === "scope_reminder") {
      // body.id is the client. They have a portal login but have not submitted their Website Scope, so the
      // proposal can't be prepared. Three reminders at most; the sweep decides when, this only words it.
      const stage = body.stage === "3" ? 3 : body.stage === "2" ? 2 : 1;
      const { data: clientRow } = await admin
        .from("clients")
        .select("id, business_name, contact_name, email")
        .eq("id", body.id)
        .maybeSingle();
      if (!clientRow) return fail("not_found");
      const { data: recipients } = await admin
        .from("profiles")
        .select("email")
        .eq("client_id", clientRow.id)
        .eq("role", "client");
      const emails = [
        ...new Set(
          [...(recipients ?? []).map((row: { email: string | null }) => row.email), clientRow.email]
            .map((value) => (value ?? "").trim().toLowerCase())
            .filter((value) => value.includes("@")),
        ),
      ];
      if (emails.length === 0) return fail("no_recipient");
      const html = brandedEmail({
        heading:
          stage === 3
            ? "Last reminder: complete your Website Scope."
            : "Complete your Website Scope to get started.",
        company: clientRow.business_name ?? "your team",
        number: "Website Scope",
        title: stage === 3 ? "Final reminder" : "Action needed",
        summary:
          stage === 1
            ? "We're ready to get your website project going, but we can't start until we have your Website Scope. It only takes about 2 minutes: choose a package, pick your pages and features, and tell us about your project."
            : stage === 2
              ? "A quick reminder: we can't prepare your proposal until your Website Scope is in. It only takes about 2 minutes, and it's the first step to getting your project started."
              : "This is our last reminder. Your project can't move forward until your Website Scope is complete, so the sooner it's in, the sooner we can send your proposal.",
        expiresLabel: "Takes about 2 minutes. Prefer to talk it through? Reply to this email and we'll fill it in with you.",
        url: `${origin}/client/scope`,
        cta: "Complete your scope",
        supportEmail,
      });
      await sendLogged(
        admin,
        { clientId: clientRow.id as string, kind: "scope_reminder", stage },
        apiKey,
        emails,
        stage === 3 ? "Last reminder: complete your Website Scope" : "Complete your Website Scope to get started",
        html,
      );
      console.log("document-email sent", { kind: "scope_reminder", stage, id: clientRow.id });
      return json({ ok: true });
    }

    if (body.kind === "launch_trial") {
      const stage = body.stage === "1d" || body.stage === "paused" || body.stage === "manual" ? body.stage : "7d";
      const { data: project } = await admin
        .from("projects")
        .select("id, name, client_id")
        .eq("id", body.id)
        .maybeSingle();
      if (!project) return fail("not_found");
      const { data: dev } = await admin
        .from("project_development")
        .select("launch_trial_ends_at, pause_client_note")
        .eq("project_id", project.id)
        .maybeSingle();
      const { data: clientRow } = await admin
        .from("clients")
        .select("business_name, email")
        .eq("id", project.client_id)
        .maybeSingle();
      const { data: recipients } = await admin
        .from("profiles")
        .select("email")
        .eq("client_id", project.client_id)
        .eq("role", "client");
      const emails = [
        ...new Set(
          [...(recipients ?? []).map((row: { email: string | null }) => row.email), clientRow?.email]
            .map((value) => (value ?? "").trim().toLowerCase())
            .filter((value) => value.includes("@")),
        ),
      ];
      if (emails.length === 0) return fail("no_recipient");
      const endsOn = dev?.launch_trial_ends_at
        ? new Date(dev.launch_trial_ends_at as string).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })
        : "";
      const manual = stage === "manual";
      const paused = stage === "paused" || manual;
      const adminNote = ((dev?.pause_client_note as string | null) ?? "").trim();
      const html = brandedEmail({
        heading: paused
          ? "Your website has been paused."
          : stage === "1d"
            ? "Your free period ends tomorrow."
            : "Your free period ends soon.",
        company: clientRow?.business_name ?? "your team",
        number: project.name,
        title: paused ? "Website paused" : "Free launch period",
        summary: manual
          ? `We've paused your website.${adminNote ? ` ${adminNote}` : ""} Get in touch and we'll help you get it back online.`
          : paused
          ? "Your free 30 days after launch have ended and there is no active Website Care plan, so we've paused your website. Choose a plan and we'll bring it back online."
          : `Your free 30 days after launch end on ${endsOn}. After that your website is paused unless you have a Website Care plan (hosting, updates, and support).`,
        expiresLabel: paused
          ? "Questions, or need more time? Reply to this email and we'll help."
          : "Choosing a plan now means no gap and nothing changes for your visitors.",
        url: manual ? `${origin}/client/messages` : `${origin}/client/plans`,
        cta: manual ? "Message us" : paused ? "Choose a plan to restore it" : "Choose a Website Care plan",
        supportEmail,
      });
      await sendLogged(
        admin,
        { clientId: project.client_id as string, kind: "launch_trial", stage, relatedId: project.id as string },
        apiKey,
        emails,
        paused
          ? "Your website has been paused"
          : stage === "1d"
            ? "Your free period ends tomorrow"
            : "Your free period ends in about a week",
        html,
      );
      console.log("document-email sent", { kind: "launch_trial", stage, id: project.id });
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
      if (emails.length === 0) return fail("no_recipient");
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

    if (body.kind === "new_message") {
      const { data: message } = await admin
        .from("messages")
        .select("id, conversation_id, sender_user_id, body, created_at")
        .eq("id", body.id)
        .maybeSingle();
      if (!message) return fail("not_found");
      const { data: conversation } = await admin
        .from("conversations")
        .select("id, client_id, project_id")
        .eq("id", message.conversation_id)
        .maybeSingle();
      if (!conversation) return fail("not_found");
      const { data: sender } = await admin
        .from("profiles")
        .select("role")
        .eq("id", message.sender_user_id)
        .maybeSingle();
      const { data: clientRow } = await admin
        .from("clients")
        .select("business_name, email")
        .eq("id", conversation.client_id)
        .maybeSingle();
      const preview = (message.body ?? "").slice(0, 200);
      const company = clientRow?.business_name ?? "your team";

      let emails: string[];
      let heading: string;
      let url: string;
      if (sender?.role === "client") {
        // A client wrote in -- notify the same admin/staff audience the in-app
        // notification already goes to (messages.view for this client).
        const { data: recipients } = await admin.rpc("agency_emails_for", {
          p_perm: "messages.view",
          p_client_id: conversation.client_id,
        });
        emails = ((recipients ?? []) as { email: string }[])
          .map((row) => row.email)
          .filter((value): value is string => Boolean(value));
        heading = `New message from ${company}`;
        url = `${origin}/admin/messages/${conversation.id}`;
      } else {
        // Staff/admin wrote in -- notify the client's portal users.
        const { data: recipients } = await admin
          .from("profiles")
          .select("email")
          .eq("client_id", conversation.client_id)
          .eq("role", "client");
        emails = [
          ...new Set(
            [...(recipients ?? []).map((row: { email: string | null }) => row.email), clientRow?.email]
              .map((value) => (value ?? "").trim().toLowerCase())
              .filter((value) => value.includes("@")),
          ),
        ];
        heading = "New message from MotiveScripts";
        url = `${origin}/client/messages/${conversation.id}`;
      }
      if (emails.length === 0) return fail("no_recipient");

      const html = brandedEmail({
        heading,
        company,
        number: "Conversation",
        title: "New message",
        summary: preview || "You have a new message.",
        expiresLabel: "Reply from your portal at any time.",
        url,
        cta: "View message",
        supportEmail,
      });
      await sendResend(apiKey, emails, heading, html);
      console.log("document-email sent", { kind: "new_message", id: message.id });
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
    if (emails.length === 0) return fail("no_recipient");
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
  cc?: string[],
) {
  const payload: Record<string, unknown> = {
    from: resendFrom(),
    to,
    subject,
    html,
  };
  if (attachments?.length) payload.attachments = attachments;
  if (cc?.length) payload.cc = cc;
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
  const sentBody = (await response.json().catch(() => null)) as { id?: unknown } | null;
  return typeof sentBody?.id === "string" ? sentBody.id : null;
}

/**
 * Sends the email, then records it in client_email_log (who, what, when, and the provider's message id) so staff
 * can show a client was reminded. Used for the automated reminders. A failure to write the log never fails or
 * repeats the send.
 */
async function sendLogged(
  admin: ReturnType<typeof createClient>,
  meta: { clientId: string; kind: string; stage?: string | number | null; relatedId?: string | null },
  apiKey: string,
  to: string[],
  subject: string,
  html: string,
) {
  const providerId = await sendResend(apiKey, to, subject, html);
  try {
    const { error } = await admin.from("client_email_log").insert({
      client_id: meta.clientId,
      kind: meta.kind,
      stage: meta.stage === undefined || meta.stage === null ? null : String(meta.stage),
      related_id: meta.relatedId ?? null,
      subject,
      recipients: to,
      provider_id: providerId,
    });
    if (error) console.error("document-email log failed", { kind: meta.kind, message: error.message });
  } catch (caught) {
    console.error("document-email log failed", { kind: meta.kind, message: String(caught) });
  }
}
