import { AdminDialog } from "@/components/admin/leads/AdminDialog";

type ConfirmSignOutModalProps = {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmSignOutModal({ open, busy = false, onClose, onConfirm }: ConfirmSignOutModalProps) {
  return (
    <AdminDialog
      open={open}
      title="Log out?"
      description="You’ll need to sign in again to get back into your account."
      busy={busy}
      onClose={onClose}
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-60"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Signing out…" : "Log out"}
        </button>
      </div>
    </AdminDialog>
  );
}
