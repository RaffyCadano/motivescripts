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

type RecurringRpcResult = {
  duplicate?: boolean;
  invoice_id?: string | null;
  became_paid?: boolean;
};

function paymentIntentId(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith("pi_")) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.startsWith("pi_")) return id;
  }
  return null;
}

function subscriptionId(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith("sub_")) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.startsWith("sub_")) return id;
  }
  return null;
}

function toDateString(unixSeconds: number | null | undefined): string {
  if (typeof unixSeconds === "number" && Number.isFinite(unixSeconds)) {
    return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
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

  async function markProcessed(invoiceId?: string | null, paymentId?: string | null) {
    const { error: processedError } = await admin.from("stripe_processed_events").insert({
      event_id: event.id,
      event_type: event.type,
      invoice_id: invoiceId ?? null,
      payment_id: paymentId ?? null,
    });
    if (processedError && processedError.code !== "23505") {
      console.error("stripe-webhook processed-event insert failed", processedError.message);
    }
  }

  async function handleOneTimePaymentSession(session: Stripe.Checkout.Session) {
    if (session.payment_status === "unpaid") {
      await markProcessed();
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
    await markProcessed(invoiceId, result.payment_id ?? null);

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
  }

  // Subscription checkout completing activates the plan. Must run before any
  // blanket "not a payment-mode session" early exit -- a subscription-mode
  // session is a real, in-scope event, not something to ignore.
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "subscription") {
      const subId = subscriptionId(session.subscription);
      const customerId = typeof session.customer === "string" ? session.customer : null;
      if (!subId || !session.id) {
        console.error("stripe-webhook subscription session missing ids");
        return json({ ok: false, error: "invalid_session" }, 400);
      }
      const { error } = await admin.rpc("activate_service_plan", {
        p_stripe_checkout_session_id: session.id,
        p_stripe_subscription_id: subId,
        p_stripe_customer_id: customerId,
      });
      if (error) {
        console.error("stripe-webhook activate_service_plan failed", error.message);
        return json({ ok: false, error: "server_error" }, 500);
      }
      await markProcessed();
      return json({ ok: true });
    }
    if (session.mode === "payment") {
      const response = await handleOneTimePaymentSession(session);
      return response;
    }
    await markProcessed();
    return json({ ok: true, ignored: true });
  }

  if (event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "payment") {
      await markProcessed();
      return json({ ok: true, ignored: true });
    }
    return handleOneTimePaymentSession(session);
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const subId = subscriptionId(invoice.subscription);
    if (!subId) {
      await markProcessed();
      return json({ ok: true, ignored: true });
    }

    const { data: plan } = await admin
      .from("service_plans")
      .select("id")
      .eq("stripe_subscription_id", subId)
      .maybeSingle();
    if (!plan) {
      // checkout.session.completed for this subscription may not have been
      // processed yet -- Stripe does not guarantee delivery order between the
      // two events on a subscription's first cycle. Do NOT mark this event
      // processed and return a non-2xx so Stripe retries until the plan is
      // active, instead of silently dropping the first billing cycle.
      console.warn("stripe-webhook invoice.paid before plan activation, will retry", { subscription: subId });
      return json({ ok: false, error: "plan_not_active_yet" }, 409);
    }

    const line = invoice.lines?.data?.[0];
    const periodStart = toDateString(line?.period?.start ?? invoice.period_start);
    const periodEnd = toDateString(line?.period?.end ?? invoice.period_end);
    const amountPaid = invoice.amount_paid;
    if (!amountPaid || amountPaid <= 0) {
      await markProcessed();
      return json({ ok: true, ignored: true });
    }

    const { data, error } = await admin.rpc("record_recurring_invoice_payment", {
      p_service_plan_id: plan.id,
      p_stripe_invoice_id: invoice.id,
      p_amount_cents: amountPaid,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });
    if (error) {
      console.error("stripe-webhook record_recurring_invoice_payment failed", error.message);
      return json({ ok: false, error: "server_error" }, 500);
    }
    const result = (data ?? {}) as RecurringRpcResult;
    await markProcessed(result.invoice_id ?? null);
    console.log("stripe-webhook recurring invoice processed", {
      subscription: subId,
      duplicate: Boolean(result.duplicate),
    });
    return json({ ok: true, duplicate: Boolean(result.duplicate) });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subId = subscriptionId(invoice.subscription);
    if (!subId) {
      await markProcessed();
      return json({ ok: true, ignored: true });
    }
    const { data: plan } = await admin
      .from("service_plans")
      .select("id, client_id, project_id, label")
      .eq("stripe_subscription_id", subId)
      .maybeSingle();
    if (!plan) {
      await markProcessed();
      return json({ ok: true, ignored: true });
    }
    const { error } = await admin.rpc("set_service_plan_status_by_subscription", {
      p_stripe_subscription_id: subId,
      p_status: "past_due",
    });
    if (error) {
      console.error("stripe-webhook set past_due failed", error.message);
      return json({ ok: false, error: "server_error" }, 500);
    }
    await admin.rpc("notify_document", {
      p_audience: "admins",
      p_client_id: plan.client_id,
      p_type: "plan_past_due",
      p_title: "Recurring payment failed",
      p_body: `${plan.label} payment failed. The plan is now past due.`,
      p_project_id: plan.project_id,
    });
    await markProcessed();
    return json({ ok: true });
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const subId = subscription.id;
    const { data: plan } = await admin
      .from("service_plans")
      .select("id, client_id, project_id, label")
      .eq("stripe_subscription_id", subId)
      .maybeSingle();
    if (!plan) {
      await markProcessed();
      return json({ ok: true, ignored: true });
    }
    const { error } = await admin.rpc("set_service_plan_status_by_subscription", {
      p_stripe_subscription_id: subId,
      p_status: "canceled",
    });
    if (error) {
      console.error("stripe-webhook set canceled failed", error.message);
      return json({ ok: false, error: "server_error" }, 500);
    }
    await admin.rpc("notify_document", {
      p_audience: "admins",
      p_client_id: plan.client_id,
      p_type: "plan_canceled",
      p_title: "Plan canceled",
      p_body: `${plan.label} was canceled in Stripe.`,
      p_project_id: plan.project_id,
    });
    await markProcessed();
    return json({ ok: true });
  }

  await markProcessed();
  return json({ ok: true, ignored: true });
});
