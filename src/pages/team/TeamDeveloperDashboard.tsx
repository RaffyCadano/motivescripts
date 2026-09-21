import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { firstNameFrom } from "@/auth/userDisplay";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { MyTaskMobileList, MyTaskTable } from "@/components/admin/MyTaskList";
import { MilestoneStatusBadge } from "@/components/admin/projects/MilestoneStatusBadge";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { ClientReviewLinkOut, taskContextExtra } from "@/components/tasks/TaskWorkspace";
import { AvailabilityDot } from "@/components/team/AvailabilityDot";
import { HoursLineChart, TaskStatusBarChart } from "@/components/team/DashboardCharts";
import { TeamEmptyState } from "@/components/team/TeamEmptyState";
import { TeamProjectCard } from "@/components/team/TeamProjectCard";
import { TeamTaskDetail } from "@/components/team/TeamTaskDetail";
import { useTeamWork } from "@/components/team/useTeamWork";
import { buildCumulativeTrend } from "@/data/adminOverview";
import { earlierOpenMilestones, formatProjectDay } from "@/data/agencyProjects";
import { formatClientDate } from "@/data/agencyClients";
import {
  activeTasks,
  blockedTasks,
  developmentPhaseProgress,
  dueThisWeekTasks,
  hoursByDay,
  hoursLoggedThisWeek,
  hoursLoggedToday,
  reviewTasks,
  taskStatusCounts,
} from "@/data/developerOverview";
import { effectiveTaskType } from "@/data/taskTypes";
import { checkpointApproved } from "@/data/productionWorkflow";
import { listMyTimeEntries } from "@/data/timeEntriesRepository";
import type { TimeEntry } from "@/data/timeEntries";
import {
  greetingFor,
  inProgressCount,
  myOpenTaskCount,
  teamProjectHref,
  type TeamWorkTask,
} from "@/data/teamWorkspace";
import { currentHealthState, websiteHealthStateLabel, type WebsiteHealthCheck } from "@/data/websiteHealth";
import { fetchLatestWebsiteHealthByProject } from "@/data/websiteHealthRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

const healthTone: Record<WebsiteHealthCheck["status"] | "unknown", string> = {
  healthy: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  degraded: "bg-[rgb(245_158_11_/_0.12)] text-[#92610a]",
  down: "bg-[rgb(220_38_38_/_0.08)] text-[#b42318]",
  unknown: "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
};

