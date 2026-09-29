import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import type { AgencyTask } from "@/data/agencyProjects";
import type { TeamMember } from "@/data/team";
import { AgencyDbError } from "@/lib/dbErrors";

/**
 * Shown right after removing someone from a project, when they still had open tasks there --
 * lets an admin hand each one to someone else on the spot instead of it silently staying
 * assigned to a person no longer on the project. Dismissible: a task left unassigned here just
 * stays with the removed person until someone reassigns it later (from the Tasks tab).
 */
export function OrphanedTasksPanel({
  removedMemberName,
  projectId,
  projectName,
  tasks,
  candidates,
  onClose,
}: {
  removedMemberName: string;
  projectId: string;
  /** Shown as "in {projectName}" instead of "here" -- pass this when the panel isn't rendered
   * directly on that project's own page (e.g. deactivating someone account-wide, where their open
   * tasks can span several projects at once and "here" would no longer mean anything specific). */
  projectName?: string;
  tasks: AgencyTask[];
  candidates: TeamMember[];
  onClose: () => void;
}) {
  const { reassignTask } = useLeads();
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [picks, setPicks] = useState<Map<string, string>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remaining = tasks.filter((task) => !doneIds.has(task.id));
  if (remaining.length === 0) return null;

  async function assign(task: AgencyTask) {
    const userId = picks.get(task.id);
    if (!userId) return;
    const member = candidates.find((item) => item.id === userId);
    if (!member) return;
    setBusyId(task.id);
    setError(null);
    try {
      await reassignTask(projectId, task.id, userId, member.fullName || member.email);
      setDoneIds((current) => new Set(current).add(task.id));
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to reassign this task.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-[var(--admin-radius)] border border-[rgb(245_158_11_/_0.35)] bg-[#fffaf0] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <AlertTriangle size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-[#b45309]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">
              {removedMemberName} had {remaining.length} open {remaining.length === 1 ? "task" : "tasks"}{" "}
              {projectName ? `in ${projectName}` : "here"}
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
              Reassign each one now, or come back to it later from the Tasks tab — they’ll stay assigned to{" "}
              {removedMemberName} until you do.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-[var(--admin-muted)] hover:bg-white hover:text-[var(--admin-ink)]"
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {remaining.map((task) => {
          const rowBusy = busyId === task.id;
          return (
            <li key={task.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--admin-ink)]">{task.title}</span>
              <select
                aria-label={`Reassign "${task.title}" to`}
                value={picks.get(task.id) ?? ""}
                disabled={rowBusy}
                onChange={(event) => setPicks((current) => new Map(current).set(task.id, event.target.value))}
                className="h-8 rounded-lg border border-[var(--admin-line)] bg-white px-2 text-[12px] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              >
                <option value="">Reassign to…</option>
                {candidates.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName || member.email}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!picks.get(task.id) || rowBusy}
                onClick={() => void assign(task)}
                className="h-8 rounded-lg bg-[var(--admin-navy)] px-2.5 font-heading text-[12px] font-semibold text-white disabled:opacity-40"
              >
                {rowBusy ? "Assigning…" : "Assign"}
              </button>
            </li>
          );
        })}
      </ul>
      {error ? <p className="mt-2 text-[12px] text-[#b42318]">{error}</p> : null}
    </div>
  );
}
