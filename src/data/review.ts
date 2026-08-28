/**
 * Feedback and approval UI types and helpers.
 * Runtime records come from Supabase and are keyed by version_id.
 * This module has no seed rows.
 */

import type { AgencyDeliverable, AgencyFileVersion, DeliverableStatus } from "@/data/files";
import { currentVersion, versionLabel } from "@/data/files";
import { formatLeadDate, formatLeadSubmitted } from "@/data/leads";

export const feedbackStatuses = ["Open", "Resolved"] as const;
export type FeedbackStatus = (typeof feedbackStatuses)[number];

export type ReviewFeedback = {
  id: string;
  projectId: string;
  deliverableId: string;
  versionId: string;
  clientId: string;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
  resolvedAt: string | null;
  createdBy: string;
};

export type ReviewApproval = {
  id: string;
  projectId: string;
  deliverableId: string;
  versionId: string;
  clientId: string;
  status: "Approved";
  approvedBy: string;
  approvedAt: string;
};

export function statusAfterNewVersion(status: DeliverableStatus): DeliverableStatus {
  return status === "Archived" ? "Archived" : "Draft";
}

export function canSendForReview(deliverable: AgencyDeliverable): boolean {
  if (!deliverable.currentVersionId) return false;
  if (deliverable.status === "Archived") return false;
  return deliverable.status === "Draft" || deliverable.status === "Needs Changes";
}

export function canClientReview(deliverable: AgencyDeliverable): boolean {
  return deliverable.status === "In Review" && Boolean(deliverable.currentVersionId);
}

export function canLeaveFeedback(deliverable: AgencyDeliverable): boolean {
  if (!deliverable.currentVersionId || deliverable.status === "Archived") return false;
  return deliverable.status === "In Review" || deliverable.status === "Needs Changes";
}

export function clientReviewLabel(status: DeliverableStatus): string {
  if (status === "In Review") return "Needs Review";
  if (status === "Needs Changes") return "Changes Requested";
  return status;
}

export function clientStatusTone(status: DeliverableStatus): "progress" | "review" | "done" | "neutral" | "changes" {
  if (status === "Approved") return "done";
  if (status === "In Review") return "review";
  if (status === "Needs Changes") return "changes";
  if (status === "Draft") return "progress";
  return "neutral";
}

export function filterFeedback(
  items: ReviewFeedback[],
  query: string,
  status: FeedbackStatus | "All",
): ReviewFeedback[] {
  const needle = query.trim().toLowerCase();
  return items.filter((item) => {
    if (status !== "All" && item.status !== status) return false;
    if (!needle) return true;
    return item.message.toLowerCase().includes(needle);
  });
}

export function feedbackForVersion(items: ReviewFeedback[], versionId: string): ReviewFeedback[] {
  return items.filter((item) => item.versionId === versionId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function approvalsForVersion(items: ReviewApproval[], versionId: string): ReviewApproval[] {
  return items.filter((item) => item.versionId === versionId).sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
}

export function versionReviewCaption(
  version: AgencyFileVersion,
  deliverable: AgencyDeliverable,
  feedback: ReviewFeedback[],
  approvals: ReviewApproval[],
): string {
  if (approvalsForVersion(approvals, version.id).length > 0) return "Approved";
  if (feedbackForVersion(feedback, version.id).length > 0) return "Changes Requested";
  if (version.id === deliverable.currentVersionId && deliverable.status === "In Review") return "In Review";
  if (version.id === deliverable.currentVersionId) return "Current";
  return "Historical";
}

export function awaitingReview(items: AgencyDeliverable[]): AgencyDeliverable[] {
  return items.filter((item) => canClientReview(item));
}

export function needsAttention(items: AgencyDeliverable[]): AgencyDeliverable[] {
  return items.filter((item) => item.status === "Needs Changes");
}

export function latestFeedback(items: ReviewFeedback[]): ReviewFeedback | null {
  return items.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export function reviewHeadline(deliverable: AgencyDeliverable): string {
  const current = currentVersion(deliverable);
  return current ? `${deliverable.name} ${versionLabel(current.versionNumber)}` : deliverable.name;
}

export { formatLeadDate as formatReviewRelative, formatLeadSubmitted as formatReviewLong };
