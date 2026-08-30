import type { InvitationPreviewState } from "@/data/invitation";
import type { StaffInvitationStatus } from "@/types/database";

export const STAFF_TEMPLATE_KEYS = [
  "admin",
  "staff",
  "project_manager",
  "sales",
  "accounting",
  "developer",
  "designer",
  "content_writer",
  "team_member",
] as const;

export type StaffTemplateKey = (typeof STAFF_TEMPLATE_KEYS)[number];

const PRODUCTION_TEAM_TEMPLATES = new Set<string>([
  "developer",
  "designer",
  "content_writer",
  "team_member",
]);

export function isProductionTeamTemplate(templateKey: string | null | undefined): boolean {
  return PRODUCTION_TEAM_TEMPLATES.has(templateKey ?? "");
}

export type TeamMemberStatus = "active" | "inactive" | "pending";

export type TeamAssignment = {
  id: string;
  entityId: string;
  entityName: string;
  userId: string;
  label: string;
};

export type TeamMember = {
  id: string;
  fullName: string;
  email: string;
  role: "admin" | "staff";
  jobTitle: string;
  templateKey: StaffTemplateKey;
  templateLabel: string;
  isActive: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  permissions: string[];
  clientAssignments: TeamAssignment[];
  projectAssignments: TeamAssignment[];
  activeTaskCount: number;
  completedTaskCount: number;
};

export type TeamInvitation = {
  id: string;
  email: string;
  inviteeName: string;
  jobTitle: string;
  templateKey: StaffTemplateKey;
  templateLabel: string;
  status: StaffInvitationStatus;
  expiresAt: string;
  createdAt: string;
  permissionCodes: string[];
};

export type TeamListRow =
  | { kind: "member"; member: TeamMember }
  | { kind: "invite"; invitation: TeamInvitation };

export type StaffPermissionOption = {
  code: string;
  label: string;
  sortOrder: number;
};

export type StaffTemplateOption = {
  key: StaffTemplateKey;
  label: string;
  profileRole: "admin" | "staff";
  permissionCodes: string[];
};

export function isStaffTemplateKey(value: string): value is StaffTemplateKey {
  return (STAFF_TEMPLATE_KEYS as readonly string[]).includes(value);
}

export function teamStatusLabel(row: TeamListRow): string {
  if (row.kind === "invite") return "Pending invitation";
  return row.member.isActive ? "Active" : "Inactive";
}

export function teamRowName(row: TeamListRow): string {
  return row.kind === "member" ? row.member.fullName || row.member.email : row.invitation.inviteeName || row.invitation.email;
}

export function teamRowEmail(row: TeamListRow): string {
  return row.kind === "member" ? row.member.email : row.invitation.email;
}

export function teamRowRole(row: TeamListRow): string {
  return row.kind === "member" ? row.member.templateLabel : row.invitation.templateLabel;
}

export function teamRowTitle(row: TeamListRow): string {
  return row.kind === "member" ? row.member.jobTitle : row.invitation.jobTitle;
}

export function formatTeamDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function staffInvitationErrorMessage(code: string): string {
  switch (code) {
    case "pending_exists":
      return "An invitation is already pending for this email. Use Resend invitation instead.";
    case "invalid_email":
      return "Enter a valid email address.";
    case "required_name":
      return "Enter the team member’s full name.";
    case "invalid_role":
      return "Choose a valid role.";
    case "already_staff":
      return "This email already belongs to an active team member.";
    case "is_client":
      return "That email belongs to a client portal account and cannot be invited as staff.";
    case "not_found":
      return "That invitation could not be found.";
    case "not_pending":
      return "This invitation can no longer be changed.";
    case "email_failed":
      return "The invitation email could not be sent. Try again in a moment.";
    case "missing_site_url":
      return "Invitation email isn’t configured yet. Set PUBLIC_SITE_URL on the Edge Function.";
    case "not_allowed":
      return "You don’t have permission to perform this action.";
    case "LAST_ADMIN":
      return "An active administrator must remain on the account.";
    case "IS_CLIENT":
      return "This invitation can’t be accepted with a client portal account.";
    case "ALREADY_STAFF":
      return "This email already belongs to an active team member.";
    case "network":
      return "We couldn’t reach the server. Check your connection and try again.";
    default:
      return "This team member could not be updated.";
  }
}

export function previewStaffState(state: string | null | undefined): InvitationPreviewState {
  if (state === "valid" || state === "expired" || state === "revoked" || state === "accepted" || state === "invalid") {
    return state;
  }
  return "invalid";
}
