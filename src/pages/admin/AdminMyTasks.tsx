import { useMemo, useState } from "react";
import { MyTaskMobileList, MyTaskTable } from "@/components/admin/MyTaskList";
import { useTeamWork } from "@/components/team/useTeamWork";
import { TeamTaskDetail } from "@/components/team/TeamTaskDetail";
import { taskPriorities, type AgencyTaskPriority } from "@/data/agencyProjects";
import {
  filterMyTasks,
  myTasksSummaryStats,
  sortMyTasks,
  uniqueTaskPhases,
  type MyTasksStatusFilter,
  type TeamWorkTask,
} from "@/data/teamWorkspace";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

const statusFilters: { id: MyTasksStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "todo", label: "To Do" },
  { id: "progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
];

export function AdminMyTasks() {
  const { tasks, myProjects, deliverables, changeTaskStatus } = useTeamWork();
  const [status, setStatus] = useState<MyTasksStatusFilter>("all");
  const [projectId, setProjectId] = useState<string | "All">("All");
  const [priority, setPriority] = useState<AgencyTaskPriority | "All">("All");
  const [phase, setPhase] = useState<string | "All">("All");
  const [search, setSearch] = useState("");
  const [openTask, setOpenTask] = useState<TeamWorkTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => myTasksSummaryStats(tasks), [tasks]);
  const phases = useMemo(() => uniqueTaskPhases(tasks), [tasks]);
  const projectOptions = useMemo(() => {
    const ids = new Set(tasks.map((task) => task.projectId));
    return myProjects.filter((project) => ids.has(project.id));
  }, [myProjects, tasks]);

  const visible = useMemo(
    () =>
      sortMyTasks(
        filterMyTasks(tasks, {
          status,
          priority,
          projectId,
          phase,
          search,
        }),
      ),
    [phase, priority, projectId, search, status, tasks],
  );

  async function onStatusChange(next: TeamWorkTask["status"]) {
    if (!openTask) return;
    setBusy(true);
    setError(null);
    try {
      await changeTaskStatus(openTask, next);
      setOpenTask((current) => (current ? { ...current, status: next } : current));
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to update this task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold uppercase tracking-[0.08em] md:text-3xl">My Tasks</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Tasks assigned to you across all projects.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard value={stats.overdue} label="Overdue" warn={stats.overdue > 0} />
        <SummaryCard value={stats.dueToday} label="Due Today" />
        <SummaryCard value={stats.upcoming} label="Upcoming" />
        <SummaryCard value={stats.totalOpen} label="Total Open" />
      </div>

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              status === item.id
                ? "inline-flex h-9 items-center rounded-full bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white"
                : "inline-flex h-9 items-center rounded-full border border-[var(--admin-line)] bg-white px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)]"
            }
            onClick={() => setStatus(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.6fr))]">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search tasks..."
          className="h-10 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
        />
        <select
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          className="h-10 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
        >
          <option value="All">All projects</option>
          {projectOptions.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value as AgencyTaskPriority | "All")}
          className="h-10 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
        >
          <option value="All">All priorities</option>
          {taskPriorities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={phase}
          onChange={(event) => setPhase(event.target.value)}
          className="h-10 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
        >
          <option value="All">All phases</option>
          {phases.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">You&apos;re all caught up.</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">No tasks are currently assigned to you.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No tasks match your filters.</p>
        </div>
      ) : (
        <>
          <MyTaskTable tasks={visible} onOpen={setOpenTask} />
          <MyTaskMobileList tasks={visible} onOpen={setOpenTask} />
        </>
      )}

      {openTask ? (
        <TeamTaskDetail
          task={openTask}
          files={deliverables.filter((item) => item.projectId === openTask.projectId)}
          canUpdateStatus
          workspace="admin"
          busy={busy}
          error={error}
          onClose={() => {
            setOpenTask(null);
            setError(null);
          }}
          onStatusChange={(next) => void onStatusChange(next)}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  return (
    <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-3">
      <p className={cn("font-heading text-2xl font-semibold tracking-tight", warn && "text-[#b45309]")}>{value}</p>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{label}</p>
    </div>
  );
}
