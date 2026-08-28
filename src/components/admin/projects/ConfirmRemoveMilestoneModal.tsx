import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import type { AgencyMilestone } from "@/data/agencyProjects";

type ConfirmRemoveMilestoneModalProps = {
  milestone: AgencyMilestone | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmRemoveMilestoneModal({ milestone, onClose, onConfirm }: ConfirmRemoveMilestoneModalProps) {
  return (
    <AdminDialog
      open={Boolean(milestone)}
      title="Remove this milestone?"
      description="The milestone is removed from the project. Related tasks stay on the project as ungrouped."
      onClose={onClose}
    >
      {milestone ? <p className="text-sm text-[var(--admin-muted)]">{milestone.name}</p> : null}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
          Remove Milestone
        </button>
      </div>
    </AdminDialog>
  );
}
