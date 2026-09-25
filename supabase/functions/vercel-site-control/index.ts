import { createClient } from "npm:@supabase/supabase-js@2";
import { controlVercelProject, type SiteAction } from "../_shared/vercelSite.ts";

/**
 * Pauses or unpauses a project's site on Vercel. Called only by the database (run_launch_trial_sweep,
 * unpause_website, the plan trigger, retry_host_site_control) through request_host_site_control(), with the
 * service role key: there is no browser or user caller. It does nothing for a project that has not been
 * opted in (auto_pause_on_vercel) or has no Vercel project, records what happened on the project row
 * (host_paused_at / host_pause_error) and alerts staff if Vercel refused, so a failure is never silent.
 *
 * Needs the VERCEL_API_TOKEN secret; without it every call records "not set" and alerts staff, and nothing
 * else in the system is affected.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "invalid_action" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    console.error("vercel-site-control missing supabase env");
    return json({ ok: false, error: "server_error" }, 500);
  }
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== serviceKey) return json({ ok: false, error: "not_allowed" }, 403);

  let body: { projectId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_action" }, 400);
  }
  const projectId = (body.projectId ?? "").trim();
  const action = body.action as SiteAction;
  if (!UUID.test(projectId) || (action !== "pause" && action !== "unpause")) {
    return json({ ok: false, error: "invalid_action" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: dev } = await admin
    .from("project_development")
    .select("vercel_project_id, vercel_team_id, auto_pause_on_vercel")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!dev || !dev.auto_pause_on_vercel || !dev.vercel_project_id) return json({ ok: false, error: "not_enabled" });

  const result = await controlVercelProject({
    token: Deno.env.get("VERCEL_API_TOKEN"),
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
