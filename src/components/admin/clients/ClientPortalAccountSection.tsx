import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { InviteClientDialog } from "@/components/admin/clients/InviteClientDialog";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import type { AgencyClient } from "@/data/agencyClients";
import { formatClientDate, formatClientTimestamp } from "@/data/agencyClients";
import {
  portalStatusLabel,
  type InvitationRecord,
  type PortalInviteStatus,
} from "@/data/invitation";
import { fetchClientInvitations, revokeClientInvitation } from "@/data/invitationRepository";
import { AgencyDbError } from "@/lib/dbErrors";

type ClientPortalAccountSectionProps = {
  client: AgencyClient;
  inviteOpen: boolean;
  onInviteOpenChange: (open: boolean) => void;
};

function latestInvitation(invitations: InvitationRecord[]): InvitationRecord | null {
  return invitations[0] ?? null;
}

function statusFrom(linked: boolean, invitation: InvitationRecord | null): PortalInviteStatus {
  if (linked) return "linked";
  if (!invitation) return "not_invited";
  if (invitation.effectiveStatus === "pending") return "sent";
  if (invitation.effectiveStatus === "accepted") return "accepted";
  if (invitation.effectiveStatus === "expired") return "expired";
  return "revoked";
}

export function ClientPortalAccountSection({
  client,
  inviteOpen,
  onInviteOpenChange,
}: ClientPortalAccountSectionProps) {
  const { portalAccounts, linkPortalAccount, reload, notify } = useLeads();
  const linked = portalAccounts.filter((account) => account.clientId === client.id && account.role === "client");
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<"send" | "resend">("send");

  const loadInvites = useCallback(async () => {
    try {
      const rows = await fetchClientInvitations(client.id);
      setInvitations(rows);
    } catch {
      setInvitations([]);
    }
  }, [client.id]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const invitation = useMemo(() => latestInvitation(invitations), [invitations]);
  const pendingForLatest = invitation?.effectiveStatus === "pending" ? invitation : null;
  const status = statusFrom(linked.length > 0, invitation);

  useEffect(() => {
    if (inviteOpen && pendingForLatest && linked.length === 0) setInviteMode("resend");
  }, [inviteOpen, linked.length, pendingForLatest]);

  function openInvite(mode: "send" | "resend") {
    setInviteMode(mode);
    onInviteOpenChange(true);
  }

  async function onLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const ok = await linkPortalAccount(client.id, trimmed);
    setBusy(false);
    if (ok) setEmail("");
  }

  async function onRevoke() {
    if (!pendingForLatest) return;
    setBusy(true);
    try {
      await revokeClientInvitation(pendingForLatest.id);
      notify("Invitation revoked.");
      setRevokeOpen(false);
      await Promise.all([loadInvites(), reload()]);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to revoke this invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="portal-account"
      className="scroll-mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Portal account</h2>
          <p className="mt-1 text-[13px] text-[var(--admin-muted)]">
            Invite a client to the portal. The invitation email is the recipient — this does not change the client’s
            contact email.
          </p>
        </div>
        <span className="rounded-full bg-[var(--admin-bg)] px-2.5 py-1 font-heading text-[11px] font-semibold text-[var(--admin-ink)]">
          {portalStatusLabel(status)}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Email</dt>
          <dd className="mt-1 text-sm text-[var(--admin-ink)]">{invitation?.email ?? linked[0]?.email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Status</dt>
          <dd className="mt-1 text-sm text-[var(--admin-ink)]">{portalStatusLabel(status)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Invited</dt>
          <dd className="mt-1 text-sm text-[var(--admin-ink)]">
            {invitation
              ? `${formatClientDate(invitation.createdAt)} · ${formatClientTimestamp(invitation.createdAt)}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Accepted</dt>
          <dd className="mt-1 text-sm text-[var(--admin-ink)]">
            {invitation?.acceptedAt
              ? `${formatClientDate(invitation.acceptedAt)} · ${formatClientTimestamp(invitation.acceptedAt)}`
              : "—"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Linked</dt>
          <dd className="mt-1 text-sm text-[var(--admin-ink)]">
            {linked.length > 0
              ? linked
                  .map((account) => `${account.fullName.trim() || "Client"} (${account.email ?? account.id})`)
                  .join(", ")
              : "Not linked"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {pendingForLatest ? (
          <>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
              onClick={() => openInvite("resend")}
            >
              Resend Invitation
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--admin-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
              onClick={() => setRevokeOpen(true)}
            >
              Revoke
            </button>
          </>
        ) : null}
        {!pendingForLatest && invitation?.effectiveStatus === "expired" ? (
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
            onClick={() => openInvite("resend")}
          >
            Resend Invitation
          </button>
        ) : null}
        {!pendingForLatest && invitation?.effectiveStatus === "revoked" && linked.length === 0 ? (
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
            onClick={() => openInvite("send")}
          >
            Send New Invitation
          </button>
        ) : null}
        {status === "not_invited" ? (
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
            onClick={() => openInvite("send")}
          >
            Invite Client
          </button>
        ) : null}
        {linked.length > 0 ? (
          <>
            <p className="self-center text-sm text-[var(--admin-muted)]">Client Portal account linked</p>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--admin-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
              onClick={() => openInvite("send")}
            >
              Invite another email
            </button>
          </>
        ) : null}
        {status === "accepted" && linked.length === 0 ? (
          <p className="self-center text-sm text-[var(--admin-muted)]">Client Portal account linked</p>
        ) : null}
      </div>

      <form className="mt-5 border-t border-[var(--admin-line)] pt-4" onSubmit={onLink}>
        <p className="text-[13px] text-[var(--admin-muted)]">
          Already have an Auth user? Link it without sending a new invitation.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="portal-email">
            Account email
          </label>
          <input
            id="portal-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="client@company.com"
            className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--admin-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-60"
          >
            {busy ? "Linking…" : "Link account"}
          </button>
        </div>
      </form>

      <InviteClientDialog
        client={client}
        open={inviteOpen}
        mode={inviteMode}
        defaultEmail={invitation?.email}
        defaultName={invitation?.inviteeName}
        onClose={() => onInviteOpenChange(false)}
        onSent={async (action) => {
          notify(action === "resend" ? "New invitation sent." : "Invitation sent.");
          await Promise.all([loadInvites(), reload()]);
        }}
      />

      <AdminDialog
        open={revokeOpen}
        busy={busy}
        title="Revoke this invitation?"
        description="The invitation link will stop working. The record stays for history."
        onClose={() => setRevokeOpen(false)}
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-60"
            onClick={() => setRevokeOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => void onRevoke()}
          >
            {busy ? "Revoking…" : "Revoke"}
          </button>
        </div>
      </AdminDialog>
    </section>
  );
}
