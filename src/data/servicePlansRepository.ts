import { servicePlanErrorCode, servicePlanErrorMessage, type ServicePlan } from "@/data/servicePlans";
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
    createdAt: row.created_at,
    canceledAt: row.canceled_at,
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

export async function createServicePlanCheckoutUrl(planId: string): Promise<string> {
  const client = db();
  const { data, error } = await client.functions.invoke("manage-service-plan", {
    body: { action: "create_checkout", planId },
  });
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

export async function cancelServicePlan(planId: string): Promise<void> {
  const client = db();
  const { data, error } = await client.functions.invoke("manage-service-plan", {
    body: { action: "cancel", planId },
  });
  if (error) {
    const code = await functionErrorCode(error);
    if (code) throw new AgencyDbError(servicePlanErrorMessage(code), error);
    throw new AgencyDbError(servicePlanErrorMessage("not_cancelable"), error);
  }
  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) {
    throw new AgencyDbError(servicePlanErrorMessage(payload?.error ?? "not_cancelable"));
  }
}
