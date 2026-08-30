import { useState } from "react";
import { Link } from "react-router-dom";
import { firstNameFrom } from "@/auth/userDisplay";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { TeamTaskCard } from "@/components/team/TeamTaskCard";
import { TeamTaskDetail } from "@/components/team/TeamTaskDetail";
import { useTeamWork } from "@/components/team/useTeamWork";
import { formatProjectDay } from "@/data/agencyProjects";
import { greetingFor, projectWorkload, type TeamWorkTask } from "@/data/teamWorkspace";
import { AgencyDbError } from "@/lib/dbErrors";

export function TeamDashboard() {
  const { profile, clientsById, tasks, myProjects, deliverables, stats, upcoming, assignmentError, changeTaskStatus } =
    useTeamWork();
  const [openTask, setOpenTask] = useState<TeamWorkTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstName = firstNameFrom(profile?.fullName || "there");

  async function onStatusChange(status: TeamWorkTask["status"]) {
    if (!openTask) return;
    setBusy(true);
    setError(null);
    try {
      await changeTaskStatus(openTask, status);
      setOpenTask((current) => (current ? { ...current, status } : current));
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to update this task.");
    } finally {
      setBusy(false);
    }
  }

  const summary = [
    { id: "today", value: stats.dueToday, label: "Due Today" },
    { id: "progress", value: stats.inProgress, label: "In Progress" },
    { id: "done", value: stats.completed, label: "Completed" },
    { id: "overdue", value: stats.overdue, label: "Overdue" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">
          {greetingFor()}, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Your assigned work across MotiveScripts projects.</p>
      </div>

      {assignmentError ? <p className="text-sm text-[#b45309]">{assignmentError}</p> : null}

      <section aria-label="My work">
        <h2 className="font-heading text-sm font-semibold tracking-tight">My Work</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {summary.map((item) => (
            <article
              key={item.id}
              className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-4"
            >
              <p className="font-heading text-[1.85rem] font-semibold tracking-tight text-[var(--admin-ink)]">
                {item.value}
              </p>
              <p className="mt-1 text-[13px] text-[var(--admin-muted)]">{item.label}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Assigned Tasks</h2>
          <Link to="/team/tasks" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
            View all
          </Link>
        </div>
        {tasks.length === 0 ? (
          <EmptyState
            title="No tasks assigned"
            body="You’re all caught up. New tasks will appear here when they’re assigned to you."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {upcoming.slice(0, 4).map((task) => (
              <TeamTaskCard key={task.id} task={task} onOpen={setOpenTask} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight">My Projects</h2>
          <Link
            to="/team/projects"
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
          >
            View all
          </Link>
        </div>
        {myProjects.length === 0 ? (
          <EmptyState title="No projects yet" body="You haven’t been assigned to any projects." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {myProjects.slice(0, 4).map((project) => {
              const work = projectWorkload(project);
              const clientName = clientsById.get(project.clientId)?.businessName;
              return (
                <article
                  key={project.id}
                  className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5"
                >
                  <p className="text-[12px] text-[var(--admin-muted)]">{clientName ?? "Client"}</p>
                  <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-heading text-base font-semibold text-[var(--admin-ink)]">{project.name}</h3>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  <div className="mt-4">
                    <ProgressBar value={work.progress} label="Complete" />
                  </div>
                  <p className="mt-3 text-sm text-[var(--admin-ink)]">
                    {work.total} tasks · {work.completed} completed · {work.remaining} remaining
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Due {formatProjectDay(project.targetLaunchDate)}</p>
                  <Link
                    to={`/admin/projects/${project.id}`}
                    className="mt-4 inline-flex font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                  >
                    View Project →
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">My Upcoming Work</h2>
        {upcoming.length === 0 ? (
          <EmptyState title="No upcoming deadlines" body="Assigned tasks with due dates will show up here." />
        ) : (
          <ul className="divide-y divide-[var(--admin-line)] rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
            {upcoming.slice(0, 8).map((task) => (
              <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <button type="button" className="text-left" onClick={() => setOpenTask(task)}>
                  <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{task.title}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                    {task.clientName} · {task.projectName}
                  </p>
                </button>
                <p className="text-[12px] font-medium text-[var(--admin-muted)]">{task.status}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {openTask ? (
        <TeamTaskDetail
          task={openTask}
          files={deliverables.filter((item) => item.projectId === openTask.projectId)}
          canUpdateStatus
          busy={busy}
          error={error}
          onClose={() => {
            setOpenTask(null);
            setError(null);
          }}
          onStatusChange={(status) => void onStatusChange(status)}
        />
      ) : null}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10">
      <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--admin-muted)]">{body}</p>
    </div>
  );
}
