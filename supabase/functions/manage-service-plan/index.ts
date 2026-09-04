import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";
import { corsHeadersForRequest, publicSiteBaseUrl } from "../_shared/cors.ts";

type Action = "create_checkout" | "cancel";
type ServiceClient = SupabaseClient;

type RequestBody = {
  action?: string;
  planId?: string;
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

Deno.serve(async (req) => {
  const json = jsonWith(req);
  const fail = (error: string, status = 200): Response => json({ ok: false, error }, status);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersForRequest(req) });
  if (req.method !== "POST") return fail("invalid_action", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("manage-service-plan missing supabase env");
    return fail("server_error", 500);
  }
  if (!stripeSecret || stripeSecret.startsWith("pk_")) {
    console.error("manage-service-plan missing or invalid STRIPE_SECRET_KEY");
    return fail("server_error", 500);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return fail("invalid_action");
  }
  const action = body.action as Action | undefined;
  if (action !== "create_checkout" && action !== "cancel") return fail("invalid_action");
  const planId = (body.planId ?? "").trim();
  if (!planId) return fail("invalid_action");

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

  // Service plans commit the agency to an ongoing, auto-charging financial
  // relationship with a client. Unlike client-invitation (admin OR staff with
  // a per-client grant), keep this admin-only for v1 -- not staff-delegable.
  const { data: profile } = await admin.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
  if (!profile || profile.role !== "admin") return fail("not_allowed", 403);

  const { data: plan } = await admin
    .from("service_plans")
    .select("id, client_id, project_id, plan_type, label, amount_cents, status, stripe_subscription_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return fail("not_found");

  const stripe = new Stripe(stripeSecret, { httpClient: Stripe.createFetchHttpClient() });

  try {
    if (action === "cancel") {
      return await cancelPlan(admin, stripe, plan, json);
    }
    return await createCheckout(admin, stripe, req, plan, json);
  } catch (caught) {
    console.error("manage-service-plan failed", { action, message: caught instanceof Error ? caught.message : "" });
    return fail("server_error", 500);
  }
});

async function createCheckout(
  admin: ServiceClient,
  stripe: Stripe,
  req: Request,
  plan: {
    id: string;
    client_id: string;
    project_id: string | null;
    label: string;
    amount_cents: number;
    status: string;
  },
  json: JsonFn,
) {
  if (plan.status !== "pending") return json({ ok: false, error: "not_payable" });

  const origin = publicSiteBaseUrl(req);
  if (!origin) return json({ ok: false, error: "missing_site_url" });

  const { data: clientRow } = await admin
    .from("clients")
    .select("id, business_name, email")
    .eq("id", plan.client_id)
    .maybeSingle();
  if (!clientRow) return json({ ok: false, error: "not_found" });

  let customerId: string | undefined;
  const { data: mapping } = await admin
    .from("client_stripe_customers")
    .select("stripe_customer_id")
    .eq("client_id", plan.client_id)
    .maybeSingle();
  if (mapping?.stripe_customer_id) {
    customerId = mapping.stripe_customer_id;
  } else {
    const customer = await stripe.customers.create({
      email: (clientRow.email ?? "").trim() || undefined,
      name: clientRow.business_name || undefined,
      metadata: { client_id: plan.client_id },
    });
    customerId = customer.id;
    const { error: mapError } = await admin.from("client_stripe_customers").insert({
      client_id: plan.client_id,
      stripe_customer_id: customer.id,
    });
    if (mapError) {
      const { data: raced } = await admin
        .from("client_stripe_customers")
        .select("stripe_customer_id")
        .eq("client_id", plan.client_id)
        .maybeSingle();
      customerId = raced?.stripe_customer_id ?? customerId;
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: plan.amount_cents,
          recurring: { interval: "month" },
          product_data: {
            name: plan.label,
            description: "MotiveScripts recurring plan",
          },
        },
      },
    ],
    metadata: {
      service_plan_id: plan.id,
      client_id: plan.client_id,
    },
    subscription_data: {
      metadata: {
        service_plan_id: plan.id,
        client_id: plan.client_id,
      },
    },
    success_url: `${origin}/client/settings?plan=success`,
    cancel_url: `${origin}/client/settings?plan=cancelled`,
  });
  if (!session.url) {
    console.error("manage-service-plan missing checkout url");
    return json({ ok: false, error: "server_error" }, 500);
  }

  const { error: updateError } = await admin
    .from("service_plans")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", plan.id)
    .eq("status", "pending");
  if (updateError) {
    console.error("manage-service-plan persist session failed", updateError.message);
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch {
      /* best effort */
    }
    return json({ ok: false, error: "server_error" }, 500);
  }

  return json({ ok: true, url: session.url });
}

async function cancelPlan(
  admin: ServiceClient,
  stripe: Stripe,
  plan: { id: string; status: string; stripe_subscription_id: string | null },
  json: JsonFn,
) {
  if (plan.status !== "active" && plan.status !== "past_due") {
    return json({ ok: false, error: "not_cancelable" });
  }
  if (!plan.stripe_subscription_id) {
    return json({ ok: false, error: "not_cancelable" });
  }
  // Only calls Stripe here -- the customer.subscription.deleted webhook event
  // is the single source of truth that updates service_plans.status, exactly
  // like the one-time flow never sets invoice status outside record_stripe_payment.
  try {
    await stripe.subscriptions.cancel(plan.stripe_subscription_id);
  } catch (caught) {
    console.error("manage-service-plan cancel failed", caught instanceof Error ? caught.message : "");
    return json({ ok: false, error: "server_error" }, 500);
  }
  return json({ ok: true });
}
