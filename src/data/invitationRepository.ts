import { AgencyDbError } from "@/lib/dbErrors";
import { getSupabase } from "@/lib/supabase";
import {
  acceptErrorCode,
  effectiveInvitationStatus,
  invitationErrorMessage,
  isInviteToken,
  normalizeInviteEmail,
  type InvitationPreviewState,
  type InvitationRecord,
} from "@/data/invitation";
import type { InvitationPreviewRow, InvitationStatus } from "@/types/database";

const invitationSelect =
  "id, client_id, email, invitee_name, status, expires_at, accepted_at, created_at, revoked_at";

type InvitationQueryRow = {
  id: string;
  client_id: string;
  email: string;
  invitee_name: string;
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

function mapInvitation(row: InvitationQueryRow): InvitationRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    email: row.email,
    inviteeName: row.invitee_name,
    status: row.status,
    effectiveStatus: effectiveInvitationStatus(row.status, row.expires_at),
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

function requireClient() {
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase isn’t connected yet.");
  return client;
}

export async function fetchClientInvitations(clientId: string): Promise<InvitationRecord[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("client_invitations")
    .select(invitationSelect)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new AgencyDbError("Unable to load invitations.", error);
  return ((data ?? []) as InvitationQueryRow[]).map(mapInvitation);
}

export async function previewInvitation(token: string): Promise<{
  state: InvitationPreviewState;
  companyName: string | null;
}> {
  if (!isInviteToken(token)) return { state: "invalid", companyName: null };
  const client = requireClient();
  const { data, error } = await client.rpc("preview_client_invitation", { p_token: token.trim().toLowerCase() });
  if (error) throw new AgencyDbError(invitationErrorMessage("error"), error);
  const row = (Array.isArray(data) ? data[0] : data) as InvitationPreviewRow | null;
  const state = row?.state;
  if (state === "valid" || state === "expired" || state === "revoked" || state === "accepted" || state === "invalid") {
    return { state, companyName: state === "valid" ? (row?.company_name ?? null) : null };
  }
  return { state: "invalid", companyName: null };
}

export async function invitationEmailMatches(token: string, email: string): Promise<boolean | null> {
  if (!isInviteToken(token) || !email.trim()) return false;
  const client = requireClient();
  const { data, error } = await client.rpc("invitation_email_matches", {
    p_token: token.trim().toLowerCase(),
    p_email: normalizeInviteEmail(email),
  });
  if (error) return null;
  return data === true;
}

export async function acceptInvitation(token: string): Promise<void> {
  if (!isInviteToken(token)) throw new AgencyDbError(invitationErrorMessage("INVALID_INVITE"));
  const client = requireClient();
  const { error } = await client.rpc("accept_client_invitation", { p_token: token.trim().toLowerCase() });
  if (error) {
    throw new AgencyDbError(invitationErrorMessage(acceptErrorCode(error.message ?? "")), error);
  }
}

type InviteAction = "send" | "resend" | "revoke";

type InviteInvokeBody = {
  action: InviteAction;
  clientId?: string;
  email?: string;
  fullName?: string;
  invitationId?: string;
};

export async function invokeClientInvitation(body: InviteInvokeBody): Promise<void> {
  const client = requireClient();
  const { data, error } = await client.functions.invoke("client-invitation", { body });

  if (error) {
    const context =
      error && typeof error === "object" && "context" in error
        ? (error as { context?: { json?: () => Promise<unknown> } }).context
        : undefined;
    let code = "error";
    if (context && typeof context.json === "function") {
      try {
        const parsed = (await context.json()) as { error?: string };
        if (parsed?.error) code = parsed.error;
      } catch {
        /* ignore */
      }
    }
    const message = (error.message ?? "").toLowerCase();
    if (message.includes("failed to fetch") || message.includes("network")) code = "network";
    if (message.includes("not valid") || message.includes("jwt") || message.includes("401")) code = "not_allowed";
    throw new AgencyDbError(invitationErrorMessage(code), error);
  }

  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) {
    throw new AgencyDbError(invitationErrorMessage(payload?.error ?? "error"));
  }
}

export async function sendClientInvitation(input: {
  clientId: string;
  email: string;
  fullName?: string;
  action?: "send" | "resend";
}): Promise<void> {
  await invokeClientInvitation({
    action: input.action ?? "send",
    clientId: input.clientId,
    email: normalizeInviteEmail(input.email),
    fullName: input.fullName?.trim() || undefined,
  });
}

export async function revokeClientInvitation(invitationId: string): Promise<void> {
  await invokeClientInvitation({ action: "revoke", invitationId });
}
