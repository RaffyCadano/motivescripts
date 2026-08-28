import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import type { Lead } from "@/data/leads";

type ConfirmLostModalProps = {
  lead: Lead | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmLostModal({ lead, onClose, onConfirm }: ConfirmLostModalProps) {
  return (
    <AdminDialog
      open={Boolean(lead)}
      title="Mark this lead as Lost?"
      description="The inquiry stays in the list so you can review it later. This does not delete the record."
      onClose={onClose}
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
          onClick={onConfirm}
        >
          Mark as Lost
        </button>
      </div>
    </AdminDialog>
  );
}
