import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { currentVersion, versionLabel, type AgencyDeliverable } from "@/data/files";

type ConfirmSendForReviewModalProps = {
  deliverable: AgencyDeliverable | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmSendForReviewModal({ deliverable, onClose, onConfirm }: ConfirmSendForReviewModalProps) {
  const current = deliverable ? currentVersion(deliverable) : null;
  const label = deliverable && current ? `${deliverable.name} ${versionLabel(current.versionNumber)}` : "";

  return (
    <AdminDialog
      open={Boolean(deliverable)}
      title={label ? `Send ${label} for client review?` : "Send for review?"}
      description="The client will review this current version. Older versions stay in history."
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
          Send for Review
        </button>
      </div>
    </AdminDialog>
  );
}
