import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission, isActiveAdmin } from "@/auth/permissions";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { formatTeamDate } from "@/data/team";
import { revokeStaffInvitation, sendStaffInvitation } from "@/data/teamRepository";
import { AgencyDbError } from "@/lib/dbErrors";

export function AdminTeamInviteDetails() {
  const { invitationId = "" } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data, status, reload } = useTeamDirectory();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canManage = isActiveAdmin(profile);
  const canView = hasPermission(profile, "team.view");
  const invitation = data?.invitations.find((item) => item.id === invitationId) ?? null;

  if (!canView) {
    return (
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Team</h1>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">You don’t have permission to perform this action.</p>
      </div>
    );
  }

  if (status === "loading" && !data) {
    return <p className="text-sm text-[var(--admin-muted)]">Loading invitation…</p>;
  }

  if (!invitation) {
    return (
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Invitation not found</h1>
        <Link to="/admin/team" className="mt-4 inline-flex font-heading text-sm font-semibold text-[var(--admin-blue)] hover:underline">
          Back to team
        </Link>
      </div>
    );
  }

  async function resend() {
    if (!invitation || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await sendStaffInvitation({
        email: invitation.email,
        fullName: invitation.inviteeName,
        jobTitle: invitation.jobTitle,
        templateKey: invitation.templateKey,
        permissionCodes: invitation.permissionCodes,
        action: "resend",
      });
      await reload();
      setMessage("Invitation resent.");
    } catch (caught) {
      setMessage(caught instanceof AgencyDbError ? caught.message : "Unable to send this invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!invitation || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await revokeStaffInvitation(invitation.id);
      await reload();
      navigate("/admin/team", { replace: true });
    } catch (caught) {
      setMessage(caught instanceof AgencyDbError ? caught.message : "This invitation can no longer be changed.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/team" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
          Team
        </Link>
        <h1 className="mt-2 font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">
          {invitation.inviteeName || invitation.email}
        </h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Pending invitation · {invitation.templateLabel}</p>
      </div>
      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Email</dt>
            <dd className="mt-1 text-sm">{invitation.email}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Job title</dt>
            <dd className="mt-1 text-sm">{invitation.jobTitle || "—"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Expires</dt>
            <dd className="mt-1 text-sm">{formatTeamDate(invitation.expiresAt)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Created</dt>
            <dd className="mt-1 text-sm">{formatTeamDate(invitation.createdAt)}</dd>
          </div>
        </dl>
        {canManage && invitation.status === "pending" ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => void resend()}
            >
              Resend invitation
            </button>
            <button
              type="button"
              disabled={busy}
              className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold disabled:opacity-60"
              onClick={() => void revoke()}
            >
              Revoke invitation
            </button>
          </div>
        ) : null}
        {message ? <p className="mt-3 text-sm text-[var(--admin-muted)]">{message}</p> : null}
      </section>
    </div>
  );
}
