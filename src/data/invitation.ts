import type { InvitationStatus } from "@/types/database";

export const INVITE_TTL_DAYS = 7;
export const INVITE_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

export type InvitationPreviewState = "valid" | "expired" | "revoked" | "accepted" | "invalid";

export type InvitationRecord = {
  id: string;
  clientId: string;
  email: string;
  inviteeName: string;
  status: InvitationStatus;
  effectiveStatus: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

export type PortalInviteStatus =
  | "not_invited"
  | "sent"
  | "accepted"
  | "expired"
  | "revoked"
  | "linked";

export function normalizeInviteEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isInviteToken(value: string): boolean {
  return INVITE_TOKEN_PATTERN.test(value.trim());
}

export function invitePath(token: string): string {
  return `/invite/${token.trim().toLowerCase()}`;
}

export function staffInvitePath(token: string): string {
  return `/staff-invite/${token.trim().toLowerCase()}`;
}

export function safeInviteNext(next: string | null | undefined): string | null {
  if (!next) return null;
  let value = next.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep original */
  }
  const match = value.match(/^\/(invite|staff-invite)\/([0-9a-f]{64})$/i);
  if (!match) return null;
  const token = match[2].toLowerCase();
  return match[1].toLowerCase() === "staff-invite" ? staffInvitePath(token) : invitePath(token);
}

export function looksLikeInviteEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—" || trimmed === "-") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function prefillInviteEmail(value: string): string {
  return looksLikeInviteEmail(value) ? value.trim() : "";
}

export function effectiveInvitationStatus(status: InvitationStatus, expiresAt: string, now = Date.now()): InvitationStatus {
  if (status === "pending" && new Date(expiresAt).getTime() <= now) return "expired";
  return status;
}

export function portalStatusLabel(status: PortalInviteStatus): string {
  switch (status) {
    case "not_invited":
      return "Not invited";
    case "sent":
      return "Invitation sent";
    case "accepted":
      return "Invitation accepted";
    case "expired":
      return "Invitation expired";
    case "revoked":
      return "Invitation revoked";
    case "linked":
      return "Linked";
  }
}

export function invitationErrorMessage(code: string): string {
  switch (code) {
    case "pending_exists":
      return "An invitation is already pending for this email. Use Resend invitation instead.";
    case "invalid_email":
      return "Enter a valid email address.";
    case "client_not_found":
      return "That client record could not be found.";
    case "already_linked":
      return "This account is already associated with another client organization. Please contact MotiveScripts.";
    case "is_admin":
      return "That email belongs to a staff account and cannot be invited as a client.";
    case "not_found":
      return "That invitation could not be found.";
    case "not_pending":
      return "This invitation can no longer be changed.";
    case "email_failed":
      return "The invitation email could not be sent. Try again in a moment.";
    case "missing_site_url":
      return "Invitation email isn’t configured yet. Set PUBLIC_SITE_URL on the Edge Function.";
    case "not_allowed":
      return "You don’t have permission to manage invitations.";
    case "EMAIL_MISMATCH":
      return "This invitation was sent to a different email address.";
    case "ALREADY_ACCEPTED":
      return "This invitation has already been used.";
    case "EXPIRED_INVITE":
      return "This invitation has expired. Ask MotiveScripts to send a new one.";
    case "REVOKED_INVITE":
      return "This invitation is no longer valid.";
    case "INVALID_INVITE":
      return "This invitation is not valid.";
    case "ALREADY_LINKED":
      return "This account is already associated with another client organization. Please contact MotiveScripts.";
    case "IS_ADMIN":
      return "This invitation can’t be accepted with a staff account.";
    case "IS_CLIENT":
      return "This invitation can’t be accepted with a client portal account.";
    case "ALREADY_STAFF":
      return "This email already belongs to an active team member.";
    case "network":
      return "We couldn’t reach the server. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again, or contact MotiveScripts.";
  }
}

export function acceptErrorCode(message: string): string {
  const upper = message.toUpperCase();
  if (upper.includes("EMAIL_MISMATCH")) return "EMAIL_MISMATCH";
  if (upper.includes("ALREADY_ACCEPTED")) return "ALREADY_ACCEPTED";
  if (upper.includes("EXPIRED_INVITE")) return "EXPIRED_INVITE";
  if (upper.includes("REVOKED_INVITE")) return "REVOKED_INVITE";
  if (upper.includes("ALREADY_LINKED")) return "ALREADY_LINKED";
  if (upper.includes("IS_ADMIN")) return "IS_ADMIN";
  if (upper.includes("IS_CLIENT")) return "IS_CLIENT";
  if (upper.includes("ALREADY_STAFF")) return "ALREADY_STAFF";
  if (upper.includes("INVALID_INVITE")) return "INVALID_INVITE";
  if (message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("network")) {
    return "network";
  }
  return "error";
}
