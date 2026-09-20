import { acceptErrorCode, invitationErrorMessage } from "@/data/invitation";
import { AgencyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase } from "@/lib/supabase";

export type PendingInvitation = { kind: "staff" | "client"; label: string };

/**
 * The signed-in user's own newest pending staff/client invitation, matched on
 * their verified auth email. Lets an invitee who signed in through /login (instead of
 * the emailed link) finish the invite without needing the original token.
 * Returns null when there is nothing to accept -- including on any lookup error,
 * so the caller falls back to its normal "ask for a new invite" copy.
 */
export async function fetchMyPendingInvitation(): Promise<PendingInvitation | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("my_pending_invitation");
  if (error) {
    logDbError("load my pending invitation", error);
    return null;
  }
  const row = data?.[0];
  if (!row) return null;
  return { kind: row.invite_kind === "staff" ? "staff" : "client", label: row.invite_label };
}

export async function acceptMyPendingInvitation(): Promise<PendingInvitation["kind"]> {
  const supabase = getSupabase();
  if (!supabase) throw new AgencyDbError(invitationErrorMessage("error"));
  const { data, error } = await supabase.rpc("accept_my_pending_invitation");
  if (error) {
    logDbError("accept my pending invitation", error);
    throw new AgencyDbError(invitationErrorMessage(acceptErrorCode(error.message ?? "")), error);
  }
  return data === "staff" ? "staff" : "client";
}
