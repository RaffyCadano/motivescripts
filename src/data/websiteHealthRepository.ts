import {
  isWebsiteHealthCheckStatus,
  isWebsiteHealthEnvironment,
  type WebsiteHealthCheck,
  type WebsiteHealthEnvironment,
} from "@/data/websiteHealth";
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
    environment: isWebsiteHealthEnvironment(row.environment) ? row.environment : "production",
    status: isWebsiteHealthCheckStatus(row.status) ? row.status : "down",
    httpStatus: row.http_status,
    responseTimeMs: row.response_time_ms,
    errorMessage: row.error_message ?? "",
  };
}

const HISTORY_LIMIT = 8;

/** Most recent checks first for one environment. Empty array means no check has ever completed. */
export async function fetchWebsiteHealthHistory(
  projectId: string,
  environment: WebsiteHealthEnvironment = "production",
): Promise<WebsiteHealthCheck[]> {
  const client = db();
  const { data, error } = await client
    .from("website_health_checks")
    .select("*")
    .eq("project_id", projectId)
    .eq("environment", environment)
    .order("checked_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) fail("load website health", error, "Unable to load website health.");
  return (data ?? []).map(mapCheck);
}

/**
 * One batched query for a dashboard-style summary across several projects,
 * instead of one fetchWebsiteHealthHistory call per project. Returns only
 * the single most recent production check per project.
 *
 * Uses the latest_website_health_checks RPC (a real per-project DISTINCT ON
 * in the database) rather than a flat "N most recent rows overall" query --
 * that approach could let a frequently-checked project's rows fill the
 * whole limited window and silently drop a less-frequently-checked
 * project's only recent row from the result.
 */
export async function fetchLatestWebsiteHealthByProject(
  projectIds: string[],
): Promise<Map<string, WebsiteHealthCheck>> {
  const result = new Map<string, WebsiteHealthCheck>();
  if (projectIds.length === 0) return result;
  const client = db();
  const { data, error } = await client.rpc("latest_website_health_checks", {
    p_project_ids: projectIds,
    p_environment: "production",
  });
  if (error) fail("load website health", error, "Unable to load website health.");
  for (const row of (data ?? []) as WebsiteHealthCheckRow[]) {
    result.set(row.project_id, mapCheck(row));
  }
  return result;
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
  no_staging_url: "No staging URL is configured for this project yet.",
  invalid_project: "Unable to check this project's website.",
  server_error: "Unable to check the website right now. Try again shortly.",
};

function checkNowErrorMessage(code: string | null): string {
  return CHECK_NOW_ERRORS[code ?? ""] ?? CHECK_NOW_ERRORS.server_error;
}

type CheckNowPayload = {
  id: string;
  checkedAt: string;
  environment?: string;
  status: string;
  httpStatus: number | null;
  responseTimeMs: number | null;
  errorMessage: string;
};

/** Triggers a real-time server-side check of the project's stored production or staging URL. */
export async function checkWebsiteHealthNow(
  projectId: string,
  environment: WebsiteHealthEnvironment = "production",
): Promise<WebsiteHealthCheck> {
  const client = db();
  const { data, error } = await client.functions.invoke("check-website-health", {
    body: { projectId, environment },
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
    environment: isWebsiteHealthEnvironment(check.environment ?? "") ? (check.environment as WebsiteHealthEnvironment) : environment,
    status: isWebsiteHealthCheckStatus(check.status) ? check.status : "down",
    httpStatus: check.httpStatus,
    responseTimeMs: check.responseTimeMs,
    errorMessage: check.errorMessage ?? "",
  };
}
