import { useEffect, useState } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { projectStatuses, type AgencyProject, type AgencyProjectStatus } from "@/data/agencyProjects";
import { deliverableApprovalStats, type AgencyDeliverable } from "@/data/files";

type ProjectStatusModalProps = {
  project: AgencyProject | null;
  deliverables: AgencyDeliverable[];
  onClose: () => void;
  onSave: (status: AgencyProjectStatus) => void;
};

export function ProjectStatusModal({ project, deliverables, onClose, onSave }: ProjectStatusModalProps) {
  const [status, setStatus] = useState<AgencyProjectStatus>("Planning");

  useEffect(() => {
    if (project) setStatus(project.status);
  }, [project]);

  const stats = deliverableApprovalStats(deliverables);
  const unapproved = stats.total - stats.approved;
  const showWarning = status === "Completed" && unapproved > 0;

  return (
    <AdminDialog
      open={Boolean(project)}
      title="Change status"
      description={project ? `Update the delivery stage for ${project.name}.` : undefined}
      onClose={onClose}
    >
      <fieldset>
        <legend className="sr-only">Project status</legend>
        <div className="space-y-2">
          {projectStatuses.map((item) => (
            <label
              key={item}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--admin-line)] px-3 py-2.5 text-sm text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
            >
              <input type="radio" name="project-status" checked={status === item} onChange={() => setStatus(item)} />
              {item}
            </label>
          ))}
        </div>
      </fieldset>
      {showWarning ? (
        <p className="mt-4 rounded-lg border border-[rgb(180_83_9_/_0.3)] bg-[rgb(180_83_9_/_0.06)] px-3 py-2.5 text-[13px] text-[#b45309]">
          {unapproved} of {stats.total} deliverable{stats.total === 1 ? "" : "s"} on this project {unapproved === 1 ? "isn't" : "aren't"} approved yet. You can still mark it Completed — this is a reminder, not a block.
        </p>
      ) : null}
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white"
          onClick={() => onSave(status)}
        >
          Update status
        </button>
      </div>
    </AdminDialog>
  );
}
