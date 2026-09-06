import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { firstNameFrom } from "@/auth/userDisplay";
import { adminIcons } from "@/components/admin/adminIcons";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { ClientReviewLinkOut } from "@/components/tasks/TaskWorkspace";
import { TeamEmptyState } from "@/components/team/TeamEmptyState";
import { TeamProjectCard } from "@/components/team/TeamProjectCard";
import { TeamTaskCard } from "@/components/team/TeamTaskCard";
import { TeamTaskDetail } from "@/components/team/TeamTaskDetail";
import { useTeamWork } from "@/components/team/useTeamWork";
import { earlierOpenMilestones, type AgencyProject } from "@/data/agencyProjects";
import {
  activeTasks,
  blockedReason,
  blockedTasks,
  developerDeploymentRows,
  developmentPhaseProgress,
  dueThisWeekTasks,
  hoursLoggedThisWeek,
  hoursLoggedToday,
  needsChangesDeliverables,
  qaTasks,
  reviewTasks,
  type DeveloperDeploymentRow,
} from "@/data/developerOverview";
import type { AgencyDeliverable } from "@/data/files";
import type { DeploymentStatus } from "@/data/projectDevelopment";
import { formatDeploymentWhen } from "@/data/projectDevelopment";
import { effectiveTaskType } from "@/data/taskTypes";
import { listMyTimeEntries } from "@/data/timeEntriesRepository";
import type { TimeEntry } from "@/data/timeEntries";
import {
  greetingFor,
  inProgressCount,
  myOpenTaskCount,
  teamProjectHref,
  type TeamWorkTask,
} from "@/data/teamWorkspace";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

