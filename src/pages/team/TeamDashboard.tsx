import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { firstNameFrom } from "@/auth/userDisplay";
import { hasPermission } from "@/auth/permissions";
import { ClientReviewLinkOut } from "@/components/tasks/TaskWorkspace";
import { TeamProjectCard } from "@/components/team/TeamProjectCard";
import { TeamTaskCard } from "@/components/team/TeamTaskCard";
import { TeamTaskDetail } from "@/components/team/TeamTaskDetail";
import { useTeamWork } from "@/components/team/useTeamWork";
import { formatProjectDay } from "@/data/agencyProjects";
import { effectiveTaskType } from "@/data/taskTypes";
import {
  collectRecentProjectActivity,
  collectTeamAttention,
  greetingFor,
  isDueSoon,
  isTaskOverdue,
  myOpenTaskCount,
  teamProjectHref,
  type TeamWorkTask,
} from "@/data/teamWorkspace";
import { AgencyDbError } from "@/lib/dbErrors";
import { useMessaging } from "@/providers/MessagingProvider";

export function TeamDashboard() {
  const navigate = useNavigate();
  const { profile, clientsById, tasks, myProjects, deliverables, stats, upcoming, assignmentError, changeTaskStatus } =
    useTeamWork();
  const { unreadMessageCount, conversations } = useMessaging();
  const [openTask, setOpenTask] = useState<TeamWorkTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstName = firstNameFrom(profile?.fullName || "there");
  const canMessages = hasPermission(profile, "messages.view");
  const dueSoon = useMemo(() => upcoming.filter((task) => isDueSoon(task)), [upcoming]);
  const overdue = useMemo(() => tasks.filter(isTaskOverdue), [tasks]);
  const attention = useMemo(
    () => collectTeamAttention({ projects: myProjects, deliverables }),
    [deliverables, myProjects],
  );
  const recent = useMemo(() => collectRecentProjectActivity(myProjects), [myProjects]);

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
    { id: "projects", value: myProjects.length, label: "My Projects" },
    { id: "open", value: stats.open, label: "Open tasks" },
    { id: "soon", value: stats.dueSoon, label: "Due soon" },
    { id: "overdue", value: stats.overdue, label: "Overdue" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">
          {greetingFor()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">What you need to work on today.</p>
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

      {attention.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Needs attention</h2>
          <ul className="divide-y divide-[var(--admin-line)] rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
            {attention.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{item.title}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{item.body}</p>
                </div>
                <Link
                  to={item.href}
                  className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canMessages && unreadMessageCount > 0 ? (
        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-4">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Messages</h2>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            {unreadMessageCount} unread message{unreadMessageCount === 1 ? "" : "s"}
            {conversations[0]?.subject ? ` · ${conversations[0].subject}` : ""}.
          </p>
          <Link
            to="/team/messages"
            className="mt-3 inline-flex font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
          >
            Open messages
          </Link>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Overdue tasks</h2>
          <Link to="/team/tasks" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
            View all
          </Link>
        </div>
        {overdue.length === 0 ? (
          <EmptyState title="Nothing overdue" body="Assigned tasks that pass their due date will show up here." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {overdue.slice(0, 4).map((task) => (
              <TeamTaskCard key={task.id} task={task} onOpen={setOpenTask} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Due soon</h2>
          <Link to="/team/tasks" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
            View all
          </Link>
        </div>
        {dueSoon.length === 0 ? (
          <EmptyState title="No upcoming due dates" body="Tasks due in the next week will show up here." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {dueSoon.slice(0, 4).map((task) => (
              <TeamTaskCard key={task.id} task={task} onOpen={setOpenTask} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Assigned tasks</h2>
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
            {myProjects.slice(0, 4).map((project) => (
              <TeamProjectCard
                key={project.id}
                project={project}
                clientName={clientsById.get(project.clientId)?.businessName ?? "Client"}
                assignedTaskCount={myOpenTaskCount(project, profile?.id ?? "", profile?.fullName ?? "")}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Recent project activity</h2>
        {recent.length === 0 ? (
          <EmptyState title="No recent activity" body="Updates on your assigned projects will appear here." />
        ) : (
          <ul className="divide-y divide-[var(--admin-line)] rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
            {recent.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm text-[var(--admin-ink)]">{item.description}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                    {item.projectName} · {formatProjectDay(item.createdAt)}
                  </p>
                </div>
                <Link
                  to={teamProjectHref(item.projectId, { tab: "activity" })}
                  className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                >
                  View
                </Link>
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
          extra={
            effectiveTaskType(openTask) === "client_review" ? (
              <ClientReviewLinkOut
                onOpenFiles={() => {
                  const projectId = openTask.projectId;
                  setOpenTask(null);
                  navigate(teamProjectHref(projectId, { tab: "files" }));
                }}
              />
            ) : undefined
          }
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
