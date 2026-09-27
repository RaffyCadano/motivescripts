import { useEffect, useId, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import {
  DialogActions,
  DialogField,
  DialogSection,
  DialogSelect,
  dialogInputClass,
  dialogTextareaClass,
} from "@/components/admin/dialog/formKit";
import {
  clientAccountServiceLabel,
  clientAccountServices,
  clientAccountStatusLabel,
  clientAccountStatuses,
  emptyClientProjectAccountDraft,
  validateClientProjectAccountDraft,
  type ClientAccountService,
  type ClientAccountStatus,
  type ClientProjectAccount,
  type ClientProjectAccountDraft,
} from "@/data/clientProjectAccounts";

type ClientAccountFormModalProps = {
  open: boolean;
  account?: ClientProjectAccount | null;
  onClose: () => void;
  onSubmit: (draft: ClientProjectAccountDraft) => void;
};

export function ClientAccountFormModal({ open, account, onClose, onSubmit }: ClientAccountFormModalProps) {
  const formId = useId();
  const [draft, setDraft] = useState<ClientProjectAccountDraft>(emptyClientProjectAccountDraft);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDraft(
      account
        ? { service: account.service, label: account.label, loginUrl: account.loginUrl, username: account.username, status: account.status, notes: account.notes }
        : emptyClientProjectAccountDraft,
    );
  }, [account, open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validateClientProjectAccountDraft(draft);
    if (problem) {
      setError(problem);
      return;
    }
    onSubmit(draft);
    onClose();
  }

  return (
    <AdminDialog
      open={open}
      icon={KeyRound}
      title={account ? "Edit account" : "Add an account"}
      description="Where to invite the client, never a password. Add them as a collaborator on the service itself."
      onClose={onClose}
      footer={<DialogActions formId={formId} submitLabel={account ? "Save changes" : "Add account"} onCancel={onClose} />}
    >
      <form id={formId} className="space-y-5" onSubmit={handleSubmit}>
        <DialogSection title="Account">
          <div className="grid gap-4 sm:grid-cols-2">
            <DialogField label="Service" required>
              <DialogSelect
                value={draft.service}
                onChange={(event) => setDraft((current) => ({ ...current, service: event.target.value as ClientAccountService }))}
              >
                {clientAccountServices.map((service) => (
                  <option key={service} value={service}>
                    {clientAccountServiceLabel(service)}
                  </option>
                ))}
              </DialogSelect>
            </DialogField>
            <DialogField label="Status">
              <DialogSelect
                value={draft.status}
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ClientAccountStatus }))}
              >
                {clientAccountStatuses.map((status) => (
                  <option key={status} value={status}>
                    {clientAccountStatusLabel(status)}
                  </option>
                ))}
              </DialogSelect>
            </DialogField>
          </div>
          <DialogField
            label="Name"
            hint={draft.service === "other" ? "Required for a custom account, so you know what it is." : "Optional -- overrides the plain service name, e.g. “GitHub -- design repo”."}
            required={draft.service === "other"}
          >
            <input
              value={draft.label}
              onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
              placeholder={draft.service === "other" ? "e.g. Domain registrar (Namecheap)" : clientAccountServiceLabel(draft.service)}
              className={dialogInputClass}
            />
          </DialogField>
        </DialogSection>

        <DialogSection title="Where to sign in">
          <div className="space-y-4">
            <DialogField label="Login link" hint="The invite or sign-in page for this service.">
              <input
                type="url"
                value={draft.loginUrl}
                onChange={(event) => setDraft((current) => ({ ...current, loginUrl: event.target.value }))}
                placeholder="https://vercel.com/login"
                className={dialogInputClass}
              />
            </DialogField>
            <DialogField label="Username or email" hint="The address they were invited with, so you both know which login this is.">
              <input
                value={draft.username}
                onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))}
                placeholder="client@theirbusiness.com"
                className={dialogInputClass}
              />
            </DialogField>
            <DialogField label="Notes" hint="Never a password. A reminder of what role they have, or what's left to do.">
              <textarea
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
                className={dialogTextareaClass}
              />
            </DialogField>
          </div>
        </DialogSection>

        {error ? <p className="text-[13px] font-medium text-[#b42318]">{error}</p> : null}
      </form>
    </AdminDialog>
  );
}
