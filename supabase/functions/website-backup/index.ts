import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersForRequest } from "../_shared/cors.ts";
import { validateProductionUrl } from "../_shared/websiteUrl.ts";

// Real automated backups for Website Care (see 20261020000000_automated_website_backups.sql for
// the full reasoning on scope): captures the production site's live HTML once a day and stores it
// in the project-files bucket, so there is a recent, downloadable snapshot if a client's site
// breaks or their host loses data. Not a database/filesystem backup and not one-click restore --
// hosting is external, MotiveScripts never provisions it (see "set up hosting" in
// productionTaskInstructions.ts), so a raw content snapshot is what's honestly buildable here.
//
// Same two-caller shape as check-website-health:
//   - A real staff session (Authorization: Bearer <user JWT>) -- manual "Back up now", requires
//     staff_may_project(projectId, 'projects.manage'), backs up exactly the named project.
//   - The service role key, no projectId -- the scheduled daily sweep, over every Care-plan
//     project due (projects_due_for_website_backup).

const TIMEOUT_MS = 15_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Cap on how many due projects one scheduled sweep backs up -- keeps a single invocation well
 * within its execution time limit; anything past this today is picked up on tomorrow's run. */
const SWEEP_LIMIT = 30;
/** A marketing/business site's HTML is normally well under this; anything larger is refused rather
 * than storing an unbounded (or malformed/streaming) response. */
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
const BUCKET = "project-files";

type RequestBody = { projectId?: string };
type BackupOutcome = { status: "ok"; storagePath: string; byteSize: number } | { status: "failed"; errorMessage: string };

function backupStoragePath(projectId: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `projects/${projectId}/website-backups/${stamp}.html`;
}

async function captureSnapshot(admin: SupabaseClient, projectId: string, targetUrl: URL): Promise<BackupOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "MotiveScripts-WebsiteBackup/1.0" },
    });
    if (!response.ok) {
      void response.body?.cancel();
      return { status: "failed", errorMessage: `HTTP ${response.status}` };
    }
    const html = await response.text();
    const byteSize = new TextEncoder().encode(html).length;
    if (byteSize === 0) {
      return { status: "failed", errorMessage: "Received an empty response." };
    }
    if (byteSize > MAX_SNAPSHOT_BYTES) {
      return { status: "failed", errorMessage: `Page is too large to back up (${byteSize} bytes).` };
    }

    const path = backupStoragePath(projectId);
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, html, {
      contentType: "text/html; charset=utf-8",
      upsert: false,
    });
    if (uploadError) {
      return { status: "failed", errorMessage: `Storage upload failed: ${uploadError.message}`.slice(0, 500) };
    }
    return { status: "ok", storagePath: path, byteSize };
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") {
      return { status: "failed", errorMessage: "Connection timed out" };
    }
    const message = caught instanceof Error ? caught.message : "Unable to connect";
    return { status: "failed", errorMessage: message.slice(0, 300) || "Unable to connect" };
  } finally {
    clearTimeout(timer);
  }
}

async function recordBackup(
  admin: SupabaseClient,
  projectId: string,
  outcome: BackupOutcome,
  triggeredBy: string | null,
): Promise<{ id: string; created_at: string } | null> {
  const { data, error } = await admin
    .from("website_backups")
    .insert({
      project_id: projectId,
      status: outcome.status,
      storage_path: outcome.status === "ok" ? outcome.storagePath : null,
      byte_size: outcome.status === "ok" ? outcome.byteSize : null,
      error_message: outcome.status === "failed" ? outcome.errorMessage : "",
      triggered_by: triggeredBy,
    })
    .select("id, created_at")
    .single();
  if (error) {
    console.error("website-backup: insert failed", projectId, error.message);
    return null;
  }
  return data;
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
    console.error("website-backup: missing supabase env");
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

  if (isServiceRole && !projectId) {
    return await runScheduledSweep(admin, json);
  }

  if (!UUID_RE.test(projectId)) return fail("invalid_project");

  let triggeredBy: string | null = null;
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

    const { data: allowed, error: permError } = await userClient.rpc("staff_may_project", {
      p_project_id: projectId,
      p_perm: "projects.manage",
    });
    if (permError || !allowed) return fail("not_allowed", 403);
    triggeredBy = user.id;
  }

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("production_url")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) {
    console.error("website-backup: project lookup failed", projectError.message);
    return fail("server_error", 500);
  }
  if (!project) return fail("not_found", 404);

  const url = validateProductionUrl(project.production_url);
  if (!url) return fail("no_production_url");

  const outcome = await captureSnapshot(admin, projectId, url);
  const recorded = await recordBackup(admin, projectId, outcome, triggeredBy);
  if (!recorded) return fail("server_error", 500);

  return json({
    ok: true,
    backup: {
      id: recorded.id,
      createdAt: recorded.created_at,
      status: outcome.status,
      errorMessage: outcome.status === "failed" ? outcome.errorMessage : "",
      byteSize: outcome.status === "ok" ? outcome.byteSize : null,
    },
  });
});

/**
 * Backs up every project due today, concurrently, up to SWEEP_LIMIT per invocation. "Due" is
 * decided by projects_due_for_website_backup() -- any Care-plan project (any tier) not already
 * backed up in the last ~20 hours.
 */
async function runScheduledSweep(
  admin: SupabaseClient,
  json: (body: Record<string, unknown>, status?: number) => Response,
): Promise<Response> {
  const { data: due, error: dueError } = await admin.rpc("projects_due_for_website_backup");
  if (dueError) {
    console.error("website-backup sweep: due-projects lookup failed", dueError.message);
    return json({ ok: false, error: "server_error" }, 500);
  }
  const candidates = ((due ?? []) as { project_id: string; production_url: string | null }[]).slice(0, SWEEP_LIMIT);
  if (candidates.length === 0) return json({ ok: true, backedUp: 0, candidates: 0 });

  const outcomes = await Promise.all(
    candidates.map(async (project) => {
      const url = validateProductionUrl(project.production_url);
      const outcome: BackupOutcome = url
        ? await captureSnapshot(admin, project.project_id, url)
        : { status: "failed", errorMessage: "No production URL configured." };
      const recorded = await recordBackup(admin, project.project_id, outcome, null);
      return Boolean(recorded) && outcome.status === "ok";
    }),
  );

  return json({ ok: true, backedUp: outcomes.filter(Boolean).length, candidates: outcomes.length });
}
