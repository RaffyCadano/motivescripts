/**
 * Client UI types and helpers.
 * Runtime records come from Supabase via LeadsProvider. This module has no seed rows.
 */

import { formatLeadDate, formatLeadSubmitted, formatLeadTimestamp, type LeadIndustry, type LeadSource } from "@/data/leads";

export const clientStatuses = ["Active", "Inactive", "Archived"] as const;
export type AgencyClientStatus = (typeof clientStatuses)[number];

export type AgencyNote = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
};

export type AgencyActivityItem = {
  id: string;
  description: string;
  createdAt: string;
  icon: "created" | "converted" | "note" | "project" | "file" | "status";
};

export type AgencyFileSummary = {
  id: string;
  name: string;
  versionLabel: string;
  uploadedLabel: string;
};

export type AgencyInvoiceSummary = {
  id: string;
  number: string;
  title: string;
  amount: string;
  status: "Paid" | "Partially Paid" | "Due";
};

export type AgencyMessageSummary = {
  id: string;
  sender: string;
  body: string;
};

export type AgencyClient = {
  id: string;
  sourceLeadId: string | null;
  contactName: string;
  businessName: string;
  email: string;
  phone: string;
  industry: LeadIndustry;
  website: string;
  location: string;
  status: AgencyClientStatus;
  source: LeadSource;
  createdAt: string;
  lastActivityAt: string;
  notes: AgencyNote[];
  activity: AgencyActivityItem[];
  files: AgencyFileSummary[];
  invoices: AgencyInvoiceSummary[];
  messages: AgencyMessageSummary[];
};

export type AgencyClientDraft = {
  contactName: string;
  businessName: string;
  email: string;
  phone: string;
  industry: LeadIndustry;
  website: string;
  location: string;
};

export type AgencyClientEdits = AgencyClientDraft & {
  status: AgencyClientStatus;
};

export function filterAgencyClients(
  clients: AgencyClient[],
  query: string,
  status: AgencyClientStatus | "All",
  industry: LeadIndustry | "All",
): AgencyClient[] {
  const needle = query.trim().toLowerCase();
  return clients.filter((client) => {
    if (status !== "All" && client.status !== status) return false;
    if (industry !== "All" && client.industry !== industry) return false;
    if (!needle) return true;
    return (
      client.contactName.toLowerCase().includes(needle) ||
      client.businessName.toLowerCase().includes(needle) ||
      client.email.toLowerCase().includes(needle) ||
      (client.phone ?? "").toLowerCase().includes(needle)
    );
  });
}

export function projectCountLabel(count: number): string {
  return count === 1 ? "1 project" : `${count} projects`;
}

export {
  formatLeadDate as formatClientDate,
  formatLeadSubmitted as formatClientSince,
  formatLeadTimestamp as formatClientTimestamp,
};
