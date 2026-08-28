import { useEffect, useState, type FormEvent } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { prefillInviteEmail } from "@/data/invitation";
import type { AgencyClient } from "@/data/agencyClients";
import { sendClientInvitation } from "@/data/invitationRepository";
import { AgencyDbError } from "@/lib/dbErrors";

type InviteClientDialogProps = {
  client: AgencyClient;
  open: boolean;
  mode: "send" | "resend";
  defaultEmail?: string;
  defaultName?: string;
  onClose: () => void;
  onSent: (action: "send" | "resend") => void;
};

export function InviteClientDialog({
  client,
  open,
  mode,
  defaultEmail,
  defaultName,
  onClose,
  onSent,
}: InviteClientDialogProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail(prefillInviteEmail(defaultEmail ?? client.email));
    setFullName((defaultName ?? client.contactName).trim());
    setError(null);
    setBusy(false);
  }, [client.contactName, client.email, defaultEmail, defaultName, open]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendClientInvitation({
        clientId: client.id,
        email,
        fullName,
        action: mode,
      });
      onSent(mode);
      onClose();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to send this invitation.");
      setBusy(false);
    }
  }

  return (
    <AdminDialog
      open={open}
      busy={busy}
      title={mode === "resend" ? "Resend invitation" : "Invite Client"}
      description={
        mode === "resend"
          ? `Send a new invitation email for ${client.businessName}. The previous pending link will stop working.`
          : `Invite this person to the client portal for ${client.businessName}. They’ll receive a secure email link.`
      }
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="block font-heading text-sm font-semibold text-[var(--admin-ink)]" htmlFor="invite-email">
            Email
          </label>
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </div>
        <div>
          <label className="block font-heading text-sm font-semibold text-[var(--admin-ink)]" htmlFor="invite-name">
            Full name <span className="font-medium text-[var(--admin-muted)]">(optional)</span>
          </label>
          <input
            id="invite-name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </div>
        {error ? <p className="text-sm text-[var(--admin-muted)]">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-60"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Sending…" : mode === "resend" ? "Resend invitation" : "Send invitation"}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
