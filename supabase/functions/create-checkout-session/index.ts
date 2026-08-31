import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";
import { corsHeadersForRequest, publicSiteBaseUrl } from "../_shared/cors.ts";

const STRIPE_MIN_CENTS = 50;

type RequestBody = {
  invoiceId?: string;
};

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
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("create-checkout-session missing supabase env");
    return fail("server_error", 500);
  }
  if (!stripeSecret || stripeSecret.startsWith("pk_")) {
    console.error("create-checkout-session missing or invalid STRIPE_SECRET_KEY");
    return fail("server_error", 500);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return fail("invalid_action");
  }
  const invoiceId = (body.invoiceId ?? "").trim();
  if (!invoiceId) return fail("invalid_action");

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

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, client_id, email, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "client" || !profile.client_id) {
    return fail("not_allowed", 403);
  }

  let invoice = (
    await admin
      .from("invoices")
      .select(
        "id, client_id, project_id, invoice_number, status, currency, amount_due_cents, amount_paid_cents, total_cents",
      )
      .eq("id", invoiceId)
      .maybeSingle()
  ).data;
  if (!invoice || invoice.client_id !== profile.client_id) {
    return fail("not_allowed", 403);
  }
  if (invoice.status === "draft" || invoice.status === "cancelled" || invoice.status === "paid") {
    return fail("not_payable");
  }

  const origin = publicSiteBaseUrl(req);
  if (!origin) return fail("missing_site_url");

  const { data: clientRow } = await admin
    .from("clients")
    .select("id, business_name, email, contact_name")
    .eq("id", profile.client_id)
    .maybeSingle();

  const stripe = new Stripe(stripeSecret, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  const { data: openSessions } = await admin
    .from("stripe_checkout_sessions")
    .select("stripe_checkout_session_id")
    .eq("invoice_id", invoice.id)
    .eq("status", "open");
  for (const row of openSessions ?? []) {
    try {
      await stripe.checkout.sessions.expire(row.stripe_checkout_session_id);
    } catch {
      /* already complete or expired */
    }
  }
  if ((openSessions ?? []).length > 0) {
    await admin
      .from("stripe_checkout_sessions")
      .update({ status: "cancelled" })
      .eq("invoice_id", invoice.id)
      .eq("status", "open");
  }

  const { data: fresh } = await admin
    .from("invoices")
    .select(
      "id, client_id, project_id, invoice_number, status, currency, amount_due_cents, amount_paid_cents, total_cents",
    )
    .eq("id", invoiceId)
    .maybeSingle();
  if (!fresh || fresh.client_id !== profile.client_id) {
    return fail("not_allowed", 403);
  }
  if (fresh.status === "draft" || fresh.status === "cancelled" || fresh.status === "paid") {
    return fail("not_payable");
  }
  const charge = Number(fresh.amount_due_cents ?? 0);
  if (charge <= 0) return fail("not_payable");
  if (charge < STRIPE_MIN_CENTS) return fail("amount_too_small");
  invoice = fresh;

  let customerId: string | undefined;
  const { data: mapping } = await admin
    .from("client_stripe_customers")
    .select("stripe_customer_id")
    .eq("client_id", profile.client_id)
    .maybeSingle();
  if (mapping?.stripe_customer_id) {
    customerId = mapping.stripe_customer_id;
  } else {
    const customer = await stripe.customers.create({
      email: (clientRow?.email || profile.email || user.email || "").trim() || undefined,
      name: clientRow?.business_name || profile.full_name || undefined,
      metadata: { client_id: profile.client_id },
    });
    customerId = customer.id;
    const { error: mapError } = await admin.from("client_stripe_customers").insert({
      client_id: profile.client_id,
      stripe_customer_id: customer.id,
    });
    if (mapError) {
      const { data: raced } = await admin
        .from("client_stripe_customers")
        .select("stripe_customer_id")
        .eq("client_id", profile.client_id)
        .maybeSingle();
      customerId = raced?.stripe_customer_id ?? customerId;
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: invoice.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: String(invoice.currency || "USD").toLowerCase(),
            unit_amount: charge,
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: "MotiveScripts invoice payment",
            },
          },
        },
      ],
      metadata: {
        invoice_id: invoice.id,
        client_id: profile.client_id,
        project_id: invoice.project_id ?? "",
        invoice_number: invoice.invoice_number,
        user_id: user.id,
        amount_cents: String(charge),
      },
      payment_intent_data: {
        metadata: {
          invoice_id: invoice.id,
          client_id: profile.client_id,
          project_id: invoice.project_id ?? "",
          invoice_number: invoice.invoice_number,
        },
      },
      success_url: `${origin}/client/invoices/${invoice.id}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/client/invoices/${invoice.id}/payment-cancelled`,
    });
    if (!session.url) {
      console.error("create-checkout-session missing url");
      return fail("server_error", 500);
    }

    const { error: sessionError } = await admin.from("stripe_checkout_sessions").insert({
      invoice_id: invoice.id,
      client_id: profile.client_id,
      created_by: user.id,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      amount_cents: charge,
      currency: invoice.currency || "USD",
      status: "open",
    });
    if (sessionError) {
      console.error("create-checkout-session persist failed", sessionError.message);
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch {
        console.error("create-checkout-session expire failed");
      }
      return fail("server_error", 500);
    }

    console.log("create-checkout-session created", { invoice_id: invoice.id, amount_cents: charge });
    return json({ ok: true, url: session.url });
  } catch (caught) {
    console.error("create-checkout-session stripe failed");
    return fail("server_error", 500);
  }
});
