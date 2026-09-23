import { backupFileName, mapWebsiteBackupRow, type WebsiteBackup } from "@/data/websiteBackups";
import { signedUrlForPath } from "@/data/fileStorage";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const BACKUP_HISTORY_LIMIT = 20;

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

/** Most recent backups first. Empty array means no backup has ever run (or none is due yet). */
export async function fetchWebsiteBackupHistory(projectId: string): Promise<WebsiteBackup[]> {
  const client = db();
  const { data, error } = await client
    .from("website_backups")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(BACKUP_HISTORY_LIMIT);
  if (error) fail("load website backups", error, "Unable to load backup history.");
  return (data ?? []).map(mapWebsiteBackupRow);
}

/** Whether this project has any active/past-due Care plan -- automated backups run on every tier,
 * unlike Advanced monitoring, so this is deliberately not fetchProjectHasFastMonitoring. */
export async function fetchProjectHasActiveCarePlan(projectId: string): Promise<boolean> {
  const client = db();
  const { data, error } = await client.rpc("staff_project_has_active_care_plan", { p_project_id: projectId });
  if (error) return false;
  return Boolean(data);
}

type BackupNowPayload = {
  id: string;
  createdAt: string;
  status: string;
  errorMessage: string;
  byteSize: number | null;
};

const BACKUP_NOW_ERRORS: Record<string, string> = {
  not_allowed: "You don't have access to back up this project's website.",
  not_found: "Project not found.",
  no_production_url: "No production URL is configured for this project yet.",
  invalid_project: "Unable to back up this project's website.",
  server_error: "Unable to back up the website right now. Try again shortly.",
};

function backupNowErrorMessage(code: string | null): string {
  return BACKUP_NOW_ERRORS[code ?? ""] ?? BACKUP_NOW_ERRORS.server_error;
}

// A non-2xx response (401/403/404/500) makes supabase-js treat the call as an "error" with no
// parsed body -- the specific { ok: false, error: "not_allowed" } etc. the Edge Function actually
// sent is still there, just on error.context (the raw Response), not on `data`. Same pattern as
// checkWebsiteHealthNow's functionErrorCode in websiteHealthRepository.ts -- without this, every
// non-2xx failure (wrong permission, project not found, ...) would collapse into the generic
// "Unable to back up the website right now" instead of its real, more useful message.
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

/** Triggers a real, on-demand snapshot of the project's stored production URL. */
export async function backupWebsiteNow(projectId: string): Promise<WebsiteBackup> {
  const client = db();
  const { data, error } = await client.functions.invoke("website-backup", { body: { projectId } });
  if (error) {
    const code = await functionErrorCode(error);
    throw new AgencyDbError(backupNowErrorMessage(code), error);
  }
  const payload = data as { ok?: boolean; backup?: BackupNowPayload; error?: string } | null;
  if (!payload?.ok || !payload.backup) {
    throw new AgencyDbError(backupNowErrorMessage(payload?.error ?? null));
  }
  const backup = payload.backup;
  return {
    id: backup.id,
    projectId,
    status: backup.status === "ok" ? "ok" : "failed",
    storagePath: null,
    byteSize: backup.byteSize,
    errorMessage: backup.errorMessage,
    triggeredBy: null,
    createdAt: backup.createdAt,
  };
}

/** Downloads a stored backup snapshot. Throws if the backup failed and has no stored file. */
export async function downloadWebsiteBackup(backup: WebsiteBackup): Promise<void> {
  if (!backup.storagePath) {
    throw new AgencyDbError("This backup attempt failed and has no file to download.");
  }
  const fileName = backupFileName(backup);
  let url: string;
  try {
    url = await signedUrlForPath(backup.storagePath, { download: fileName });
  } catch (error) {
    fail("download website backup", error, "Unable to download this backup.");
  }
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}
