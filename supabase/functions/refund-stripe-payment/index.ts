import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";
import { corsHeadersForRequest } from "../_shared/cors.ts";
import { refundStripePayment, StripeCallError, type PaymentForRefund } from "../_shared/stripeRefund.ts";

// "Refund via Stripe" for an admin. Refunds the recorded Stripe payment through Stripe, then reverses it
// in the ledger with the existing reverse_invoice_payment RPC (called AS the admin, since that RPC is
// admin-only). All the money rules live in ../_shared/stripeRefund.ts; this file only wires auth, Stripe,
// and Supabase to it. Admin-only: the caller must pass public.is_admin() BEFORE Stripe is touched.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RequestBody = { paymentId?: string; idempotencyKey?: string };

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersForRequest(req);
  const json = (body: Record<string, unknown>, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  const fail = (error: string, status = 200): Response => json({ ok: false, error }, status);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("invalid_action", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("refund-stripe-payment missing supabase env");
    return fail("server_error", 500);
  }
  if (!stripeSecret || stripeSecret.startsWith("pk_")) {
    console.error("refund-stripe-payment missing or invalid STRIPE_SECRET_KEY");
    return fail("server_error", 500);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return fail("invalid_action");
  }
  const paymentId = (body.paymentId ?? "").trim();
  const idempotencyKey = (body.idempotencyKey ?? "").trim();
  if (!UUID_RE.test(paymentId) || !UUID_RE.test(idempotencyKey)) return fail("invalid_action");

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return fail("not_allowed", 401);

  // Admin only, checked before any Stripe call (the ledger reversal that follows requires an admin).
  const { data: isAdmin } = await userClient.rpc("is_admin");
  if (isAdmin !== true) return fail("not_allowed", 403);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const stripe = new Stripe(stripeSecret, { httpClient: Stripe.createFetchHttpClient() });

  try {
    const outcome = await refundStripePayment(
      {
        loadPayment: async (id): Promise<PaymentForRefund | null> => {
          const { data: payment } = await admin
            .from("payments")
            .select("id, invoice_id, amount_cents, currency, provider, reversed_at, stripe_payment_intent_id")
            .eq("id", id)
            .maybeSingle();
          if (!payment) return null;
          const { data: invoice } = await admin
            .from("invoices")
            .select("invoice_number, client_id")
            .eq("id", payment.invoice_id)
            .maybeSingle();
          if (!invoice) return null;
          return {
            id: payment.id,
            invoice_id: payment.invoice_id,
            invoice_number: invoice.invoice_number,
            client_id: invoice.client_id,
            amount_cents: Number(payment.amount_cents),
            currency: payment.currency,
            provider: payment.provider,
            reversed_at: payment.reversed_at,
            stripe_payment_intent_id: payment.stripe_payment_intent_id,
          };
        },
        listRefunds: async (paymentIntentId) => {
          const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 });
          return refunds.data.map((refund: { id: string; status: string | null; amount: number }) => ({
            id: refund.id,
            status: refund.status ?? "unknown",
            amount: refund.amount,
          }));
        },
        createRefund: async ({ paymentIntentId, amountCents, idempotencyKey: key, metadata }) => {
          try {
            const refund = await stripe.refunds.create(
              { payment_intent: paymentIntentId, amount: amountCents, reason: "requested_by_customer", metadata },
              { idempotencyKey: key },
            );
            return { id: refund.id, status: refund.status ?? "unknown", amount: refund.amount };
          } catch (error) {
            const err = error as { code?: string; type?: string };
            const code =
              err.code ?? (err.type === "StripePermissionError" ? "permission" : (err.type ?? "unknown"));
            console.error("refund-stripe-payment stripe refund failed", { code, type: err.type ?? null });
            throw new StripeCallError(String(code));
          }
        },
        reversePayment: async (id) => {
          const { error } = await userClient.rpc("reverse_invoice_payment", { p_payment_id: id });
          if (error) {
            console.error("refund-stripe-payment ledger reversal failed", { code: error.code ?? null });
            throw new Error("reverse_failed");
          }
        },
        recordActivity: async (clientId, message) => {
          const { error } = await admin.rpc("append_client_staff_activity", {
            p_client_id: clientId,
            p_description: message,
          });
          if (error) console.error("refund-stripe-payment activity failed");
        },
      },
      { paymentId, idempotencyKey, actorEmail: (user.email ?? "").trim().toLowerCase() },
    );

    console.log("refund-stripe-payment", { paymentId, ok: !("error" in outcome), error: "error" in outcome ? outcome.error : null });
    if (!("error" in outcome)) {
      return json({
        ok: true,
        refundId: outcome.refundId,
        status: outcome.status,
        alreadyRefunded: outcome.alreadyRefunded,
        refundedCents: outcome.refundedCents,
      });
    }
    return json({ ok: false, error: outcome.error, ...(outcome.refundId ? { refundId: outcome.refundId } : {}) });
  } catch (error) {
    console.error("refund-stripe-payment failed", { name: error instanceof Error ? error.name : "unknown" });
    return fail("server_error", 500);
  }
});