export function TeamDeveloperDashboard() {
  const navigate = useNavigate();
  const { profile, clientsById, tasks, myProjects, deliverables, changeTaskStatus } = useTeamWork();
  const [openTask, setOpenTask] = useState<TeamWorkTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstName = firstNameFrom(profile?.fullName || "there");

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timeLoading, setTimeLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!profile?.id) return;
    listMyTimeEntries(profile.id)
      .then((entries) => {
        if (!cancelled) setTimeEntries(entries);
      })
      .catch(() => {
        // Non-fatal: the rest of the dashboard still works if this fails to load.
      })
      .finally(() => {
        if (!cancelled) setTimeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const active = useMemo(() => activeTasks(tasks), [tasks]);
  const blocked = useMemo(() => blockedTasks(tasks), [tasks]);
  const inReview = useMemo(() => reviewTasks(tasks), [tasks]);
  const qa = useMemo(() => qaTasks(tasks), [tasks]);
  const dueToday = useMemo(
    () => tasks.filter((task) => task.status !== "Completed" && task.dueDate === todayIso()),
    [tasks],
  );
  const dueThisWeek = useMemo(() => dueThisWeekTasks(tasks), [tasks]);
  const deployments = useMemo(() => developerDeploymentRows(myProjects), [myProjects]);
  const myProjectIds = useMemo(() => new Set(myProjects.map((project) => project.id)), [myProjects]);
  const projectsById = useMemo(() => new Map(myProjects.map((project) => [project.id, project])), [myProjects]);
  const needsChanges = useMemo(
    () => needsChangesDeliverables(deliverables, myProjectIds),
    [deliverables, myProjectIds],
  );
  const todayHours = timeLoading ? null : hoursLoggedToday(timeEntries);
  const weekHours = timeLoading ? null : hoursLoggedThisWeek(timeEntries);

  const kpis: {
    id: string;
    value: number;
    label: string;
    caption: string;
    href: string;
    icon: keyof typeof adminIcons;
  }[] = [
    {
      id: "active",
      value: active.length,
      label: "Active Tasks",
      caption: "tasks assigned",
      href: "/team/tasks",
      icon: "tasks",
    },
    {
      id: "due-today",
      value: dueToday.length,
      label: "Due Today",
      caption: "due today",
      href: "#today-work",
      icon: "time",
    },
    {
      id: "review",
      value: inReview.length,
      label: "In Review",
      caption: "waiting for review",
      href: "#qa-review",
      icon: "activity",
    },
    {
      id: "blocked",
      value: blocked.length,
      label: "Blocked",
      caption: "need your attention",
      href: "#blocked-work",
      icon: "blocked",
    },
  ];

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">
          {greetingFor()}, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Here's what needs your attention today.</p>
      </div>

      <section aria-label="Key metrics">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {kpis.map((item) => {
            const Icon = adminIcons[item.icon];
            const cardClass =
              "group block rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-4 transition-all hover:border-[var(--admin-blue)] hover:shadow-[0_2px_10px_rgb(7_17_31_/_0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-blue)]";
            const content = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                    {item.label}
                  </p>
                  <Icon
                    size={16}
                    strokeWidth={2}
                    className="shrink-0 text-[var(--admin-muted)] transition-colors group-hover:text-[var(--admin-blue)]"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 font-heading text-[2.25rem] leading-none font-bold tracking-tight text-[var(--admin-ink)]">
                  {item.value}
                </p>
                <p className="mt-1.5 text-[12px] text-[var(--admin-muted)]">{item.caption}</p>
              </>
            );
            return item.href.startsWith("#") ? (
              <a key={item.id} href={item.href} className={cardClass}>
                {content}
              </a>
            ) : (
              <Link key={item.id} to={item.href} className={cardClass}>
                {content}
              </Link>
            );
          })}
        </div>
      </section>

      <section id="today-work" className="scroll-mt-20 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Today's Tasks</h2>
          <Link to="/team/tasks" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
            View all tasks
          </Link>
        </div>
        {dueToday.length === 0 ? (
          <TeamEmptyState title="Nothing due today" body="Tasks due today will show up here." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {dueToday.map((task) => (
              <TeamTaskCard key={task.id} task={task} onOpen={setOpenTask} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Due This Week</h2>
          <Link to="/team/tasks" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
            View all tasks
          </Link>
        </div>
        {dueThisWeek.length === 0 ? (
          <TeamEmptyState title="Nothing else due this week" body="Tasks due in the next few days will show up here." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {dueThisWeek.map((task) => (
              <TeamTaskCard key={task.id} task={task} onOpen={setOpenTask} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight">My Active Projects</h2>
          <Link to="/team/projects" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
            View all
          </Link>
        </div>
        {myProjects.length === 0 ? (
          <TeamEmptyState title="No projects yet" body="You haven't been assigned to any projects." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {myProjects.slice(0, 4).map((project) => {
              const projectBlockedCount = tasks.filter(
                (task) => task.projectId === project.id && task.status === "Blocked",
              ).length;
              const projectActiveCount = tasks.filter(
                (task) => task.projectId === project.id && (task.status === "Todo" || task.status === "In Progress"),
              ).length;
              const devProgress = developmentPhaseProgress(project);
              return (
                <TeamProjectCard
                  key={project.id}
                  project={project}
                  clientName={clientsById.get(project.clientId)?.businessName ?? "Client"}
                  assignedTaskCount={myOpenTaskCount(project, profile?.id ?? "", profile?.fullName ?? "")}
                  extra={
                    <div className="mt-3 space-y-2">
                      {devProgress.total === 0 ? (
                        <p className="text-[12px] text-[var(--admin-muted)]">No development tasks yet.</p>
                      ) : (
                        <div>
                          <ProgressBar
                            value={Math.round((devProgress.completed / devProgress.total) * 100)}
                            label="Development"
                          />
                          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                            {devProgress.completed} / {devProgress.total} development tasks complete
                          </p>
                        </div>
                      )}
                      <p className="text-[12px] text-[var(--admin-muted)]">
                        {projectActiveCount} active task{projectActiveCount === 1 ? "" : "s"}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="text-[12px] font-medium text-[var(--admin-ink)]">Deployment</span>
                        <AvailabilityDot label="Staging" available={Boolean(project.development.stagingUrl.trim())} />
                        <AvailabilityDot
                          label="Production"
                          available={Boolean(project.development.productionUrl.trim())}
                        />
                        {projectBlockedCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(180_83_9_/_0.1)] px-2 py-0.5 font-heading text-[11px] font-semibold text-[#b45309]">
                            {projectBlockedCount} blocked
                          </span>
                        ) : null}
                      </div>
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <section id="qa-review" className="scroll-mt-20 space-y-5 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-sm font-semibold tracking-tight">QA Tasks</h2>
              <CountBadge count={qa.length} />
            </div>
            <Link to="/team/tasks" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-3">
            {qa.length === 0 ? (
              <TeamEmptyState title="No QA tasks assigned to you." body="Tasks classified as QA will show up here." />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {qa.slice(0, 4).map((task) => (
                  <TeamTaskCard key={task.id} task={task} onOpen={setOpenTask} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[var(--admin-line)] pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-sm font-semibold tracking-tight">In Review</h2>
              <CountBadge count={inReview.length} />
            </div>
            <Link to="/team/tasks" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-3">
            {inReview.length === 0 ? (
              <TeamEmptyState title="Nothing is waiting for review." body="Tasks marked In Review will show up here." />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {inReview.slice(0, 4).map((task) => (
                  <TeamTaskCard key={task.id} task={task} onOpen={setOpenTask} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="needs-changes" className="scroll-mt-20 space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-sm font-semibold tracking-tight">Needs Changes</h2>
            <CountBadge count={needsChanges.length} />
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
            Client feedback/revisions require your attention.
          </p>
        </div>
        {needsChanges.length === 0 ? (
          <TeamEmptyState title="No changes requested." body="Deliverables the client asks to revise will show up here." />
        ) : (
          <ul className="divide-y divide-[var(--admin-line)] rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
            {needsChanges.map((item) => (
              <NeedsChangesRow key={item.id} deliverable={item} project={projectsById.get(item.projectId)} />
            ))}
          </ul>
        )}
      </section>

      <section id="blocked-work" className="scroll-mt-20 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Blocked</h2>
          <CountBadge count={blocked.length} />
        </div>
        {blocked.length === 0 ? (
          <TeamEmptyState title="You're all clear — no blocked work." body="Tasks marked Blocked will show up here." />
        ) : (
          <ul className="divide-y divide-[var(--admin-line)] rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
            {blocked.map((task) => (
              <li key={task.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    className="text-left font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                    onClick={() => setOpenTask(task)}
                  >
                    {task.title}
                  </button>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                    {task.projectName} · {task.priority} priority
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--admin-ink)]">
                    {blockedReason(task) ?? "No reason provided"}
                  </p>
                </div>
                <Link
                  to={teamProjectHref(task.projectId, { tab: "tasks" })}
                  className="shrink-0 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                >
                  View project
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="deployment-status" className="scroll-mt-20 space-y-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Deployment Status</h2>
        {deployments.length === 0 ? (
          <TeamEmptyState title="No deployment information available." body="Deployment status for your projects will show up here." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {deployments.map((row) => (
              <DeploymentCard key={row.projectId} row={row} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Time Tracking</h2>
          <Link to="/team/time" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
            View Time Tracking
          </Link>
        </div>
        {timeLoading ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">Loading…</p>
        ) : (
          <p className="mt-3 text-sm text-[var(--admin-ink)]">
            <span className="font-heading text-xl font-semibold">{todayHours}h</span>{" "}
            <span className="text-[var(--admin-muted)]">logged today · {weekHours}h this week</span>
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] p-4">
          <h2 className="text-[12px] font-semibold text-[var(--admin-muted)]">GitHub</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
            Not connected. Pull requests, commits, and reviews will show up here once connected.
          </p>
        </div>
        <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] p-4">
          <h2 className="text-[12px] font-semibold text-[var(--admin-muted)]">Development Activity</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
            Not connected. Recent source-control activity will show up here once connected.
          </p>
        </div>
      </section>

      {openTask ? (
        <TeamTaskDetail
          task={openTask}
          files={deliverables.filter((item) => item.projectId === openTask.projectId)}
          canUpdateStatus
          busy={busy}
          error={error}
          earlierOpen={(() => {
            const project = myProjects.find((item) => item.id === openTask.projectId);
            return project ? earlierOpenMilestones(project, openTask.milestoneId) : undefined;
          })()}
          wipCount={inProgressCount(tasks, profile?.id ?? "", profile?.fullName ?? "")}
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

function NeedsChangesRow({
  deliverable,
  project,
}: {
  deliverable: AgencyDeliverable;
  project: AgencyProject | undefined;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{deliverable.name}</p>
        <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
          {project?.name ?? "Project"} · {deliverable.category}
        </p>
      </div>
      <Link
        to={teamProjectHref(deliverable.projectId, { tab: "feedback" })}
        className="shrink-0 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
      >
        Open feedback
      </Link>
    </li>
  );
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Small pill next to a section heading showing how many items need attention -- hidden at zero. */
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--admin-bg)] px-1.5 font-heading text-[11px] font-semibold text-[var(--admin-muted)]">
      {count}
    </span>
  );
}

const deploymentStatusStyles: Record<DeploymentStatus, string> = {
  "Not deployed": "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
  Development: "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  Staging: "bg-[rgb(245_158_11_/_0.12)] text-[#b45309]",
  Production: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  "Deployment issue": "bg-[rgb(220_38_38_/_0.1)] text-[#b91c1c]",
};

function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight",
        deploymentStatusStyles[status],
      )}
    >
      {status}
    </span>
  );
}

/** 🟢 when a URL is present, ⚪ when it isn't -- never a broken link or empty button. */
function AvailabilityDot({ label, available }: { label: string; available: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-[var(--admin-muted)]">
      <span aria-hidden="true">{available ? "🟢" : "⚪"}</span>
      {label}
      {!available ? " not deployed" : ""}
    </span>
  );
}

function DeploymentCard({ row }: { row: DeveloperDeploymentRow }) {
  const { development } = row;
  return (
    <article className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{row.projectName}</p>
        <DeploymentStatusBadge status={development.deploymentStatus} />
      </div>
      <dl className="mt-3 space-y-1.5 text-[13px]">
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--admin-muted)]">Repository</dt>
          <dd className="truncate text-[var(--admin-ink)]">
            {development.repositoryUrl.trim() ? (
              <a
                href={development.repositoryUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-[var(--admin-blue)] hover:underline"
              >
                {development.repositoryBranch.trim() ? `${development.repositoryBranch} ↗` : "Open repository ↗"}
              </a>
            ) : (
              "Not set"
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--admin-muted)]">Staging</dt>
          <dd className="truncate text-[var(--admin-ink)]">
            {development.stagingUrl.trim() ? (
              <a
                href={development.stagingUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-[var(--admin-blue)] hover:underline"
              >
                Open staging ↗
              </a>
            ) : (
              "Not deployed"
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--admin-muted)]">Production</dt>
          <dd className="truncate text-[var(--admin-ink)]">
            {development.productionUrl.trim() ? (
              <a
                href={development.productionUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-[var(--admin-blue)] hover:underline"
              >
                Open production ↗
              </a>
            ) : (
              "Not deployed"
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--admin-muted)]">Last deployed</dt>
          <dd className="text-[var(--admin-ink)]">{formatDeploymentWhen(development.lastDeployedAt)}</dd>
        </div>
      </dl>
      <Link
        to={teamProjectHref(row.projectId)}
        className="mt-4 inline-flex font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
      >
        Open project →
      </Link>
    </article>
  );
}
