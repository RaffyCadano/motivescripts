import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";
import { corsHeadersForRequest, publicSiteBaseUrl } from "../_shared/cors.ts";
import {
  SELF_SERVE_PLANS,
  clientPlanErrorCode,
  isSelfServePlanType,
  isUuid,
} from "../_shared/servicePlanCatalog.ts";
import { scheduledCancelAt, type SubscriptionLike } from "../_shared/stripeSubscription.ts";

type Action = "create_checkout" | "cancel" | "resume_cancel" | "client_checkout" | "client_cancel" | "client_resume";
type ServiceClient = SupabaseClient;

type RequestBody = {
  action?: string;
  planId?: string;
  /** client_checkout only: which self-serve plan to start, and for which of the client's projects. */
  planType?: string;
  projectId?: string;
  /** cancel (admin) only: "now" (default) stops billing immediately; "period_end" ends at the close of the paid period. */
  when?: string;
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
  if (
    action !== "create_checkout" &&
    action !== "cancel" &&
    action !== "resume_cancel" &&
    action !== "client_checkout" &&
    action !== "client_cancel" &&
    action !== "client_resume"
  ) {
    return fail("invalid_action");
  }
  const planId = (body.planId ?? "").trim();
  // Admin actions always name a plan. A client either continues one of their own pending plans (planId) or
  // starts a new self-serve one (planType + projectId).
  if (action !== "client_checkout" && !planId) return fail("invalid_action");
  const when = (body.when ?? "now").trim();
  if (when !== "now" && when !== "period_end") return fail("invalid_action");

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
    .select("id, role, client_id")
    .eq("id", user.id)
    .maybeSingle();

  // A client choosing their own plan after launch. Only a client account, only for their own client record;
  // the launch rule, the price, and one-plan-per-project are all enforced server-side in
  // create_client_service_plan and the catalog below, never trusted from the browser.
  if (action === "client_checkout" || action === "client_cancel" || action === "client_resume") {
    if (!profile || profile.role !== "client" || !profile.client_id) return fail("not_allowed", 403);
    const stripeForClient = new Stripe(stripeSecret, { httpClient: Stripe.createFetchHttpClient() });
    const who = { userId: user.id, clientId: profile.client_id };
    try {
      if (action === "client_cancel") return await clientCancel(admin, stripeForClient, who, planId, json);
      if (action === "client_resume") return await clientResume(admin, stripeForClient, who, planId, json);
      return await clientCheckout(admin, stripeForClient, req, who, body, json);
    } catch (caught) {
      console.error("manage-service-plan client checkout failed", { message: caught instanceof Error ? caught.message : "" });
      return fail("server_error", 500);
    }
  }

  // Service plans commit the agency to an ongoing, auto-charging financial
  // relationship with a client. Unlike client-invitation (admin OR staff with
  // a per-client grant), keep creating checkouts for arbitrary plans and canceling admin-only for v1 -- not
  // staff-delegable.
  if (!profile || profile.role !== "admin") return fail("not_allowed", 403);

  const { data: plan } = await admin
    .from("service_plans")
    .select("id, client_id, project_id, plan_type, label, amount_cents, status, stripe_subscription_id, stripe_checkout_session_id, cancel_at")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return fail("not_found");

  const stripe = new Stripe(stripeSecret, { httpClient: Stripe.createFetchHttpClient() });

  try {
    if (action === "cancel") {
      return await cancelPlan(admin, stripe, plan, json, when);
    }
    if (action === "resume_cancel") {
      return await resumeScheduledCancel(admin, stripe, plan, json);
    }
    return await createCheckout(admin, stripe, req, plan, json);
  } catch (caught) {
    console.error("manage-service-plan failed", { action, message: caught instanceof Error ? caught.message : "" });
    return fail("server_error", 500);
  }
});

