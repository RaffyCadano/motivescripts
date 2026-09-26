import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarClock, CheckCircle2, Clock, Mail, Send, ShieldCheck, UserCheck, UserRound } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission, isActiveAdmin } from "@/auth/permissions";
import { initialsFromName } from "@/auth/userDisplay";
import { adminDangerBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { formatTeamDate } from "@/data/team";
import { inviteExpiryLabel } from "@/data/teamInvite";
import { revokeStaffInvitation, sendStaffInvitation } from "@/data/teamRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

const NEXT_STEPS = [
  { icon: Mail, title: "They get an email", body: "A secure link, sent to the address above." },
  { icon: UserCheck, title: "They accept and sign in", body: "The link only works for that exact email." },
  { icon: UserRound, title: "They fill in a welcome form", body: "Contact and payout details, plus the working agreement." },
  { icon: CheckCircle2, title: "Their workspace opens", body: "They see only what their role and access allow." },
];

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-[var(--admin-muted)]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-[var(--admin-ink)]">{children}</dd>
    </div>
  );
}

export function AdminTeamInviteDetails() {
  const { invitationId = "" } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data, status, reload } = useTeamDirectory();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const canManage = isActiveAdmin(profile);
  const canView = hasPermission(profile, "team.view");
  const invitation = data?.invitations.find((item) => item.id === invitationId) ?? null;

  const accessLabels = useMemo(() => {
    const labels = new Map((data?.catalog.permissions ?? []).map((item) => [item.code, item.label]));
    return (invitation?.permissionCodes ?? [])
      .filter((code) => code !== "team.view" && code !== "team.manage")
      .map((code) => labels.get(code) ?? code);
  }, [data?.catalog.permissions, invitation?.permissionCodes]);

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
      setMessage({ text: `Invitation sent again to ${invitation.email}.`, ok: true });
    } catch (caught) {
      setMessage({ text: caught instanceof AgencyDbError ? caught.message : "Unable to send this invitation.", ok: false });
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
      setConfirmRevoke(false);
      setMessage({ text: caught instanceof AgencyDbError ? caught.message : "This invitation can no longer be changed.", ok: false });
      setBusy(false);
    }
  }

  const pending = invitation.status === "pending";
  const expiry = inviteExpiryLabel(invitation.expiresAt);
  const statusLabel = pending ? (expiry.expired ? "Invitation expired" : "Invitation pending") : `Invitation ${invitation.status}`;
  const attention = !pending || expiry.expired;

  return (
    <div className="space-y-6">
      <nav className="text-[12px] font-medium text-[var(--admin-muted)]" aria-label="Breadcrumb">
        <Link to="/admin/team" className="text-[var(--admin-blue)] hover:underline">
          Team
        </Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        Invitations
      </nav>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--admin-navy)] font-heading text-lg font-semibold text-white"
            >
              {initialsFromName(invitation.inviteeName || invitation.email)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-heading text-[1.5rem] font-semibold tracking-tight md:text-[1.75rem]">
                  {invitation.inviteeName || invitation.email}
                </h1>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-heading text-xs font-semibold",
                    attention ? "bg-red-50 text-[#b42318] ring-1 ring-red-200" : "bg-amber-50 text-[#b45309] ring-1 ring-amber-200",
                  )}
                >
                  <Clock size={11} strokeWidth={2.2} aria-hidden="true" />
                  {statusLabel}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-[var(--admin-muted)]">
                {[invitation.jobTitle, invitation.templateLabel]
                  .filter((part, index, all) => part && all.indexOf(part) === index)
                  .join(" · ")}
              </p>
            </div>
          </div>

          {canManage && pending ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} className={adminPrimaryBtn} onClick={() => void resend()}>
                <Send size={14} strokeWidth={2.2} className="mr-2" aria-hidden="true" />
                {busy && !confirmRevoke ? "Sending…" : "Resend invitation"}
              </button>
              <button type="button" disabled={busy} className={adminDangerBtn} onClick={() => setConfirmRevoke(true)}>
                Revoke invitation
              </button>
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "mt-5 flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm",
            attention ? "bg-red-50 text-[#b42318]" : "bg-[var(--admin-bg)] text-[var(--admin-ink)]",
          )}
        >
          <CalendarClock size={16} strokeWidth={2} className="shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">{expiry.text}</span>
            <span className={attention ? "" : "text-[var(--admin-muted)]"}>
              {" "}
              · {formatTeamDate(invitation.expiresAt)}
              {expiry.expired ? ". Resend it to send a fresh link." : ""}
            </span>
          </p>
        </div>

        {message ? (
          <p role="status" className={cn("mt-3 text-sm font-medium", message.ok ? "text-emerald-700" : "text-[#b45309]")}>
            {message.text}
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
            <h2 className="font-heading text-sm font-semibold tracking-tight">Invitation details</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Detail label="Email">{invitation.email}</Detail>
              <Detail label="Job title">{invitation.jobTitle || "—"}</Detail>
              <Detail label="Role">{invitation.templateLabel}</Detail>
              <Detail label="Sent">{formatTeamDate(invitation.createdAt)}</Detail>
            </dl>
          </section>

          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} strokeWidth={2} className="text-[var(--admin-blue)]" aria-hidden="true" />
              <h2 className="font-heading text-sm font-semibold tracking-tight">Access they’ll get</h2>
            </div>
            {accessLabels.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--admin-muted)]">
                Whatever the {invitation.templateLabel} role includes by default.
              </p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {accessLabels.map((label) => (
                  <li
                    key={label}
                    className="rounded-full bg-[var(--admin-bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--admin-ink)] ring-1 ring-[var(--admin-line)]"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold tracking-tight">What happens next</h2>
          <ol className="mt-4">
            {NEXT_STEPS.map((step, index) => (
              <li key={step.title} className="relative flex gap-3.5 pb-5 last:pb-0">
                {index < NEXT_STEPS.length - 1 ? (
                  <span className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-[var(--admin-line)]" aria-hidden="true" />
                ) : null}
                <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
                  <step.icon size={15} strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{step.title}</p>
                  <p className="mt-0.5 text-[13px] text-[var(--admin-muted)]">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <ConfirmDocumentModal
        open={confirmRevoke}
        busy={busy}
        danger
        title="Revoke this invitation?"
        description={`${invitation.email} will no longer be able to accept it. You can invite them again later.`}
        actionLabel="Revoke invitation"
        cancelLabel="Go back"
        onClose={() => setConfirmRevoke(false)}
        onConfirm={() => void revoke()}
      />
    </div>
  );
}
