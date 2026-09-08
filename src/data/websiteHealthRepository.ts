import { isWebsiteHealthCheckStatus, type WebsiteHealthCheck } from "@/data/websiteHealth";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database, WebsiteHealthCheckRow } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

function db(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  throw new AgencyDbError(friendlyDbError(error, fallback), error);
}

function mapCheck(row: WebsiteHealthCheckRow): WebsiteHealthCheck {
  return {
    id: row.id,
    checkedAt: row.checked_at,
    status: isWebsiteHealthCheckStatus(row.status) ? row.status : "down",
    httpStatus: row.http_status,
    responseTimeMs: row.response_time_ms,
    errorMessage: row.error_message ?? "",
  };
}

const HISTORY_LIMIT = 8;

/** Most recent checks first. Empty array means no check has ever completed. */
export async function fetchWebsiteHealthHistory(projectId: string): Promise<WebsiteHealthCheck[]> {
  const client = db();
  const { data, error } = await client
    .from("website_health_checks")
    .select("*")
    .eq("project_id", projectId)
    .order("checked_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) fail("load website health", error, "Unable to load website health.");
  return (data ?? []).map(mapCheck);
}

async function functionErrorCode(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object" || !("context" in error)) return null;
  const context = (error as { context?: unknown }).context;
  if (!context || typeof context !== "object" || !("json" in context)) return null;
  const jsonFn = (context as { json?: unknown }).json;
  if (typeof jsonFn !== "function") return null;
  try {
    const body = (await jsonFn.call(context)) as { error?: string };
    return typeof body?.error === "string" && body.error ? body.error : null;
  } catch {
    return null;
  }
}

const CHECK_NOW_ERRORS: Record<string, string> = {
  not_allowed: "You don't have access to check this project's website.",
  not_found: "Project not found.",
  no_production_url: "No production URL is configured for this project yet.",
  invalid_project: "Unable to check this project's website.",
  server_error: "Unable to check the website right now. Try again shortly.",
};

function checkNowErrorMessage(code: string | null): string {
  return CHECK_NOW_ERRORS[code ?? ""] ?? CHECK_NOW_ERRORS.server_error;
}

type CheckNowPayload = {
  id: string;
  checkedAt: string;
  status: string;
  httpStatus: number | null;
  responseTimeMs: number | null;
  errorMessage: string;
};

/** Triggers a real-time server-side check of the project's stored production_url. */
export async function checkWebsiteHealthNow(projectId: string): Promise<WebsiteHealthCheck> {
  const client = db();
  const { data, error } = await client.functions.invoke("check-website-health", {
    body: { projectId },
  });
  if (error) {
    const code = await functionErrorCode(error);
    throw new AgencyDbError(checkNowErrorMessage(code), error);
  }
  const payload = data as { ok?: boolean; check?: CheckNowPayload; error?: string } | null;
  if (!payload?.ok || !payload.check) {
    throw new AgencyDbError(checkNowErrorMessage(payload?.error ?? null));
  }
  const check = payload.check;
  return {
    id: check.id,
    checkedAt: check.checkedAt,
    status: isWebsiteHealthCheckStatus(check.status) ? check.status : "down",
    httpStatus: check.httpStatus,
    responseTimeMs: check.responseTimeMs,
    errorMessage: check.errorMessage ?? "",
  };
}