async function clientCheckout(
  admin: ServiceClient,
  stripe: Stripe,
  req: Request,
  who: { userId: string; clientId: string },
  body: RequestBody,
  json: JsonFn,
) {
  let planId = (body.planId ?? "").trim();

  if (planId) {
    // Continue a plan that is already waiting on checkout. It must be theirs; createCheckout only accepts pending.
    if (!isUuid(planId)) return json({ ok: false, error: "not_found" });
  } else {
    const planType = (body.planType ?? "").trim();
    const projectId = (body.projectId ?? "").trim();
    if (!isSelfServePlanType(planType)) return json({ ok: false, error: "invalid_plan_type" });
    if (!isUuid(projectId)) return json({ ok: false, error: "not_found" });
    // The catalog decides the price and the name. Nothing about the amount comes from the request.
    const entry = SELF_SERVE_PLANS[planType];
    const { data, error } = await admin.rpc("create_client_service_plan", {
      p_client_id: who.clientId,
      p_project_id: projectId,
      p_plan_type: planType,
      p_label: entry.label,
      p_amount_cents: entry.amountCents,
      p_created_by: who.userId,
    });
    if (error) {
      const code = clientPlanErrorCode(error.message);
      if (code === "server_error") console.error("manage-service-plan create_client_service_plan failed", error.message);
      return json({ ok: false, error: code }, code === "server_error" ? 500 : 200);
    }
    planId = String((data as { plan_id?: string } | null)?.plan_id ?? "");
    if (!isUuid(planId)) {
      console.error("manage-service-plan create_client_service_plan returned no plan id");
      return json({ ok: false, error: "server_error" }, 500);
    }
  }

  const { data: plan } = await admin
    .from("service_plans")
    .select("id, client_id, project_id, label, amount_cents, status, stripe_checkout_session_id")
    .eq("id", planId)
    .eq("client_id", who.clientId)
    .maybeSingle();
  if (!plan) return json({ ok: false, error: "not_found" });
  return await createCheckout(admin, stripe, req, plan, json);
}

type OwnPlan = {
  id: string;
  client_id: string;
  project_id: string | null;
  label: string;
  status: string;
  stripe_subscription_id: string | null;
  cancel_at: string | null;
};

async function loadOwnPlan(admin: ServiceClient, clientId: string, planId: string): Promise<OwnPlan | null> {
  if (!isUuid(planId)) return null;
  const { data } = await admin
    .from("service_plans")
    .select("id, client_id, project_id, label, status, stripe_subscription_id, cancel_at")
    .eq("id", planId)
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as OwnPlan | null) ?? null;
}

/**
 * Asks Stripe to end a subscription at the close of the period already paid for and records the end date it
 * reports. Returns that date (null only if Stripe gave none; the webhook fills it in afterwards).
 */
async function scheduleEndAtPeriodEnd(admin: ServiceClient, stripe: Stripe, subscriptionId: string, planId: string) {
  const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  const endsAt = scheduledCancelAt(updated as unknown as SubscriptionLike);
  if (!endsAt) {
    // Stripe accepted the cancellation but returned no end date to show. The webhook will fill it in when
    // customer.subscription.updated arrives; note it here so a persistent gap is easy to spot.
    console.warn("manage-service-plan: no end date on the updated subscription", { plan: planId });
  }
  await admin.rpc("set_service_plan_cancel_at", { p_stripe_subscription_id: subscriptionId, p_cancel_at: endsAt });
  return endsAt;
}

/**
 * A client canceling their own plan. An active plan is scheduled to end when the period they already paid for
 * runs out (they are not charged again and keep the service until then); a plan that is already past due has
 * nothing paid to run out, so it ends immediately. The plan's status is still only ever changed by the webhook.
 */
async function clientCancel(
  admin: ServiceClient,
  stripe: Stripe,
  who: { userId: string; clientId: string },
  planId: string,
  json: JsonFn,
) {
  const plan = await loadOwnPlan(admin, who.clientId, planId);
  if (!plan) return json({ ok: false, error: "not_found" });
  if ((plan.status !== "active" && plan.status !== "past_due") || !plan.stripe_subscription_id) {
    return json({ ok: false, error: "not_cancelable" });
  }

  if (plan.status === "past_due") {
    await stripe.subscriptions.cancel(plan.stripe_subscription_id);
    // The customer.subscription.deleted webhook marks it canceled and notifies everyone.
    return json({ ok: true, mode: "now", endsAt: null });
  }

  // Asking twice is harmless: report the end date that is already scheduled.
  if (plan.cancel_at) return json({ ok: true, mode: "period_end", endsAt: plan.cancel_at });

  const endsAt = await scheduleEndAtPeriodEnd(admin, stripe, plan.stripe_subscription_id, plan.id);
  await admin.rpc("notify_document", {
    p_audience: "admins",
    p_client_id: plan.client_id,
    p_type: "plan_canceled",
    p_title: "Client canceled a plan",
    p_body: `${plan.label} was canceled by the client and ends ${endsAt ? endsAt.slice(0, 10) : "at the end of the current period"}.`,
    p_project_id: plan.project_id,
  });
  return json({ ok: true, mode: "period_end", endsAt });
}

