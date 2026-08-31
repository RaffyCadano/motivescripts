import {
  normalizeScopePages,
  validateScopeBrief,
  proposalOverviewFromBrief,
  proposalScopeFromBrief,
  type ClientScopeBrief,
} from "@/data/scopeBriefs";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { ClientScopeBriefRow } from "@/types/database";
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

function briefUnavailable(error: unknown): boolean {
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes("client_scope_briefs") &&
      (message.toLowerCase().includes("does not exist") || message.toLowerCase().includes("schema cache")))
  );
}

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  if (briefUnavailable(error)) {
    throw new AgencyDbError("The scope form isn’t available until the latest database update is applied.", error);
  }
  throw new AgencyDbError(friendlyDbError(error, fallback), error);
}

function throwIf(error: unknown, context: string, fallback: string) {
  if (error) fail(context, error, fallback);
}

function mapBrief(row: ClientScopeBriefRow): ClientScopeBrief {
  return {
    id: row.id,
    clientId: row.client_id,
    selectedPages: normalizeScopePages(row.selected_pages ?? []),
    goal: row.goal.trim(),
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchClientScopeBrief(clientId: string): Promise<ClientScopeBrief | null> {
  const client = db();
  const { data, error } = await client.from("client_scope_briefs").select("*").eq("client_id", clientId).maybeSingle();
  throwIf(error, "load scope brief", "Unable to load this scope form.");
  return data ? mapBrief(data as ClientScopeBriefRow) : null;
}

export async function saveClientScopeBrief(
  clientId: string,
  pages: readonly string[],
  goal: string,
): Promise<ClientScopeBrief> {
  const selected = normalizeScopePages(pages);
  const text = goal.trim();
  const invalid = validateScopeBrief(selected, text);
  if (invalid) throw new AgencyDbError(invalid);

  const client = db();
  const { data: existing, error: existingError } = await client
    .from("client_scope_briefs")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  throwIf(existingError, "save scope brief", "Unable to save this scope form.");

  if (existing?.id) {
    const { data, error } = await client
      .from("client_scope_briefs")
      .update({ selected_pages: selected, goal: text })
      .eq("id", existing.id)
      .select("*")
      .single();
    throwIf(error, "save scope brief", "Unable to save this scope form.");
    return mapBrief(data as ClientScopeBriefRow);
  }

  const { data, error } = await client
    .from("client_scope_briefs")
    .insert({ client_id: clientId, selected_pages: selected, goal: text })
    .select("*")
    .single();
  throwIf(error, "save scope brief", "Unable to save this scope form.");
  return mapBrief(data as ClientScopeBriefRow);
}

export async function seedProposalDraftFromBrief(proposalId: string, clientId: string): Promise<void> {
  const brief = await fetchClientScopeBrief(clientId);
  if (!brief) return;

  const client = db();
  const { data, error } = await client
    .from("proposals")
    .select("working_revision_id")
    .eq("id", proposalId)
    .maybeSingle();
  throwIf(error, "seed proposal", "Unable to apply the scope form to this proposal.");
  const revisionId = (data as { working_revision_id: string | null } | null)?.working_revision_id;
  if (!revisionId) return;

  const { error: updateError } = await client
    .from("proposal_revisions")
    .update({
      scope: proposalScopeFromBrief(brief),
      overview: proposalOverviewFromBrief(brief),
    })
    .eq("id", revisionId)
    .eq("status", "draft");
  throwIf(updateError, "seed proposal", "Unable to apply the scope form to this proposal.");
}
