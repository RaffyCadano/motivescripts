import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersForRequest } from "../_shared/cors.ts";
import { controlVercelProject, lookupVercelProject, type SiteAction } from "../_shared/vercelSite.ts";

/**
 * Talks to Vercel about a project's site. Two callers, two doors:
 *
 *  1. The DATABASE (run_launch_trial_sweep, pause_website, unpause_website, the plan trigger,
 *     retry_host_site_control, through request_host_site_control()), authenticated with the service role
 *     key, sends { projectId, action: "pause" | "unpause" }. It does nothing for a project that has not been
 *     opted in (auto_pause_on_vercel) or has no Vercel project, records what happened on the project row
 *     (host_paused_at / host_pause_error) and alerts staff if Vercel refused, so a failure is never silent.
 *
 *  2. The ADMIN "Check Vercel connection" button, authenticated with the admin's own session, sends
 *     { projectId, action: "check", vercelProjectId, vercelTeamId } and only ever performs a read-only
 *     lookup of that project on Vercel. It changes nothing, on Vercel or in the database, and needs the
 *     projects.manage permission on that project.
 *
 * Needs the VERCEL_API_TOKEN secret; without it every call says so and nothing else is affected.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const cors = corsHeadersForRequest(req);
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "invalid_action" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("vercel-site-control missing supabase env");
    return json({ ok: false, error: "server_error" }, 500);
  }
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ ok: false, error: "not_allowed" }, 403);

  let body: { projectId?: string; action?: string; vercelProjectId?: string; vercelTeamId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_action" }, 400);
  }
  const projectId = (body.projectId ?? "").trim();
  if (!UUID.test(projectId)) return json({ ok: false, error: "invalid_action" }, 400);
  const vercelToken = Deno.env.get("VERCEL_API_TOKEN");

  // ---- Door 2: an admin's read-only connection check
  if (token !== serviceKey) {
    if (body.action !== "check") return json({ ok: false, error: "not_allowed" }, 403);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ ok: false, error: "not_allowed" }, 401);
    const { data: allowed } = await userClient.rpc("staff_may_project", { p_project_id: projectId, p_perm: "projects.manage" });
    if (allowed !== true) return json({ ok: false, error: "not_allowed" }, 403);

    const name = (body.vercelProjectId ?? "").trim();
    const team = (body.vercelTeamId ?? "").trim() || null;
    if (!name) return json({ ok: false, message: "Enter the Vercel project name first." });
    const found = await lookupVercelProject({ token: vercelToken, projectIdOrName: name, teamId: team });
    if (!found.ok) return json({ ok: false, message: found.message });
    return json({
      ok: true,
      message: `Connected: found the Vercel project “${found.project.name}”${
        found.project.paused === null ? "" : found.project.paused ? ", currently paused" : ", currently live"
      }.`,
      project: found.project,
    });
  }

  // ---- Door 1: the database asks for a pause / unpause
  const action = body.action as SiteAction;
  if (action !== "pause" && action !== "unpause") return json({ ok: false, error: "invalid_action" }, 400);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: dev } = await admin
    .from("project_development")
    .select("vercel_project_id, vercel_team_id, auto_pause_on_vercel")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!dev || !dev.auto_pause_on_vercel || !dev.vercel_project_id) return json({ ok: false, error: "not_enabled" });

  const result = await controlVercelProject({
    token: vercelToken,
    action,
    projectId: dev.vercel_project_id as string,
    teamId: (dev.vercel_team_id as string | null) ?? null,
  });

  await admin
    .from("project_development")
    .update(
      result.ok
        ? { host_paused_at: action === "pause" ? new Date().toISOString() : null, host_pause_error: null }
        : { host_pause_error: result.message },
    )
    .eq("project_id", projectId);

  if (!result.ok) {
    const { data: project } = await admin.from("projects").select("name, client_id").eq("id", projectId).maybeSingle();
    await admin.rpc("notify_agency", {
      p_perm: "projects.manage",
      p_client_id: project?.client_id ?? null,
      p_type: "host_pause_failed",
      p_title: `Automatic ${action} on Vercel failed: ${project?.name ?? "a project"}`,
      p_body: `${result.message} Do it by hand at the host, or press Retry on the project.`,
      p_project_id: projectId,
    });
  }

  console.log("vercel-site-control", { action, project_id: projectId, ok: result.ok });
  return json({ ok: result.ok });
});
