import {
  emptyScopeDraft,
  normalizeScopeFeatures,
  normalizeScopePages,
  normalizeScopeStyles,
  splitLegacySelections,
  validateScopeBrief,
  proposalOverviewFromBrief,
  proposalScopeFromBrief,
  type ClientScopeBrief,
  type ScopeBriefDraft,
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
    code === "PGRST204" ||
    code === "PGRST205" ||
    (message.includes("client_scope_briefs") &&
      (message.toLowerCase().includes("does not exist") ||
        message.toLowerCase().includes("schema cache") ||
        message.toLowerCase().includes("could not find")))
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

function asRow(data: unknown): ClientScopeBriefRow {
  return data as ClientScopeBriefRow;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapBrief(row: ClientScopeBriefRow): ClientScopeBrief {
  const legacy = splitLegacySelections(row.selected_pages ?? []);
  const storedFeatures = normalizeScopeFeatures(stringList(row.features));
  const pages = normalizeScopePages(legacy.pages.length ? legacy.pages : stringList(row.selected_pages));
  const features = storedFeatures.length ? storedFeatures : legacy.features;
  return {
    id: row.id,
    clientId: row.client_id,
    selectedPages: pages,
    otherPages: (row.other_pages ?? "").trim(),
    features,
    otherFeatures: (row.other_features ?? "").trim(),
    goal: row.goal.trim(),
    hasExistingWebsite: Boolean(row.has_existing_website),
    currentWebsiteUrl: (row.current_website_url ?? "").trim(),
    currentWebsiteNotes: (row.current_website_notes ?? "").trim(),
    designStyles: normalizeScopeStyles(stringList(row.design_styles)),
    otherStyle: (row.other_style ?? "").trim(),
    likedWebsites: (row.liked_websites ?? "").trim(),
    additionalNotes: (row.additional_notes ?? "").trim(),
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchClientScopeBrief(clientId: string): Promise<ClientScopeBrief | null> {
  const client = db();
  const { data, error } = await client.from("client_scope_briefs").select("*").eq("client_id", clientId).maybeSingle();
  throwIf(error, "load scope brief", "Unable to load this scope form.");
  return data ? mapBrief(asRow(data)) : null;
}

export async function saveClientScopeBrief(clientId: string, input: ScopeBriefDraft): Promise<ClientScopeBrief> {
  const draft: ScopeBriefDraft = {
    ...emptyScopeDraft(),
    ...input,
    pages: normalizeScopePages(input.pages),
    features: normalizeScopeFeatures(input.features),
    styles: normalizeScopeStyles(input.styles),
    otherPages: input.otherPages.trim(),
    otherFeatures: input.otherFeatures.trim(),
    goal: input.goal.trim(),
    currentWebsiteUrl: input.currentWebsiteUrl.trim(),
    currentWebsiteNotes: input.currentWebsiteNotes.trim(),
    otherStyle: input.otherStyle.trim(),
    likedWebsites: input.likedWebsites.trim(),
    additionalNotes: input.additionalNotes.trim(),
  };
  const invalid = validateScopeBrief(draft);
  if (invalid) throw new AgencyDbError(invalid);

  const payload = {
    selected_pages: draft.pages,
    features: draft.features,
    other_pages: draft.pages.includes("Other") ? draft.otherPages : "",
    other_features: draft.features.includes("Other") ? draft.otherFeatures : "",
    goal: draft.goal,
    has_existing_website: draft.hasExistingWebsite === true,
    current_website_url: draft.hasExistingWebsite ? draft.currentWebsiteUrl : "",
    current_website_notes: draft.hasExistingWebsite ? draft.currentWebsiteNotes : "",
    design_styles: draft.styles,
    other_style: draft.styles.includes("Other") ? draft.otherStyle : "",
    liked_websites: draft.likedWebsites,
    additional_notes: draft.additionalNotes,
  };

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
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    throwIf(error, "save scope brief", "Unable to save this scope form.");
    return mapBrief(asRow(data));
  }

  const { data, error } = await client
    .from("client_scope_briefs")
    .insert({ client_id: clientId, ...payload })
    .select("*")
    .single();
  throwIf(error, "save scope brief", "Unable to save this scope form.");
  return mapBrief(asRow(data));
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
