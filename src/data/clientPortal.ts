/**
 * Client Portal presentation types.
 * Timeline, tasks, files, and activity are derived from live Supabase records.
 * This module has no seed rows and no default client identity.
 */

import type { AgencyProjectStatus } from "@/data/agencyProjects";
import { isProductionProject } from "@/data/preProject";

export type ProjectStageStatus = "complete" | "current" | "upcoming";

export type ClientFileKind = "design" | "image" | "archive";

export type FileVersionStatus = "current" | "previous" | "final";

export type ClientTaskStatus = "open" | "done";

export type ProjectStage = {
  id: string;
  label: string;
  status: ProjectStageStatus;
};

export type ClientActionKind =
  | "proposal"
  | "contract"
  | "invoice"
  | "review"
  | "waiting_production"
  | "in_development"
  | "idle";

export type ClientAction = {
  id: string;
  kind: ClientActionKind;
  eyebrow?: string;
  title: string;
  body: string;
  href?: string;
  buttonLabel?: string;
};

export type ClientActionFlags = {
  proposalId: string | null;
  proposalNumber: string | null;
  proposalAwaiting: boolean;
  contractId: string | null;
  contractNumber: string | null;
  contractAwaiting: boolean;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceAwaiting: boolean;
  invoicePaid: boolean;
  projectStatus: AgencyProjectStatus | null;
};

export function deriveClientPortalAction(
  flags: ClientActionFlags,
  reviewFile: { id: string; name: string } | null,
): ClientAction {
  if (flags.proposalAwaiting) {
    return {
      id: flags.proposalId ?? "proposal",
      kind: "proposal",
      eyebrow: "Proposal ready for review",
      title: "Review your proposal",
      body: flags.proposalNumber
        ? `${flags.proposalNumber} is ready. Review the scope, investment, timeline, and terms before accepting or declining.`
        : "Your website proposal is ready. Review the scope, investment, and terms, then accept or decline.",
      href: flags.proposalId ? `/client/proposals/${flags.proposalId}` : "/client/proposals",
      buttonLabel: "Review Proposal",
    };
  }

  if (flags.contractAwaiting) {
    return {
      id: flags.contractId ?? "contract",
      kind: "contract",
      eyebrow: "Contract ready for review",
      title: "Review your contract",
      body: flags.contractNumber
        ? `${flags.contractNumber} is ready. Review your website agreement, then accept or decline.`
        : "Your website agreement is ready for your review.",
      href: flags.contractId ? `/client/contracts/${flags.contractId}` : "/client/contracts",
      buttonLabel: "Review Contract",
    };
  }

  if (flags.invoiceAwaiting) {
    return {
      id: flags.invoiceId ?? "invoice",
      kind: "invoice",
      eyebrow: "Invoice ready for payment",
      title: "Pay your invoice",
      body: flags.invoiceNumber
        ? `${flags.invoiceNumber} is ready for payment.`
        : "Your invoice is ready for payment.",
      href: flags.invoiceId ? `/client/invoices/${flags.invoiceId}` : "/client/invoices",
      buttonLabel: "View & Pay Invoice",
    };
  }

  if (reviewFile) {
    return {
      id: reviewFile.id,
      kind: "review",
      eyebrow: "Ready for review",
      title: "Review your website",
      body: "Your latest work is ready for your review.",
      href: `/client/files/${reviewFile.id}`,
      buttonLabel: "Review Work",
    };
  }

  if (flags.invoicePaid && !isProductionProject(flags.projectStatus)) {
    return {
      id: flags.invoiceId ?? "payment-received",
      kind: "waiting_production",
      eyebrow: "Payment received ✓",
      title: "Your payment has been received",
      body: "MotiveScripts is now preparing your project for production.",
    };
  }

  if (flags.invoicePaid && flags.projectStatus === "In Development") {
    return {
      id: flags.invoiceId ?? "in-development",
      kind: "in_development",
      title: "Your project is now in development.",
      body: "We’re building your website. You’ll see files and reviews here as work is ready.",
    };
  }

  return {
    id: "idle",
    kind: "idle",
    title: "Nothing needed from you right now",
    body: "We’ll notify you when the next step is ready.",
  };
}

export function clientProjectStatusExplanation(status: string | null | undefined): string | null {
  switch (status) {
    case "Planning":
      return "Your project is being prepared. MotiveScripts will start production when the project is ready to begin.";
    case "In Development":
      return "We’re building your website. You’ll see files and reviews here as work is ready.";
    case "Client Review":
      return "Your latest work is ready for your review.";
    case "On Hold":
      return "Your project is on hold. We’ll update you when work resumes.";
    case "Completed":
      return "Your project is complete.";
    default:
      return null;
  }
}

export function clientProjectStatusTone(
  status: string | null | undefined,
): "progress" | "review" | "done" | "neutral" | "changes" {
  if (status === "Client Review") return "review";
  if (status === "Completed") return "done";
  if (status === "On Hold") return "changes";
  if (status === "Planning") return "neutral";
  return "progress";
}

export type ClientActivityItem = {
  id: string;
  description: string;
  time: string;
  icon: "upload" | "approval" | "update" | "status";
};

export type FileVersion = {
  id: string;
  label: string;
  status: FileVersionStatus;
  uploadedLabel: string;
  approvedBy: string | null;
  approvedDate: string | null;
};

export type ClientFile = {
  id: string;
  name: string;
  kind: ClientFileKind;
  currentVersionLabel: string;
  uploadedLabel: string;
  awaitingReview: boolean;
  versions: FileVersion[];
};

export type ClientTask = {
  id: string;
  label: string;
  status: ClientTaskStatus;
};

export function greetingForHour(hour: number, firstName: string): string {
  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 17) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}
