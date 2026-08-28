import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import type { AgencyProject } from "@/data/agencyProjects";

type ConfirmArchiveProjectModalProps = {
  project: AgencyProject | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmArchiveProjectModal({ project, onClose, onConfirm }: ConfirmArchiveProjectModalProps) {
  return (
    <AdminDialog
      open={Boolean(project)}
      title="Archive this project?"
      description="Archived projects stay in the system for history. They are not deleted."
      onClose={onClose}
    >
      {project ? <p className="text-sm text-[var(--admin-muted)]">{project.name}</p> : null}
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
          Archive Project
        </button>
      </div>
    </AdminDialog>
  );
}