/** Undoing a scheduled cancellation before it takes effect. */
async function clientResume(
  admin: ServiceClient,
  stripe: Stripe,
  who: { userId: string; clientId: string },
  planId: string,
  json: JsonFn,
) {
  const plan = await loadOwnPlan(admin, who.clientId, planId);
  if (!plan) return json({ ok: false, error: "not_found" });
  if (plan.status !== "active" || !plan.stripe_subscription_id || !plan.cancel_at) {
    return json({ ok: false, error: "not_resumable" });
  }
  const updated = await stripe.subscriptions.update(plan.stripe_subscription_id, { cancel_at_period_end: false });
  await admin.rpc("set_service_plan_cancel_at", {
    p_stripe_subscription_id: plan.stripe_subscription_id,
    p_cancel_at: scheduledCancelAt(updated as unknown as SubscriptionLike),
  });
  return json({ ok: true });
}

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
    stripe_checkout_session_id: string | null;
  },
  json: JsonFn,
) {
  if (plan.status !== "pending") return json({ ok: false, error: "not_payable" });

  // A prior "Get checkout link" click may have left a still-open session on
  // this row. Without expiring it first, that older link stays live -- if a
  // client completes it after we've overwritten stripe_checkout_session_id
  // below, activate_service_plan() won't find a matching row (it matches on
  // the CURRENT session id) and the plan never activates in our database,
  // even though Stripe just started a real, charging subscription. Best
  // effort: Stripe returns an error for an already-completed/expired
  // session, which is fine to ignore here.
  if (plan.stripe_checkout_session_id) {
    try {
      await stripe.checkout.sessions.expire(plan.stripe_checkout_session_id);
    } catch {
      /* already completed or expired -- nothing to do */
    }
  }

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
  plan: { id: string; status: string; stripe_subscription_id: string | null; cancel_at: string | null },
  json: JsonFn,
  when: string,
) {
  if (plan.status !== "active" && plan.status !== "past_due") {
    return json({ ok: false, error: "not_cancelable" });
  }
  if (!plan.stripe_subscription_id) {
    return json({ ok: false, error: "not_cancelable" });
  }
  if (when === "period_end") {
    // End at the close of the period already paid for. A past-due plan has nothing paid to run out, so it can
    // only be canceled now. Asking twice reports the end date that is already scheduled.
    if (plan.status !== "active") return json({ ok: false, error: "not_cancelable" });
    if (plan.cancel_at) return json({ ok: true, mode: "period_end", endsAt: plan.cancel_at });
    try {
      const endsAt = await scheduleEndAtPeriodEnd(admin, stripe, plan.stripe_subscription_id, plan.id);
      return json({ ok: true, mode: "period_end", endsAt });
    } catch (caught) {
      console.error("manage-service-plan schedule end failed", caught instanceof Error ? caught.message : "");
      return json({ ok: false, error: "server_error" }, 500);
    }
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
  return json({ ok: true, mode: "now", endsAt: null });
}

/** An admin undoing a scheduled cancellation before it takes effect. */
async function resumeScheduledCancel(
  admin: ServiceClient,
  stripe: Stripe,
  plan: { id: string; status: string; stripe_subscription_id: string | null; cancel_at: string | null },
  json: JsonFn,
) {
  if (plan.status !== "active" || !plan.stripe_subscription_id || !plan.cancel_at) {
    return json({ ok: false, error: "not_resumable" });
  }
  const updated = await stripe.subscriptions.update(plan.stripe_subscription_id, { cancel_at_period_end: false });
  await admin.rpc("set_service_plan_cancel_at", {
    p_stripe_subscription_id: plan.stripe_subscription_id,
    p_cancel_at: scheduledCancelAt(updated as unknown as SubscriptionLike),
  });
  return json({ ok: true });
}
