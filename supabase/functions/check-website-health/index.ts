import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersForRequest } from "../_shared/cors.ts";
import { validateProductionUrl } from "../_shared/websiteUrl.ts";

// Website Health Monitoring v1 (manual "Check Now") + v2 (this file):
// scheduled/automated checks. Checks exactly one URL per call in v1's
// single-project mode: the production_url already stored on an authorized
// project row. The request body never carries a URL -- only a projectId --
// so this can't be used as an arbitrary URL-fetch endpoint. See
// 20260928000000_website_health_monitoring.sql for the table this writes to
// and the RLS around it, and 20261012000000_scheduled_uptime_monitoring.sql
// for the pg_cron job that calls this in batch (sweep) mode.
//
// Classification (documented once, here, since it's the single source of
// truth the UI and history both read):
//   - 2xx/3xx response  -> healthy
//   - 4xx/5xx response  -> degraded (the site is reachable; the response itself
//     is the problem -- a single 5xx is not escalated to "down" in v1, since
//     that would require correlating multiple checks over time, which is
//     deliberately out of scope for v1's per-check classification)
//   - timeout, DNS failure, connection refused, TLS failure, too-many-redirects
//     -> down (no HTTP response was ever received)
//
// Two callers:
//   - A real staff session (Authorization: Bearer <user JWT>) -- the existing
//     manual "Check Now" button. Requires staff_may_project(projectId, 'projects.manage'),
//     checks exactly the named project/environment, and records checked_by.
//   - The service role key (Authorization: Bearer <service role key>, matched by exact
//     string equality, same pattern as document-email's cron/webhook callers) with no
//     projectId -- the scheduled sweep. Checks every launched project's production_url
//     and leaves checked_by null (see that column's comment: "Null once/if scheduled
//     automated checks are added later").
// A state change into or out of "down" is alerted by a database trigger on
// website_health_checks (website_health_checks_notify_state_change), not here -- that
// way a manual Check Now and a scheduled sweep both alert the same way, from one place.

const TIMEOUT_MS = 10_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Cap on how many launched projects one scheduled sweep checks -- keeps a single Edge Function
 * invocation well within its execution time limit. Any project past this on a given tick is
 * picked up on the next one (every 15 minutes; see the cron schedule). */
const SWEEP_LIMIT = 50;

type RequestBody = { projectId?: string; environment?: string };
type CheckStatus = "healthy" | "degraded" | "down";
type CheckEnvironment = "production" | "staging";

type CheckResult = {
  status: CheckStatus;
  httpStatus: number | null;
  responseTimeMs: number | null;
  errorMessage: string;
};

