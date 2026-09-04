import { pinCommentErrorCode, pinCommentErrorMessage, type PinComment } from "@/data/pinComments";
import { AgencyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { PinCommentRow } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function db(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new AgencyDbError("Supabase is not configured.");
  }
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

function fail(context: string, error: unknown): never {
  logDbError(context, error);
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  throw new AgencyDbError(pinCommentErrorMessage(pinCommentErrorCode(message)), error);
}

function mapPinComment(row: PinCommentRow): PinComment {
  return {
    id: row.id,
    versionId: row.version_id,
    deliverableId: row.deliverable_id,
    projectId: row.project_id,
    xPct: Number(row.x_pct),
    yPct: Number(row.y_pct),
    body: row.body,
    status: row.status === "Resolved" ? "Resolved" : "Open",
    createdBy: row.created_by,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export async function listPinComments(versionId: string): Promise<PinComment[]> {
  const client = db();
  const { data, error } = await client
    .from("pin_comments")
    .select("*")
    .eq("version_id", versionId)
    .order("created_at", { ascending: true });
  if (error) fail("load pin comments", error);
  return (data ?? []).map((row) => mapPinComment(row as PinCommentRow));
}

export async function submitPinComment(input: {
  versionId: string;
  xPct: number;
  yPct: number;
  body: string;
}): Promise<string> {
  const client = db();
  const { data, error } = await client.rpc("client_submit_pin_comment", {
    p_version_id: input.versionId,
    p_x_pct: input.xPct,
    p_y_pct: input.yPct,
    p_body: input.body,
  });
  if (error) fail("submit pin comment", error);
  return data as string;
}

export async function submitStaffPinComment(input: {
  versionId: string;
  xPct: number;
  yPct: number;
  body: string;
}): Promise<string> {
  const client = db();
  const { data, error } = await client.rpc("staff_submit_pin_comment", {
    p_version_id: input.versionId,
    p_x_pct: input.xPct,
    p_y_pct: input.yPct,
    p_body: input.body,
  });
  if (error) fail("submit pin comment", error);
  return data as string;
}

export async function resolvePinComment(pinId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("resolve_pin_comment", { p_pin_id: pinId });
  if (error) fail("resolve pin comment", error);
}
