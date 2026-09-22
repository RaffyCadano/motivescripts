import {
  servicePlanErrorCode,
  servicePlanErrorMessage,
  type DomainAvailability,
  type ServicePlan,
} from "@/data/servicePlans";
import { AgencyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { ServicePlanRow } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function db(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new AgencyDbError("Supabase is not configured.");
  }
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

function fail(context: string, error: unknown): never {
  logDbError(context, error);
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  throw new AgencyDbError(servicePlanErrorMessage(servicePlanErrorCode(message)), error);
}

async function functionErrorCode(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object" || !("context" in error)) return null;
  const context = (error as { context?: unknown }).context;
  if (!context || typeof context !== "object" || !("json" in context)) return null;
  const json = (context as { json?: unknown }).json;
  if (typeof json !== "function") return null;
  try {
    const body = (await json.call(context)) as { error?: string };
    return typeof body?.error === "string" && body.error ? body.error : null;
  } catch {
    return null;
  }
}

function mapServicePlan(row: ServicePlanRow): ServicePlan {
  return {
    id: row.id,
    clientId: row.client_id,
    projectId: row.project_id,
    planType: row.plan_type,
    label: row.label,
    amountCents: Number(row.amount_cents),
    status: row.status,
    domain: row.domain,
    domainExpiresAt: row.domain_expires_at,
    sslExpiresAt: row.ssl_expires_at,
    createdAt: row.created_at,
    canceledAt: row.canceled_at,
    cancelAt: row.cancel_at ?? null,
    includedHoursMonthly: Number(row.included_hours_monthly ?? 0),
    planTemplateId: row.plan_template_id ?? null,
    pausedAt: row.paused_at ?? null,
  };
}

/** Admin: plans for one client. Client portal: pass no clientId -- RLS narrows to the caller's own plans. */
export async function listServicePlans(clientId?: string): Promise<ServicePlan[]> {
  const client = db();
  let query = client.from("service_plans").select("*").order("created_at", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) fail("load service plans", error);
  return (data ?? []).map((row) => mapServicePlan(row as ServicePlanRow));
}

export async function createServicePlan(input: {
  clientId: string;
  projectId: string | null;
  planType: string;
  label: string;
  amountCents: number;
}): Promise<string> {
  const client = db();
  const { data, error } = await client.rpc("create_service_plan", {
    p_client_id: input.clientId,
    p_project_id: input.projectId,
    p_plan_type: input.planType,
    p_label: input.label,
    p_amount_cents: input.amountCents,
  });
  if (error) fail("create service plan", error);
  return data as string;
}

/** Admin: assign a Website Care plan template to a client, copying its current terms onto a new plan row. */
export async function createServicePlanFromTemplate(input: {
  clientId: string;
  projectId: string | null;
  templateId: string;
}): Promise<string> {
  const client = db();
  const { data, error } = await client.rpc("create_service_plan_from_template", {
    p_client_id: input.clientId,
    p_project_id: input.projectId,
    p_template_id: input.templateId,
  });
  if (error) fail("create service plan from template", error);
  return data as string;
}

export async function createServicePlanCheckoutUrl(planId: string): Promise<string> {
  return checkoutUrlFrom({ action: "create_checkout", planId });
}

/**
 * A client starting checkout for a plan themselves, from the portal. Either a new self-serve plan
 * (planType + the project it is for -- for "care", also templateId naming which tier) or continuing
 * one that is still waiting on checkout (planId). The server decides the price and whether the
 * website has launched; nothing about either comes from here.
 */
export async function startClientPlanCheckout(
  input: { planType: string; projectId: string; templateId?: string } | { planId: string },
): Promise<string> {
  return checkoutUrlFrom({ action: "client_checkout", ...input });
}

async function checkoutUrlFrom(body: Record<string, string>): Promise<string> {
  const client = db();
  const { data, error } = await client.functions.invoke("manage-service-plan", { body });
  if (error) {
    const code = await functionErrorCode(error);
    if (code) throw new AgencyDbError(servicePlanErrorMessage(code), error);
    const message = (error.message ?? "").toLowerCase();
    if (message.includes("failed to fetch") || message.includes("network")) {
      throw new AgencyDbError(servicePlanErrorMessage("network"), error);
    }
    throw new AgencyDbError(servicePlanErrorMessage("not_payable"), error);
  }
  const payload = data as { ok?: boolean; url?: string; error?: string } | null;
  if (!payload?.ok || !payload.url) {
    throw new AgencyDbError(servicePlanErrorMessage(payload?.error ?? "not_payable"));
  }
  if (!payload.url.startsWith("https://")) {
    throw new AgencyDbError(servicePlanErrorMessage("not_payable"));
  }
  return payload.url;
}

export async function setServicePlanDomain(
  planId: string,
  domain: string,
  renewals?: { domainExpiresAt?: string | null; sslExpiresAt?: string | null },
): Promise<void> {
  const client = db();
  const { error } = await client.rpc("set_service_plan_domain", {
    p_plan_id: planId,
    p_domain: domain,
    p_domain_expires_at: renewals?.domainExpiresAt || null,
    p_ssl_expires_at: renewals?.sslExpiresAt || null,
  });
  if (error) fail("set plan domain", error);
}

export async function checkDomainAvailability(domain: string): Promise<DomainAvailability> {
  const client = db();
  const { data, error } = await client.functions.invoke("check-domain-availability", {
    body: { domain },
  });
  if (error) {
    const code = await functionErrorCode(error);
    if (code) throw new AgencyDbError(servicePlanErrorMessage(code), error);
    throw new AgencyDbError(servicePlanErrorMessage("error"), error);
  }
  const payload = data as { ok?: boolean; status?: DomainAvailability; error?: string } | null;
  if (!payload?.ok || !payload.status) {
    throw new AgencyDbError(servicePlanErrorMessage(payload?.error ?? "invalid_domain"));
  }
  return payload.status;
}

async function invokeManage(body: Record<string, string>, fallbackCode: string): Promise<Record<string, unknown>> {
  const client = db();
  const { data, error } = await client.functions.invoke("manage-service-plan", { body });
  if (error) {
    const code = await functionErrorCode(error);
    if (code) throw new AgencyDbError(servicePlanErrorMessage(code), error);
    const message = (error.message ?? "").toLowerCase();
    if (message.includes("failed to fetch") || message.includes("network")) {
      throw new AgencyDbError(servicePlanErrorMessage("network"), error);
    }
    throw new AgencyDbError(servicePlanErrorMessage(fallbackCode), error);
  }
  const payload = (data ?? {}) as { ok?: boolean; error?: string };
  if (!payload.ok) throw new AgencyDbError(servicePlanErrorMessage(payload.error ?? fallbackCode));
  return payload as Record<string, unknown>;
}

export type ClientCancelResult = {
  /** period_end: the plan runs until the end of the period already paid for. now: it ended immediately. */
  mode: "period_end" | "now";
  endsAt: string | null;
};

/** A client canceling their own plan from the portal. The server decides when it takes effect. */
export async function cancelMyServicePlan(planId: string): Promise<ClientCancelResult> {
  const payload = await invokeManage({ action: "client_cancel", planId }, "not_cancelable");
  return {
    mode: payload.mode === "now" ? "now" : "period_end",
    endsAt: typeof payload.endsAt === "string" ? payload.endsAt : null,
  };
}

/** Undoing a scheduled cancellation before it takes effect. */
export async function resumeMyServicePlan(planId: string): Promise<void> {
  await invokeManage({ action: "client_resume", planId }, "not_resumable");
}

/**
 * Admin: cancel a client's plan. "period_end" ends it at the close of the period already paid for (the client
 * keeps the service until then); "now" stops billing immediately and cannot be undone.
 */
export async function cancelServicePlan(planId: string, when: "now" | "period_end" = "now"): Promise<ClientCancelResult> {
  const payload = await invokeManage({ action: "cancel", planId, when }, "not_cancelable");
  return {
    mode: payload.mode === "period_end" ? "period_end" : "now",
    endsAt: typeof payload.endsAt === "string" ? payload.endsAt : null,
  };
}

/** Admin: undo a scheduled cancellation before it takes effect. */
export async function undoServicePlanCancellation(planId: string): Promise<void> {
  await invokeManage({ action: "resume_cancel", planId }, "not_resumable");
}

/** Admin: pause an active plan. Suspends Stripe billing collection (nothing is charged while paused) without canceling the subscription. */
export async function pauseServicePlan(planId: string): Promise<void> {
  await invokeManage({ action: "pause", planId }, "not_pausable");
}

/** Admin: resume a paused plan at the same terms. */
export async function resumeServicePlan(planId: string): Promise<void> {
  await invokeManage({ action: "unpause", planId }, "not_unpausable");
}

export type ServicePlanUsage = {
  includedHoursMonthly: number;
  usedHours: number;
  remainingHours: number;
  periodStart: string;
  periodEnd: string;
};

/** Included-hours usage for a Website Care plan this billing period. Client and staff alike (the RPC checks ownership itself). */
export async function fetchServicePlanUsage(planId: string): Promise<ServicePlanUsage | null> {
  const client = db();
  const { data, error } = await client.rpc("service_plan_usage", { p_plan_id: planId });
  if (error) fail("load plan usage", error);
  const row = (data ?? [])[0] as
    | { included_hours_monthly?: number; used_hours?: number; remaining_hours?: number; period_start?: string; period_end?: string }
    | undefined;
  if (!row?.period_start || !row.period_end) return null;
  return {
    includedHoursMonthly: Number(row.included_hours_monthly ?? 0),
    usedHours: Number(row.used_hours ?? 0),
    remainingHours: Number(row.remaining_hours ?? 0),
    periodStart: row.period_start,
    periodEnd: row.period_end,
  };
}

/** Admin: fetch a plan's current (or most recent) Stripe billing period, for included-hours usage. */
export async function fetchServicePlanCurrentPeriod(
  planId: string,
): Promise<{ periodStart: string; periodEnd: string } | null> {
  const client = db();
  const { data, error } = await client.rpc("service_plan_current_period", { p_plan_id: planId });
  if (error) fail("load plan billing period", error);
  const row = (data ?? [])[0] as { period_start?: string; period_end?: string } | undefined;
  if (!row?.period_start || !row.period_end) return null;
  return { periodStart: row.period_start, periodEnd: row.period_end };
}
