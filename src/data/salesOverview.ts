/**
 * Pure selectors for the Sales Dashboard. Same style as pmOverview.ts / developerOverview.ts: plain
 * functions over data the overview already loads (leads, proposal and contract summaries), no hooks or
 * fetching. Nothing here is estimated or invented: every number comes from a real record.
 *
 * Imports are relative (and type-only where possible) so these functions can be unit tested in plain Node
 * (scripts/test-sales-overview.mjs).
 */
import type { ContractSummary, ProposalSummary } from "@/data/documentsRepository";
import type { Lead, LeadStatus } from "@/data/leads";
import { leadStatuses } from "./leads.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole calendar days from `iso` to `now` (0 = today). Negative for the future; NaN dates count as 0. */
export function daysSince(iso: string, now = new Date()): number {
  const date = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** A proposal or contract the client has been sent and has not answered yet. */
function awaitingClient(status: string): boolean {
  return status === "sent" || status === "viewed";
}

export type LeadStatusCount = { status: LeadStatus; count: number };

/** Leads per status in pipeline order, including zeros so the chart's categories stay stable. */
export function leadStatusCounts(leads: Pick<Lead, "status">[]): LeadStatusCount[] {
  return leadStatuses.map((status) => ({ status, count: leads.filter((lead) => lead.status === status).length }));
}

export type DailyCount = { date: string; label: string; value: number };

/** New leads per local calendar day for the last `days` days, oldest first, ending today. Days with none are 0. */
export function leadsPerDay(leads: Pick<Lead, "createdAt">[], days = 30, now = new Date()): DailyCount[] {
  const byDate = new Map<string, number>();
  for (const lead of leads) {
    const created = new Date(lead.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    const key = isoDate(created);
    byDate.set(key, (byDate.get(key) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - index));
    const date = isoDate(day);
    return {
      date,
      label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: byDate.get(date) ?? 0,
    };
  });
}

export type LeadFollowUp<T> = { lead: T; ageDays: number };

/**
 * Leads still waiting for a first response: status "New" and not yet converted to a client. Oldest first,
 * because the lead that has waited longest is the one at most risk of going cold.
 */
export function leadsToFollowUp<T extends Pick<Lead, "status" | "createdAt" | "convertedClientId">>(
  leads: T[],
  now = new Date(),
): LeadFollowUp<T>[] {
  return leads
    .filter((lead) => lead.status === "New" && !lead.convertedClientId)
    .map((lead) => ({ lead, ageDays: Math.max(0, daysSince(lead.createdAt, now)) }))
    .sort((a, b) => b.ageDays - a.ageDays);
}

export type ProposalFollowUp<T> = { proposal: T; daysSinceSent: number | null; daysUntilExpiry: number | null };

/**
 * Proposals the client has been sent but not answered (sent or viewed), longest-waiting first. Expired
 * proposals are excluded because effectiveStatus already reports them as "expired".
 */
export function proposalsAwaitingResponse<
  T extends Pick<ProposalSummary, "effectiveStatus" | "sentAt" | "validUntil" | "createdAt">,
>(proposals: T[], now = new Date()): ProposalFollowUp<T>[] {
  return proposals
    .filter((proposal) => awaitingClient(proposal.effectiveStatus))
    .map((proposal) => ({
      proposal,
      daysSinceSent: proposal.sentAt ? Math.max(0, daysSince(proposal.sentAt, now)) : null,
      daysUntilExpiry: proposal.validUntil ? 0 - daysSince(proposal.validUntil, now) : null,
    }))
    .sort((a, b) => (b.daysSinceSent ?? -1) - (a.daysSinceSent ?? -1));
}

/** Sum of what the sent-but-unanswered proposals are worth. */
export function openProposalValueCents(proposals: Pick<ProposalSummary, "effectiveStatus" | "investmentCents">[]): number {
  return proposals
    .filter((proposal) => awaitingClient(proposal.effectiveStatus))
    .reduce((sum, proposal) => sum + proposal.investmentCents, 0);
}

export type AcceptedProposals = { count: number; valueCents: number };

/** Proposals the client accepted in the calendar month containing `now`. */
export function acceptedThisMonth(
  proposals: Pick<ProposalSummary, "effectiveStatus" | "acceptedAt" | "investmentCents">[],
  now = new Date(),
): AcceptedProposals {
  const accepted = proposals.filter((proposal) => {
    if (proposal.effectiveStatus !== "accepted" || !proposal.acceptedAt) return false;
    const at = new Date(proposal.acceptedAt);
    return at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth();
  });
  return { count: accepted.length, valueCents: accepted.reduce((sum, proposal) => sum + proposal.investmentCents, 0) };
}

export type ContractAction = "needs_signature" | "awaiting_client";
export type ContractFollowUp<T> = { contract: T; action: ContractAction; ageDays: number };

/**
 * Contracts that need someone to act. "needs_signature": the client has accepted but the agency has not
 * countersigned yet, so it is our move. "awaiting_client": sent (or viewed) and unanswered. Our own
 * signatures come first, then the longest-waiting.
 */
export function contractsNeedingAction<
  T extends Pick<ContractSummary, "effectiveStatus" | "agencySigned" | "sentAt" | "acceptedAt" | "createdAt">,
>(contracts: T[], now = new Date()): ContractFollowUp<T>[] {
  const rows: ContractFollowUp<T>[] = [];
  for (const contract of contracts) {
    if (contract.effectiveStatus === "accepted" && !contract.agencySigned) {
      rows.push({ contract, action: "needs_signature", ageDays: Math.max(0, daysSince(contract.acceptedAt ?? contract.createdAt, now)) });
    } else if (awaitingClient(contract.effectiveStatus)) {
      rows.push({ contract, action: "awaiting_client", ageDays: Math.max(0, daysSince(contract.sentAt ?? contract.createdAt, now)) });
    }
  }
  return rows.sort((a, b) => {
    if (a.action !== b.action) return a.action === "needs_signature" ? -1 : 1;
    return b.ageDays - a.ageDays;
  });
}