export function TeamDeveloperDashboard() {
  const navigate = useNavigate();
  const { profile, clientsById, tasks, myProjects, deliverables, feedback, changeTaskStatus } = useTeamWork();
  const [openTask, setOpenTask] = useState<TeamWorkTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstName = firstNameFrom(profile?.fullName || "there");

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timeLoading, setTimeLoading] = useState(true);

  const [websiteHealth, setWebsiteHealth] = useState<Map<string, WebsiteHealthCheck>>(new Map());

  const projectsWithProductionUrl = useMemo(
    () => myProjects.filter((project) => project.development.productionUrl.trim().length > 0),
    [myProjects],
  );

  useEffect(() => {
    let cancelled = false;
    const projectIds = projectsWithProductionUrl.map((project) => project.id);
    if (projectIds.length === 0) {
      setWebsiteHealth(new Map());
      return;
    }
    fetchLatestWebsiteHealthByProject(projectIds)
      .then((result) => {
        if (!cancelled) setWebsiteHealth(result);
      })
      .catch(() => {
        // Non-fatal: the rest of the dashboard still works if this fails to load.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsWithProductionUrl.map((project) => project.id).join(",")]);

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
  const dueToday = useMemo(
    () => tasks.filter((task) => task.status !== "Completed" && task.dueDate === todayIso()),
    [tasks],
  );
  const dueThisWeek = useMemo(() => dueThisWeekTasks(tasks), [tasks]);
  const todayHours = timeLoading ? null : hoursLoggedToday(timeEntries);
  const weekHours = timeLoading ? null : hoursLoggedThisWeek(timeEntries);

  const myProjectIds = useMemo(() => new Set(myProjects.map((project) => project.id)), [myProjects]);
  const projectsById = useMemo(() => new Map(myProjects.map((project) => [project.id, project])), [myProjects]);

  const upcomingMilestones = useMemo(() => {
    return myProjects
      .flatMap((project) =>
        project.milestones
          .filter((milestone) => milestone.status !== "Completed")
          .map((milestone) => ({ project, milestone })),
      )
      .sort((a, b) => {
        if (a.milestone.dueDate && b.milestone.dueDate) return a.milestone.dueDate.localeCompare(b.milestone.dueDate);
        if (a.milestone.dueDate) return -1;
        if (b.milestone.dueDate) return 1;
        return a.milestone.order - b.milestone.order;
      })
      .slice(0, 5);
  }, [myProjects]);

  const recentFeedback = useMemo(() => {
    return [...feedback]
      .filter((item) => myProjectIds.has(item.projectId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
  }, [feedback, myProjectIds]);

  const recentlyApproved = useMemo(() => {
    return deliverables
      .filter((item) => myProjectIds.has(item.projectId) && item.status === "Approved")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5);
  }, [deliverables, myProjectIds]);

  // Each trend is a cumulative-by-day history of the same cohort as its stat,
  // built from real task timestamps, so it always ends at the count shown.
  const activeTrend = useMemo(() => buildCumulativeTrend(active.map((task) => ({ at: task.createdAt }))), [active]);
  const reviewTrend = useMemo(() => buildCumulativeTrend(inReview.map((task) => ({ at: task.createdAt }))), [inReview]);
  const blockedTrend = useMemo(() => buildCumulativeTrend(blocked.map((task) => ({ at: task.createdAt }))), [blocked]);

  const dailyHours = useMemo(() => hoursByDay(timeEntries, 14), [timeEntries]);
  const dailyHoursTotal = dailyHours.reduce((sum, day) => sum + day.hours, 0);
  const statusCounts = useMemo(() => taskStatusCounts(tasks), [tasks]);
  const totalTasks = statusCounts.reduce((sum, item) => sum + item.count, 0);

  async function onStatusChange(
    status: TeamWorkTask["status"],
    blockedReason?: string | null,
    qaResult?: string | null,
    qaFailNote?: string | null,
  ) {
    if (!openTask) return;
    setBusy(true);
    setError(null);
    try {
      await changeTaskStatus(openTask, status, blockedReason, qaResult, qaFailNote);
      setOpenTask((current) =>
        current
          ? {
              ...current,
              status,
              blockedReason: status === "Blocked" ? ((blockedReason as TeamWorkTask["blockedReason"]) ?? null) : null,
              qaResult: status === "Completed" ? ((qaResult as TeamWorkTask["qaResult"]) ?? null) : null,
              qaFailNote: status === "Completed" && qaResult === "fail" ? (qaFailNote ?? "") : "",
            }
          : current,
      );
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
          {greetingFor()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Here's what needs your attention today.</p>
      </div>

      <section aria-label="Key metrics">
        <AdminStatGrid columns={4}>
          <AdminStatCard label="Active tasks" value={active.length} href="/team/tasks" trend={activeTrend} />
          <AdminStatCard
            label="Due today"
            value={dueToday.length}
            onClick={() => document.getElementById("today-work")?.scrollIntoView({ behavior: "smooth" })}
          />
          <AdminStatCard label="In review" value={inReview.length} href="/team/qa-review" trend={reviewTrend} />
          <AdminStatCard
            label="Blocked"
            value={blocked.length}
            href="/team/blocked"
            trend={blockedTrend}
            higherIsBetter={false}
          />
        </AdminStatGrid>
      </section>

      <section aria-label="Charts" className="grid items-start gap-3 lg:grid-cols-[1.65fr_1fr]">
        <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-sm font-semibold tracking-tight">Hours logged</h2>
              <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                {timeLoading ? "Loading…" : `${todayHours}h today · ${weekHours}h this week · last 14 days`}
              </p>
            </div>
            <Link to="/team/time" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
              View time tracking
            </Link>
          </div>
          <div className="mt-3">
            {timeLoading ? (
              <div className="h-44 animate-pulse rounded-[var(--admin-radius)] bg-[var(--admin-bg)]" />
            ) : dailyHoursTotal === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--admin-muted)]">No hours logged in the last 14 days.</p>
            ) : (
              <HoursLineChart data={dailyHours} />
            )}
          </div>
        </div>

        <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-sm font-semibold tracking-tight">Tasks by status</h2>
              <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                {totalTasks} task{totalTasks === 1 ? "" : "s"} assigned to you
              </p>
            </div>
            <Link to="/team/tasks" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
              View tasks
            </Link>
          </div>
          <div className="mt-3">
            {totalTasks === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--admin-muted)]">No tasks assigned to you yet.</p>
            ) : (
              <TaskStatusBarChart data={statusCounts} />
            )}
          </div>
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
          <>
            <MyTaskTable tasks={dueToday} onOpen={setOpenTask} projectHref={(id) => teamProjectHref(id, { tab: "tasks" })} />
            <MyTaskMobileList tasks={dueToday} onOpen={setOpenTask} projectHref={(id) => teamProjectHref(id, { tab: "tasks" })} />
          </>
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
          <>
            <MyTaskTable tasks={dueThisWeek} onOpen={setOpenTask} projectHref={(id) => teamProjectHref(id, { tab: "tasks" })} />
            <MyTaskMobileList tasks={dueThisWeek} onOpen={setOpenTask} projectHref={(id) => teamProjectHref(id, { tab: "tasks" })} />
          </>
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
          <div className="grid gap-3">
            {myProjects.slice(0, 4).map((project) => {
              const projectBlockedCount = tasks.filter(
                (task) => task.projectId === project.id && task.status === "Blocked",
              ).length;
              const projectActiveCount = tasks.filter(
                (task) => task.projectId === project.id && (task.status === "Todo" || task.status === "In Progress"),
              ).length;
              const devProgress = developmentPhaseProgress(project);
              const projectDeliverables = deliverables.filter((item) => item.projectId === project.id);
              const designApproved = checkpointApproved(projectDeliverables, "overall_design");
              const devAlreadyStarted =
                project.status === "In Development" || project.status === "Client Review" || project.status === "Completed";
              const developmentUnlocked = designApproved || devAlreadyStarted || devProgress.completed > 0;
              return (
                <TeamProjectCard
                  key={project.id}
                  project={project}
                  clientName={clientsById.get(project.clientId)?.businessName ?? "Client"}
                  assignedTaskCount={myOpenTaskCount(project, profile?.id ?? "", profile?.fullName ?? "")}
                  extra={
                    <div className="mt-3 space-y-2">
                      {!developmentUnlocked ? (
                        <p className="rounded-md bg-[rgb(180_83_9_/_0.08)] px-2 py-1 text-[12px] font-medium text-[#b45309]">
                          Development is locked -- waiting for Overall Design approval.
                        </p>
                      ) : null}
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
                          <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(180_83_9_/_0.1)] px-2 py-0.5 font-heading text-xs font-semibold text-[#b45309]">
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

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Upcoming Milestones</h2>
          {upcomingMilestones.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">No open milestones on your projects.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--admin-line)]">
              {upcomingMilestones.map(({ project, milestone }) => (
                <li key={milestone.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--admin-ink)]">{milestone.name}</p>
                    <p className="truncate text-[12px] text-[var(--admin-muted)]">
                      {project.name} · {milestone.dueDate ? formatProjectDay(milestone.dueDate) : "No due date"}
                    </p>
                  </div>
                  <MilestoneStatusBadge status={milestone.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Recent Feedback</h2>
          {recentFeedback.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">No feedback on your projects yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--admin-line)]">
              {recentFeedback.map((item) => {
                const project = projectsById.get(item.projectId);
                const deliverable = deliverables.find((d) => d.id === item.deliverableId);
                return (
                  <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="truncate text-[12px] text-[var(--admin-muted)]">
                      {project?.name ?? "Project"} · {deliverable?.name ?? "Deliverable"} · {formatClientDate(item.createdAt)}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-[var(--admin-ink)]">{item.message}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Approved Deliverables</h2>
          {recentlyApproved.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">Nothing approved yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--admin-line)]">
              {recentlyApproved.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--admin-ink)]">{item.name}</p>
                    <p className="truncate text-[12px] text-[var(--admin-muted)]">
                      {projectsById.get(item.projectId)?.name ?? "Project"} · {item.category}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] text-[var(--admin-muted)]">{formatClientDate(item.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Website Health</h2>
          {projectsWithProductionUrl.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">No production websites configured on your projects.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--admin-line)]">
              {projectsWithProductionUrl.map((project) => {
                const check = websiteHealth.get(project.id);
                const state = check ? currentHealthState([check]) : "unknown";
                return (
                  <li key={project.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--admin-ink)]">{project.name}</p>
                      <p className="truncate text-[12px] text-[var(--admin-muted)]">
                        {check ? `HTTP ${check.httpStatus ?? "—"} · ${check.responseTimeMs ?? "—"} ms` : "No checks yet"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-heading text-xs font-semibold tracking-tight",
                        healthTone[state],
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                      {websiteHealthStateLabel(state)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Quick Actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/team/tasks"
            className="inline-flex h-9 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-3.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          >
            View My Tasks
          </Link>
          <Link
            to="/team/files"
            className="inline-flex h-9 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-3.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          >
            Upload File
          </Link>
          <Link
            to="/team/needs-changes"
            className="inline-flex h-9 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-3.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          >
            View Feedback
          </Link>
          <Link
            to="/team/qa-review"
            className="inline-flex h-9 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-3.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          >
            Submit Work for Review
          </Link>
        </div>
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
          extra={(() => {
            const onOpenFiles = () => {
              const projectId = openTask.projectId;
              setOpenTask(null);
              navigate(teamProjectHref(projectId, { tab: "files" }));
            };
            if (effectiveTaskType(openTask) === "client_review") {
              return <ClientReviewLinkOut onOpenFiles={onOpenFiles} />;
            }
            const project = myProjects.find((item) => item.id === openTask.projectId);
            if (!project) return undefined;
            return taskContextExtra(
              openTask,
              effectiveTaskType(openTask),
              project,
              deliverables.filter((item) => item.projectId === project.id),
              onOpenFiles,
            ) ?? undefined;
          })()}
          onClose={() => {
            setOpenTask(null);
            setError(null);
          }}
          onStatusChange={(status, blockedReason, qaResult, qaFailNote) =>
            void onStatusChange(status, blockedReason, qaResult, qaFailNote)
          }
        />
      ) : null}
    </div>
  );
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
