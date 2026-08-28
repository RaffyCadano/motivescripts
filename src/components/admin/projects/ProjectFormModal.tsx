import { useEffect, useState, type FormEvent } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import type { AgencyClient } from "@/data/agencyClients";
import {
  projectStatuses,
  projectTypes,
  type AgencyProject,
  type AgencyProjectDraft,
  type AgencyProjectStatus,
  type AgencyProjectType,
} from "@/data/agencyProjects";

const fieldClass =
  "mt-1.5 h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]";

function emptyDraft(clientId: string): AgencyProjectDraft {
  return {
    name: "",
    clientId,
    type: "Website",
    description: "",
    status: "Planning",
    startDate: new Date().toISOString().slice(0, 10),
    targetLaunchDate: "",
  };
}

type ProjectFormModalProps = {
  mode: "add" | "edit";
  open: boolean;
  clients: AgencyClient[];
  project?: AgencyProject | null;
  lockClientId?: string;
  onClose: () => void;
  onSubmit: (draft: AgencyProjectDraft) => void;
};

export function ProjectFormModal({
  mode,
  open,
  clients,
  project,
  lockClientId,
  onClose,
  onSubmit,
}: ProjectFormModalProps) {
  const [draft, setDraft] = useState<AgencyProjectDraft>(emptyDraft(lockClientId ?? ""));

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && project) {
      setDraft({
        name: project.name,
        clientId: project.clientId,
        type: project.type,
        description: project.description,
        status: project.status,
        startDate: project.startDate,
        targetLaunchDate: project.targetLaunchDate,
      });
      return;
    }
    setDraft(emptyDraft(lockClientId ?? ""));
  }, [lockClientId, mode, open, project]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(draft);
    onClose();
  }

  return (
    <AdminDialog
      open={open}
      title={mode === "add" ? "New Project" : "Edit Project"}
      description={
        mode === "add"
          ? "Create a project record. Progress is tracked from tasks after you add them."
          : "Update this project."
      }
      onClose={onClose}
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Project name
          <input
            required
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            className={fieldClass}
          />
        </label>
        {lockClientId ? null : (
          <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
            Client
            <select
              required
              className={fieldClass}
              value={draft.clientId}
              onChange={(event) => setDraft((current) => ({ ...current, clientId: event.target.value }))}
            >
              <option value="" disabled>
                Select a client
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.businessName}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
            Project type
            <select
              required
              className={fieldClass}
              value={draft.type}
              onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as AgencyProjectType }))}
            >
              {projectTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
            Status
            <select
              required
              className={fieldClass}
              value={draft.status}
              onChange={(event) =>
                setDraft((current) => ({ ...current, status: event.target.value as AgencyProjectStatus }))
              }
            >
              {projectStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Description
          <textarea
            required
            rows={3}
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            className="mt-1.5 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
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
            Target launch date
            <input
              type="date"
              value={draft.targetLaunchDate}
              onChange={(event) => setDraft((current) => ({ ...current, targetLaunchDate: event.target.value }))}
              className={fieldClass}
            />
          </label>
        </div>
        {mode === "add" ? (
          <p className="text-[12px] text-[var(--admin-muted)]">New projects start in Planning unless you choose another status.</p>
        ) : null}
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
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--admin-bright)]"
          >
            {mode === "add" ? "Create Project" : "Save changes"}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
