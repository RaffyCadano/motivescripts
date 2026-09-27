import { CalendarClock, FileText, Flag } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
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
  milestoneStatuses,
  type AgencyMilestone,
  type AgencyMilestoneDraft,
  type AgencyMilestoneStatus,
} from "@/data/agencyProjects";


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
  const formId = useId();

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
      icon={Flag}
      title={milestone ? "Edit Milestone" : "Add Milestone"}
      description="Milestones organize website delivery from discovery through launch."
      size="xl"
      onClose={onClose}
      footer={<DialogActions formId={formId} submitLabel={milestone ? "Save changes" : "Add Milestone"} onCancel={onClose} />}
    >
      <form id={formId} className="space-y-6" onSubmit={handleSubmit}>
        <DialogSection title="Milestone" icon={FileText}>
          <div className="space-y-4">
            <DialogField label="Milestone name" required>
              <input
                required
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className={dialogInputClass}
                placeholder="For example, Design approval"
              />
            </DialogField>
            <DialogField label="Description" hint="What has to be true for this milestone to be done.">
              <textarea
                rows={3}
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                className={dialogTextareaClass}
              />
            </DialogField>
          </div>
        </DialogSection>

        <DialogSection title="Schedule" icon={CalendarClock}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DialogField label="Status" required>
              <DialogSelect
                required
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
              </DialogSelect>
            </DialogField>
            <DialogField label="Start date">
              <input
                type="date"
                value={draft.startDate}
                onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
                className={dialogInputClass}
              />
            </DialogField>
            <DialogField label="Due date">
              <input
                type="date"
                value={draft.dueDate}
                onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
                className={dialogInputClass}
              />
            </DialogField>
          </div>
        </DialogSection>
      </form>
    </AdminDialog>
  );
}
