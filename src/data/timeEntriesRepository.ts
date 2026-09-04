import { type TimeEntry, type TimeEntryDraft } from "@/data/timeEntries";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { TimeEntryRow } from "@/types/database";
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

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  throw new AgencyDbError(friendlyDbError(error, fallback), error);
}

function throwIf(error: unknown, context: string, fallback: string) {
  if (error) fail(context, error, fallback);
}

function mapTimeEntry(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    taskId: row.task_id,
    staffId: row.staff_id,
    entryDate: row.entry_date,
    hours: Number(row.hours),
    note: row.note,
    billedAt: row.billed_at,
    invoiceId: row.invoice_id,
    payrollPaidAt: row.payroll_paid_at,
    createdAt: row.created_at,
  };
}

export async function logTimeEntry(draft: TimeEntryDraft): Promise<void> {
  const client = db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new AgencyDbError("You must be signed in to log time.");

  const { error } = await client.from("time_entries").insert({
    project_id: draft.projectId,
    task_id: draft.taskId,
    staff_id: user.id,
    entry_date: draft.entryDate,
    hours: draft.hours,
    note: draft.note.trim(),
  });
  throwIf(error, "log time entry", "Unable to log time.");
}

export async function listTimeEntriesForProject(projectId: string): Promise<TimeEntry[]> {
  const client = db();
  const { data, error } = await client
    .from("time_entries")
    .select("*")
    .eq("project_id", projectId)
    .order("entry_date", { ascending: false });
  throwIf(error, "load time entries", "Unable to load time entries.");
  return (data ?? []).map((row) => mapTimeEntry(row as TimeEntryRow));
}

export async function listMyTimeEntries(staffId: string): Promise<TimeEntry[]> {
  const client = db();
  const { data, error } = await client
    .from("time_entries")
    .select("*")
    .eq("staff_id", staffId)
    .order("entry_date", { ascending: false });
  throwIf(error, "load my time entries", "Unable to load your time entries.");
  return (data ?? []).map((row) => mapTimeEntry(row as TimeEntryRow));
}

export async function updateTimeEntry(id: string, edits: Pick<TimeEntryDraft, "hours" | "note" | "entryDate">): Promise<void> {
  const client = db();
  const { error } = await client
    .from("time_entries")
    .update({ hours: edits.hours, note: edits.note.trim(), entry_date: edits.entryDate })
    .eq("id", id);
  throwIf(error, "update time entry", "Unable to update this time entry.");
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const client = db();
  const { error } = await client.from("time_entries").delete().eq("id", id);
  throwIf(error, "delete time entry", "Unable to delete this time entry.");
}

export async function markTimeEntriesPaid(staffId: string, throughDate?: string): Promise<number> {
  const client = db();
  const { data, error } = await client.rpc("mark_time_entries_paid", {
    p_staff_id: staffId,
    p_through_date: throughDate ?? new Date().toISOString().slice(0, 10),
  });
  throwIf(error, "mark time entries paid", "Unable to mark these entries as paid.");
  return (data as number) ?? 0;
}
