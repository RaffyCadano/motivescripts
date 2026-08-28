import { useEffect, useState, type FormEvent } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import {
  milestoneStatuses,
  type AgencyMilestone,
  type AgencyMilestoneDraft,
  type AgencyMilestoneStatus,
} from "@/data/agencyProjects";

const fieldClass =
  "mt-1.5 h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]";

const emptyDraft: AgencyMilestoneDraft = {
  name: "",
  description: "",
  status: "Not Started",
  startDate: "",
  dueDate: "",
};

type MilestoneFormModalProps = {
  open: boolean;
  milestone?: AgencyMilestone | null;
  onClose: () => void;
  onSubmit: (draft: AgencyMilestoneDraft) => void;
};

export function MilestoneFormModal({ open, milestone, onClose, onSubmit }: MilestoneFormModalProps) {
  const [draft, setDraft] = useState<AgencyMilestoneDraft>(emptyDraft);

  useEffect(() => {
    if (!open) return;
    if (milestone) {
      setDraft({
        name: milestone.name,
        description: milestone.description,
        status: milestone.status,
        startDate: milestone.startDate,
        dueDate: milestone.dueDate,
      });
      return;
    }
    setDraft(emptyDraft);
  }, [milestone, open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(draft);
    onClose();
  }

  return (
    <AdminDialog
      open={open}
      title={milestone ? "Edit Milestone" : "Add Milestone"}
      description="Milestones organize the project from discovery through launch."
      onClose={onClose}
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Milestone name
          <input
            required
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            className={fieldClass}
          />
        </label>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Description
          <textarea
            rows={3}
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            className="mt-1.5 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </label>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Status
          <select
            required
            className={fieldClass}
            value={draft.status}
            onChange={(event) =>
              setDraft((current) => ({ ...current, status: event.target.value as AgencyMilestoneStatus }))
            }
          >
            {milestoneStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
            Start date
            <input
              type="date"
              value={draft.startDate}
              onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
            Due date
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
              className={fieldClass}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white"
          >
            {milestone ? "Save changes" : "Add Milestone"}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
