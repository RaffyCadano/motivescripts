/**
 * Lead UI types, status lists, and formatters.
 * Runtime records come from Supabase via LeadsProvider. This module has no seed rows.
 */

export const leadStatuses = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"] as const;

export type LeadStatus = (typeof leadStatuses)[number];

export const leadIndustries = [
  "Home services",
  "Contractor",
  "Landscaping",
  "Tree service",
  "Cleaning",
  "Restaurant",
  "Salon / barber",
  "Auto",
  "Professional services",
  "Other",
] as const;

export type LeadIndustry = (typeof leadIndustries)[number];

export type LeadSource = "Start a Project" | "Manual";

export type LeadNote = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
};

export type LeadActivityItem = {
  id: string;
  description: string;
  createdAt: string;
};

export type Lead = {
  id: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  industry: LeadIndustry;
  request: string;
  projectDetails: string;
  status: LeadStatus;
  createdAt: string;
  source: LeadSource;
  notes: LeadNote[];
  activity: LeadActivityItem[];
  convertedClientId: string | null;
};

export type LeadDraft = {
  name: string;
  businessName: string;
  email: string;
  phone: string;
  industry: LeadIndustry;
  request: string;
  projectDetails: string;
};

export function createRecordId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function formatLeadDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfThatDay) / 86_400_000);

  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return `${dayDiff} days ago`;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function formatLeadTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatLeadSubmitted(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function leadListNextAction(lead: Lead): { label: string; href: string } {
  if (lead.convertedClientId) {
    return { label: "View Client", href: `/admin/clients/${lead.convertedClientId}` };
  }
  switch (lead.status) {
    case "New":
      return { label: "Contact", href: `/admin/leads/${lead.id}` };
    case "Contacted":
      return { label: "Qualify", href: `/admin/leads/${lead.id}` };
    case "Qualified":
    case "Won":
      return { label: "Convert", href: `/admin/leads/${lead.id}` };
    case "Proposal":
    case "Lost":
      return { label: "View", href: `/admin/leads/${lead.id}` };
  }
}

export function leadNeedsListAttention(lead: Lead): boolean {
  return !lead.convertedClientId && lead.status === "New";
}

export function filterLeads(
  leads: Lead[],
  query: string,
  status: LeadStatus | "All",
  industry: LeadIndustry | "All",
): Lead[] {
  const needle = query.trim().toLowerCase();
  return leads.filter((lead) => {
    if (status !== "All" && lead.status !== status) return false;
    if (industry !== "All" && lead.industry !== industry) return false;
    if (!needle) return true;
    return (
      lead.name.toLowerCase().includes(needle) ||
      lead.businessName.toLowerCase().includes(needle) ||
      lead.email.toLowerCase().includes(needle) ||
      (lead.phone ?? "").toLowerCase().includes(needle)
    );
  });
}
