import { LogOut } from "lucide-react";
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
      icon={LogOut}
      title="Log out?"
      description="You’ll need to sign in again to get back into your account."
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] transition-colors hover:bg-[var(--admin-hover)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-5 font-heading text-sm font-semibold text-white transition-colors hover:bg-[#001a4d] disabled:opacity-50"
          >
            {busy ? "Signing out…" : "Log out"}
          </button>
        </>
      }
    >
      {null}
    </AdminDialog>
  );
}
