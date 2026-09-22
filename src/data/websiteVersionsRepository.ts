import type { WebsiteVersion } from "@/data/websiteVersions";
import { AgencyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database, WebsiteVersionRow } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

function db(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  throw new AgencyDbError(fallback, error);
}

function mapVersion(row: WebsiteVersionRow): WebsiteVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    versionMajor: row.version_major,
    versionMinor: row.version_minor,
    summary: row.summary,
    careRequestId: row.care_request_id,
    isMajor: row.is_major,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/** Client and staff alike: RLS narrows to the caller's own project (client) or an assigned one (staff). */
export async function listWebsiteVersions(projectId: string): Promise<WebsiteVersion[]> {
  const client = db();
  const { data, error } = await client
    .from("website_versions")
    .select("*")
    .eq("project_id", projectId)
    .order("version_major", { ascending: false })
    .order("version_minor", { ascending: false });
  if (error) fail("load website versions", error, "Unable to load version history.");
  return (data ?? []).map((row) => mapVersion(row as WebsiteVersionRow));
}

/** Staff: record the next version (minor bump by default, major bump for a redesign/new feature). */
export async function recordWebsiteVersion(input: {
  projectId: string;
  summary: string;
  isMajor?: boolean;
  careRequestId?: string | null;
}): Promise<string> {
  const client = db();
  const { data, error } = await client.rpc("record_website_version", {
    p_project_id: input.projectId,
    p_summary: input.summary,
    p_is_major: input.isMajor ?? false,
    p_care_request_id: input.careRequestId ?? null,
  });
  if (error) fail("record website version", error, "Unable to record this version.");
  return data as string;
}
