import { AgencyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Bring a paused website back (admin / anyone with projects.manage). `days` (1-365) gives the project that
 * many more days of free period, with reminders starting over; `null` keeps it live indefinitely.
 * See unpause_website() in 20261104000000_launch_trial_pause_and_reminders.sql.
 */
/**
 * Read-only check of the Vercel setup on the project form: looks the project up on Vercel with the values typed
 * in (saved or not) and says whether it was found. Changes nothing anywhere. Needs projects.manage.
 */
export async function checkVercelConnection(
  projectId: string,
  vercelProjectId: string,
  vercelTeamId: string,
): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  const { data, error } = await client.functions.invoke("vercel-site-control", {
    body: { projectId, action: "check", vercelProjectId, vercelTeamId },
  });
  if (error) {
    logDbError("check vercel connection", error);
    throw new AgencyDbError("Couldn't run the check. Try again in a moment.", error);
  }
  const result = data as { ok?: boolean; message?: string } | null;
  return { ok: Boolean(result?.ok), message: result?.message ?? "No answer from the server." };
}

/** Retry the automatic pause / unpause on Vercel after it failed (see retry_host_site_control). */
export async function retryHostSiteControl(projectId: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  const { error } = await client.rpc("retry_host_site_control", { p_project_id: projectId });
  if (!error) return;
  logDbError("retry host site control", error);
  const message = error.message ?? "";
  if (message.includes("NOT_ENABLED")) throw new AgencyDbError("Automatic pause on Vercel isn't turned on for this project.", error);
  if (message.includes("NOTHING_TO_DO")) throw new AgencyDbError("Vercel already matches this website's status.", error);
  if (message.includes("Not allowed")) throw new AgencyDbError("You don't have permission to do that.", error);
  throw new AgencyDbError("Unable to retry on Vercel.", error);
}

/**
 * Pause a launched website now (admin / anyone with projects.manage). `note` (max 500 chars) is shown to the
 * client when `notifyClient` is true; false pauses it for staff only. See pause_website() in
 * 20261106000000_manual_pause.sql.
 */
export async function pauseWebsite(projectId: string, note: string, notifyClient: boolean): Promise<void> {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  const { error } = await client.rpc("pause_website", {
    p_project_id: projectId,
    p_note: note.trim() || null,
    p_notify_client: notifyClient,
  });
  if (!error) return;
  logDbError("pause website", error);
  const message = error.message ?? "";
  if (message.includes("ALREADY_PAUSED")) throw new AgencyDbError("This website is already paused.", error);
  if (message.includes("NOT_LAUNCHED")) throw new AgencyDbError("Only a launched website can be paused.", error);
  if (message.includes("NOTE_TOO_LONG")) throw new AgencyDbError("Keep the note to 500 characters.", error);
  if (message.includes("Not allowed")) throw new AgencyDbError("You don't have permission to pause this website.", error);
  throw new AgencyDbError("Unable to pause this website.", error);
}

export async function unpauseWebsite(projectId: string, days: number | null): Promise<void> {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  const { error } = await client.rpc("unpause_website", { p_project_id: projectId, p_days: days });
  if (!error) return;
  logDbError("unpause website", error);
  const message = error.message ?? "";
  if (message.includes("NOT_PAUSED")) throw new AgencyDbError("This website isn't paused.", error);
  if (message.includes("INVALID_DAYS")) throw new AgencyDbError("Choose between 1 and 365 days.", error);
  if (message.includes("Not allowed")) throw new AgencyDbError("You don't have permission to unpause this website.", error);
  throw new AgencyDbError("Unable to unpause this website.", error);
}
