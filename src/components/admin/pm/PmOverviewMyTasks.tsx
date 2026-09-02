import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MyTaskMobileList, MyTaskTable } from "@/components/admin/MyTaskList";
import { TeamTaskDetail } from "@/components/team/TeamTaskDetail";
import type { AgencyDeliverable } from "@/data/files";
import { sortMyTasks, type TeamWorkTask } from "@/data/teamWorkspace";
import { AgencyDbError } from "@/lib/dbErrors";

type PmOverviewMyTasksProps = {
  tasks: TeamWorkTask[];
  deliverables: AgencyDeliverable[];
  onStatusChange: (task: TeamWorkTask, status: TeamWorkTask["status"]) => Promise<void>;
};

export function PmOverviewMyTasks({ tasks, deliverables, onStatusChange }: PmOverviewMyTasksProps) {
  const [openTask, setOpenTask] = useState<TeamWorkTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => sortMyTasks(tasks.filter((task) => task.status !== "Completed")).slice(0, 6), [tasks]);

  async function handleStatusChange(status: TeamWorkTask["status"]) {
    if (!openTask) return;
    setBusy(true);
    setError(null);
    try {
      await onStatusChange(openTask, status);
      setOpenTask((current) => (current ? { ...current, status } : current));
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to update this task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">My Tasks</h2>
        <Link to="/admin/my-tasks" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
          View All My Tasks
        </Link>
      </div>

      {preview.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--admin-muted)]">You&apos;re all caught up. No open tasks are assigned to you.</p>
      ) : (
        <div className="mt-4">
          <MyTaskTable tasks={preview} onOpen={setOpenTask} />
          <MyTaskMobileList tasks={preview} onOpen={setOpenTask} />
        </div>
      )}

      {openTask ? (
        <TeamTaskDetail
          task={openTask}
          files={deliverables.filter((item) => item.projectId === openTask.projectId)}
          workspace="admin"
          canUpdateStatus
          busy={busy}
          error={error}
          onClose={() => {
            setOpenTask(null);
            setError(null);
          }}
          onStatusChange={(status) => void handleStatusChange(status)}
        />
      ) : null}
    </section>
  );
}
