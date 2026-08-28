import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import type { AgencyDeliverable } from "@/data/files";

type ConfirmArchiveDeliverableModalProps = {
  deliverable: AgencyDeliverable | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmArchiveDeliverableModal({
  deliverable,
  onClose,
  onConfirm,
}: ConfirmArchiveDeliverableModalProps) {
  return (
    <AdminDialog
      open={Boolean(deliverable)}
      title={deliverable ? `Archive ${deliverable.name}?` : "Archive deliverable?"}
      description="This will remove the deliverable from the active file list. Its version history will remain available."
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
          Archive Deliverable
        </button>
      </div>
    </AdminDialog>
  );
}
