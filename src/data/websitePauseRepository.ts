import { AgencyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Bring a paused website back (admin / anyone with projects.manage). `days` (1-365) gives the project that
 * many more days of free period, with reminders starting over; `null` keeps it live indefinitely.
 * See unpause_website() in 20261104000000_launch_trial_pause_and_reminders.sql.
 */
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