async function runCheck(url: URL): Promise<CheckResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "MotiveScripts-WebsiteHealth/1.0" },
    });
    const responseTimeMs = Date.now() - started;
    void response.body?.cancel();
    if (response.status >= 400) {
      return {
        status: "degraded",
        httpStatus: response.status,
        responseTimeMs,
        errorMessage: `HTTP ${response.status}`,
      };
    }
    return { status: "healthy", httpStatus: response.status, responseTimeMs, errorMessage: "" };
  } catch (caught) {
    const responseTimeMs = Date.now() - started;
    if (caught instanceof DOMException && caught.name === "AbortError") {
      return { status: "down", httpStatus: null, responseTimeMs, errorMessage: "Connection timed out" };
    }
    const message = caught instanceof Error ? caught.message : "Unable to connect";
    return { status: "down", httpStatus: null, responseTimeMs, errorMessage: message.slice(0, 300) || "Unable to connect" };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  const cors = corsHeadersForRequest(req);
  const json = (body: Record<string, unknown>, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const fail = (error: string, status = 200): Response => json({ ok: false, error }, status);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("invalid_action", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("check-website-health missing supabase env");
    return fail("server_error", 500);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return fail("invalid_action");
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const isServiceRole = token.length > 0 && token === serviceKey;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const projectId = (body.projectId ?? "").trim();
  const environment: CheckEnvironment = body.environment === "staging" ? "staging" : "production";

  // The scheduled sweep: service role, no projectId -- check every launched project's
  // production_url. See 20261012000000_scheduled_uptime_monitoring.sql for the cron job.
  if (isServiceRole && !projectId) {
    return await runScheduledSweep(admin, json);
  }

  if (!UUID_RE.test(projectId)) return fail("invalid_project");

  let checkedBy: string | null = null;
  if (!isServiceRole) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return fail("not_allowed", 401);

    // Reuses the same SQL permission function RLS itself is built on, run as
    // the calling user -- not a re-implementation of the permission logic.
    const { data: allowed, error: permError } = await userClient.rpc("staff_may_project", {
      p_project_id: projectId,
      p_perm: "projects.manage",
    });
    if (permError || !allowed) return fail("not_allowed", 403);
    checkedBy = user.id;
  }

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("production_url, staging_url")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) {
    console.error("check-website-health project lookup failed", projectError.message);
    return fail("server_error", 500);
  }
  if (!project) return fail("not_found", 404);

  const targetUrl = environment === "staging" ? project.staging_url : project.production_url;
  const url = validateProductionUrl(targetUrl);
  if (!url) return fail(environment === "staging" ? "no_staging_url" : "no_production_url");

  const result = await runCheck(url);

  const { data: inserted, error: insertError } = await admin
    .from("website_health_checks")
    .insert({
      project_id: projectId,
      environment,
      status: result.status,
      http_status: result.httpStatus,
      response_time_ms: result.responseTimeMs,
      error_message: result.errorMessage,
      checked_by: checkedBy,
    })
    .select("id, checked_at")
    .single();
  if (insertError) {
    console.error("check-website-health insert failed", insertError.message);
    return fail("server_error", 500);
  }

  return json({
    ok: true,
    check: {
      id: inserted.id,
      checkedAt: inserted.checked_at,
      environment,
      status: result.status,
      httpStatus: result.httpStatus,
      responseTimeMs: result.responseTimeMs,
      errorMessage: result.errorMessage,
    },
  });
});

/**
 * Checks every launched project's production_url (deployment_status = 'Production', a non-null
 * production_url), concurrently, up to SWEEP_LIMIT per invocation. Always production, never staging
 * -- staging is dev-facing and doesn't need automated alerting. Each check is inserted with
 * checked_by null; website_health_checks_notify_state_change handles alerting on a state change.
 */
async function runScheduledSweep(
  admin: SupabaseClient,
  json: (body: Record<string, unknown>, status?: number) => Response,
): Promise<Response> {
  const { data: launched, error: launchedError } = await admin
    .from("project_development")
    .select("project_id")
    .eq("deployment_status", "Production")
    .limit(SWEEP_LIMIT);
  if (launchedError) {
    console.error("check-website-health sweep: launched lookup failed", launchedError.message);
    return json({ ok: false, error: "server_error" }, 500);
  }
  const projectIds = (launched ?? []).map((row) => row.project_id as string);
  if (projectIds.length === 0) return json({ ok: true, checked: 0 });

  const { data: projects, error: projectsError } = await admin
    .from("projects")
    .select("id, production_url")
    .in("id", projectIds)
    .not("production_url", "is", null);
  if (projectsError) {
    console.error("check-website-health sweep: projects lookup failed", projectsError.message);
    return json({ ok: false, error: "server_error" }, 500);
  }

  const outcomes = await Promise.all(
    (projects ?? []).map(async (project) => {
      const url = validateProductionUrl(project.production_url as string | null);
      if (!url) return false;
      const result = await runCheck(url);
      const { error: insertError } = await admin.from("website_health_checks").insert({
        project_id: project.id,
        environment: "production",
        status: result.status,
        http_status: result.httpStatus,
        response_time_ms: result.responseTimeMs,
        error_message: result.errorMessage,
        checked_by: null,
      });
      if (insertError) {
        console.error("check-website-health sweep: insert failed", project.id, insertError.message);
        return false;
      }
      return true;
    }),
  );

  return json({ ok: true, checked: outcomes.filter(Boolean).length, candidates: outcomes.length });
}
