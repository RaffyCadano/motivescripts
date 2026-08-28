/**
 * Client Portal presentation types.
 * Timeline, tasks, files, and activity are derived from live Supabase records.
 * This module has no seed rows and no default client identity.
 */

export type ProjectStageStatus = "complete" | "current" | "upcoming";

export type ClientFileKind = "design" | "image" | "archive";

export type FileVersionStatus = "current" | "previous" | "final";

export type ClientTaskStatus = "open" | "done";

export type ProjectStage = {
  id: string;
  label: string;
  status: ProjectStageStatus;
};

export type ClientAction = {
  id: string;
  title: string;
  body: string;
  fileId: string;
  reviewHref: string;
  canApprove: boolean;
} | null;

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
