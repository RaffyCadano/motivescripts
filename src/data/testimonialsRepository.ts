import type { Testimonial, TestimonialDraft } from "@/data/testimonials";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { TestimonialRow } from "@/types/database";
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

function throwIf(error: unknown, context: string, fallback: string) {
  if (error) {
    logDbError(context, error);
    throw new AgencyDbError(friendlyDbError(error, fallback), error);
  }
}

function toTestimonial(row: TestimonialRow): Testimonial {
  return {
    id: row.id,
    clientName: row.client_name,
    roleTitle: row.role_title,
    quote: row.quote,
    projectId: row.project_id,
    published: row.published,
    displayOrder: row.display_order,
    createdAt: row.created_at,
  };
}

function draftFields(draft: TestimonialDraft) {
  return {
    client_name: draft.clientName.trim(),
    role_title: draft.roleTitle.trim(),
    quote: draft.quote.trim(),
    project_id: draft.projectId,
    published: draft.published,
    display_order: draft.displayOrder,
  };
}

/** Anon-safe: published testimonials for the public marketing site, ordered for display. */
export async function fetchPublishedTestimonials(): Promise<Testimonial[]> {
  if (!isSupabaseConfigured()) return [];
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from("testimonials")
    .select("*")
    .eq("published", true)
    .order("display_order", { ascending: true });
  if (error) return [];
  return ((data ?? []) as TestimonialRow[]).map(toTestimonial);
}

export async function fetchAllTestimonials(): Promise<Testimonial[]> {
  const client = db();
  const { data, error } = await client.from("testimonials").select("*").order("display_order", { ascending: true });
  throwIf(error, "load testimonials", "Unable to load testimonials.");
  return ((data ?? []) as TestimonialRow[]).map(toTestimonial);
}

export async function fetchTestimonial(id: string): Promise<Testimonial | null> {
  const client = db();
  const { data, error } = await client.from("testimonials").select("*").eq("id", id).maybeSingle();
  throwIf(error, "load testimonial", "Unable to load this testimonial.");
  return data ? toTestimonial(data as TestimonialRow) : null;
}

export async function insertTestimonial(draft: TestimonialDraft): Promise<string> {
  const client = db();
  const { data, error } = await client.from("testimonials").insert(draftFields(draft)).select("id").single();
  throwIf(error, "create testimonial", "Unable to create this testimonial.");
  if (!data) throw new AgencyDbError("Unable to create this testimonial.");
  return (data as { id: string }).id;
}

export async function updateTestimonial(id: string, draft: TestimonialDraft): Promise<void> {
  const client = db();
  const { error } = await client.from("testimonials").update(draftFields(draft)).eq("id", id);
  throwIf(error, "update testimonial", "Unable to update this testimonial.");
}

export async function deleteTestimonial(id: string): Promise<void> {
  const client = db();
  const { error } = await client.from("testimonials").delete().eq("id", id);
  throwIf(error, "delete testimonial", "Unable to delete this testimonial.");
}
