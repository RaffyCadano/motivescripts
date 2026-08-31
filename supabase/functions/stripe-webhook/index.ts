import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type RpcResult = {
  payment_id?: string | null;
  duplicate?: boolean;
  skipped?: boolean;
  became_paid?: boolean;
  amount_cents?: number;
};

function paymentIntentId(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith("pi_")) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.startsWith("pi_")) return id;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ ok: false, error: "invalid_action" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  if (!supabaseUrl || !serviceKey || !stripeSecret || !webhookSecret) {
    console.error("stripe-webhook missing env");
    return json({ ok: false, error: "server_error" }, 500);
  }
  if (stripeSecret.startsWith("pk_") || !webhookSecret.startsWith("whsec_")) {
    console.error("stripe-webhook invalid secret format");
    return json({ ok: false, error: "server_error" }, 500);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return json({ ok: false, error: "invalid_signature" }, 400);

  const rawBody = await req.text();
  const stripe = new Stripe(stripeSecret, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch {
    console.error("stripe-webhook signature failed");
    return json({ ok: false, error: "invalid_signature" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: already } = await admin
    .from("stripe_processed_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();
  if (already) {
    return json({ ok: true, duplicate: true });
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    await admin.from("stripe_processed_events").insert({
      event_id: event.id,
      event_type: event.type,
    });
    return json({ ok: true, ignored: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "payment" || session.payment_status === "unpaid") {
    await admin.from("stripe_processed_events").insert({
      event_id: event.id,
      event_type: event.type,
    });
    return json({ ok: true, ignored: true });
  }

  const invoiceId = session.metadata?.invoice_id || session.client_reference_id;
  const intentId = paymentIntentId(session.payment_intent);
  if (!invoiceId || !session.id || !intentId) {
    console.error("stripe-webhook missing invoice or payment intent");
    return json({ ok: false, error: "invalid_session" }, 400);
  }

  const amountTotal = session.amount_total;
  if (amountTotal == null || amountTotal <= 0) {
    console.error("stripe-webhook missing amount_total");
    return json({ ok: false, error: "invalid_session" }, 400);
  }

  const { data: stored } = await admin
    .from("stripe_checkout_sessions")
    .select("invoice_id, client_id, amount_cents")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();
  const metadataClientId = session.metadata?.client_id;
  if (
    !stored ||
    stored.invoice_id !== invoiceId ||
    (metadataClientId && metadataClientId !== stored.client_id)
  ) {
    console.error("stripe-webhook session not found or invoice mismatch");
    return json({ ok: false, error: "invalid_session" }, 400);
  }

  const storedAmount = Number(stored.amount_cents ?? 0);
  const recordAmount = storedAmount > 0 ? Math.min(amountTotal, storedAmount) : amountTotal;

  const { data, error } = await admin.rpc("record_stripe_payment", {
    p_invoice_id: invoiceId,
    p_amount_cents: recordAmount,
    p_currency: (session.currency ?? "usd").toUpperCase(),
    p_checkout_session_id: session.id,
    p_payment_intent_id: intentId,
    p_event_id: event.id,
  });
  if (error) {
    console.error("stripe-webhook rpc failed", error.message);
    return json({ ok: false, error: "server_error" }, 500);
  }

  const result = (data ?? {}) as RpcResult;
  const { error: processedError } = await admin.from("stripe_processed_events").insert({
    event_id: event.id,
    event_type: event.type,
    invoice_id: invoiceId,
    payment_id: result.payment_id ?? null,
  });
  if (processedError && processedError.code !== "23505") {
    console.error("stripe-webhook processed-event insert failed", processedError.message);
  }

  const { data: leftover } = await admin
    .from("stripe_checkout_sessions")
    .select("stripe_checkout_session_id")
    .eq("invoice_id", invoiceId)
    .eq("status", "open")
    .neq("stripe_checkout_session_id", session.id);
  for (const row of leftover ?? []) {
    try {
      await stripe.checkout.sessions.expire(row.stripe_checkout_session_id);
    } catch {
      /* session may already be complete or expired */
    }
  }
  if ((leftover ?? []).length > 0) {
    await admin
      .from("stripe_checkout_sessions")
      .update({ status: "cancelled" })
      .eq("invoice_id", invoiceId)
      .eq("status", "open")
      .neq("stripe_checkout_session_id", session.id);
  }

  if (!result.duplicate && !result.skipped && result.payment_id) {
    try {
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/document-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ kind: "payment", id: invoiceId, paymentId: result.payment_id }),
      });
      if (!emailResponse.ok) {
        console.error("stripe-webhook email http failed", emailResponse.status);
      }
    } catch {
      console.error("stripe-webhook email failed");
    }
  }

  console.log("stripe-webhook processed", {
    type: event.type,
    invoice_id: invoiceId,
    duplicate: Boolean(result.duplicate),
  });
  return json({ ok: true, duplicate: Boolean(result.duplicate) });
});
