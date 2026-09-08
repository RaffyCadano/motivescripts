import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersForRequest } from "../_shared/cors.ts";
import { validateProductionUrl } from "../_shared/websiteUrl.ts";

// Website Health Monitoring v1. Checks exactly one URL per call: the
// production_url already stored on an authorized project row. The request
// body never carries a URL -- only a projectId -- so this can't be used as an
// arbitrary URL-fetch endpoint. See 20260928000000_website_health_monitoring.sql
// for the table this writes to and the RLS around it.
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
// Automated/scheduled checks are not implemented here -- see the migration
// comment and the final report for why (no pg_net/HTTP-capable scheduler is
// configured in this project yet). This function plus the manual "Check Now"
// action are v1's complete mechanism; scheduling can call this same function
// later without changing the data model.

const TIMEOUT_MS = 10_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RequestBody = { projectId?: string };
type CheckStatus = "healthy" | "degraded" | "down";

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
  const projectId = (body.projectId ?? "").trim();
  if (!UUID_RE.test(projectId)) return fail("invalid_project");

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

  // Reuses the same SQL permission function RLS itself is built on, run as
  // the calling user -- not a re-implementation of the permission logic.
  const { data: allowed, error: permError } = await userClient.rpc("staff_may_project", {
    p_project_id: projectId,
    p_perm: "projects.manage",
  });
  if (permError || !allowed) return fail("not_allowed", 403);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("production_url")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) {
    console.error("check-website-health project lookup failed", projectError.message);
    return fail("server_error", 500);
  }
  if (!project) return fail("not_found", 404);

  const url = validateProductionUrl(project.production_url);
  if (!url) return fail("no_production_url");

  const result = await runCheck(url);

  const { data: inserted, error: insertError } = await admin
    .from("website_health_checks")
    .insert({
      project_id: projectId,
      status: result.status,
      http_status: result.httpStatus,
      response_time_ms: result.responseTimeMs,
      error_message: result.errorMessage,
      checked_by: user.id,
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
      status: result.status,
      httpStatus: result.httpStatus,
      responseTimeMs: result.responseTimeMs,
      errorMessage: result.errorMessage,
    },
  });
});
