import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { site } from "@/data/site";

export type PublicLeadDraft = {
  name: string;
  business: string;
  email: string;
  phone: string;
  industry: string;
  goal: string;
  /** Honeypot — real visitors never fill this in. A non-empty value marks the submission as a bot. */
  website?: string;
};

export type PublicLeadResult = { ok: true } | { ok: false };

export function inquiryMailtoHref(draft: PublicLeadDraft): string {
  const body = [
    `Name: ${draft.name}`,
    `Business: ${draft.business}`,
    `Email: ${draft.email}`,
    `Phone: ${draft.phone || "—"}`,
    `Industry: ${draft.industry}`,
    "",
    draft.goal,
  ].join("\n");
  return `mailto:${site.email}?subject=${encodeURIComponent(
    `Project inquiry — ${draft.business || "New project"}`,
  )}&body=${encodeURIComponent(body)}`;
}

export async function submitPublicLead(draft: PublicLeadDraft): Promise<PublicLeadResult> {
  if (!isSupabaseConfigured()) return { ok: false };
  const client = getSupabase();
  if (!client) return { ok: false };

  const { data, error } = await client.functions.invoke("public-lead", {
    body: {
      name: draft.name.trim(),
      business: draft.business.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      industry: draft.industry,
      goal: draft.goal.trim(),
      website: draft.website ?? "",
    },
  });

  if (error) return { ok: false };
  if (data && typeof data === "object" && (data as { ok?: boolean }).ok === true) {
    return { ok: true };
  }
  return { ok: false };
}
