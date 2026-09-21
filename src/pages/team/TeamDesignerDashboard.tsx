import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hasPermission } from "@/auth/permissions";
import { firstNameFrom } from "@/auth/userDisplay";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { MyTaskMobileList, MyTaskTable } from "@/components/admin/MyTaskList";
import { MilestoneStatusBadge } from "@/components/admin/projects/MilestoneStatusBadge";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { ClientReviewLinkOut, taskContextExtra } from "@/components/tasks/TaskWorkspace";
import { CategoryBarChart, HoursLineChart } from "@/components/team/DashboardCharts";
import { TeamEmptyState } from "@/components/team/TeamEmptyState";
import { TeamProjectCard } from "@/components/team/TeamProjectCard";
import { TeamTaskDetail } from "@/components/team/TeamTaskDetail";
import { useTeamWork } from "@/components/team/useTeamWork";
import { buildCumulativeTrend } from "@/data/adminOverview";
import { formatClientDate } from "@/data/agencyClients";
import { earlierOpenMilestones } from "@/data/agencyProjects";
import {
  checkpointRows,
  deliverableStatusCounts,
  designPhaseProgress,
  openFeedbackFor,
  type CheckpointState,
} from "@/data/designerOverview";
import {
  activeTasks,
  dueThisWeekTasks,
  hoursByDay,
  hoursLoggedThisWeek,
  hoursLoggedToday,
  needsChangesDeliverables,
  reviewTasks,
} from "@/data/developerOverview";
import { designCheckpointLabel } from "@/data/files";
import { effectiveTaskType } from "@/data/taskTypes";
import { listMyTimeEntries } from "@/data/timeEntriesRepository";
import type { TimeEntry } from "@/data/timeEntries";
import {
  collectRecentProjectActivity,
  greetingFor,
  inProgressCount,
  myOpenTaskCount,
  teamProjectHref,
  type TeamWorkTask,
} from "@/data/teamWorkspace";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

// Status colors match the file-status badges used across the app. Every bar also has a count and a text
// label, so status is never conveyed by color alone.
const fileStatusColor = {
  Draft: "#94a3b8",
  "In Review": "#f59e0b",
  "Needs Changes": "#dc2626",
  Approved: "#10b981",
} as const;

const checkpointTone: Record<CheckpointState, string> = {
  Approved: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  "In Review": "bg-[rgb(245_158_11_/_0.12)] text-[#92610a]",
  "Needs Changes": "bg-[rgb(220_38_38_/_0.08)] text-[#b42318]",
  Draft: "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  "Not uploaded": "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
};

const cardClass = "rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5";
const cardTitleClass = "font-heading text-sm font-semibold tracking-tight";
const linkClass = "font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline";

function CheckpointBadge({ state }: { state: CheckpointState }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight",
        checkpointTone[state],
      )}
    >
      {state}
    </span>
  );
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function TeamDesignerDashboard() {
  const navigate = useNavigate();
  const { profile, clientsById, tasks, myProjects, deliverables, feedback, changeTaskStatus } = useTeamWork();
  const [openTask, setOpenTask] = useState<TeamWorkTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstName = firstNameFrom(profile?.fullName || "there");
  const canFiles = hasPermission(profile, "files.view");
  const canMessages = hasPermission(profile, "messages.view");

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

  const myProjectIds = useMemo(() => new Set(myProjects.map((project) => project.id)), [myProjects]);
  const projectsById = useMemo(() => new Map(myProjects.map((project) => [project.id, project])), [myProjects]);
  const myFiles = useMemo(
    () => deliverables.filter((item) => myProjectIds.has(item.projectId) && item.status !== "Archived"),
    [deliverables, myProjectIds],
  );

  const active = useMemo(() => activeTasks(tasks), [tasks]);
  const inReview = useMemo(() => reviewTasks(tasks), [tasks]);
  const dueToday = useMemo(
    () => tasks.filter((task) => task.status !== "Completed" && task.dueDate === todayIso()),
    [tasks],
  );
  const dueThisWeek = useMemo(() => dueThisWeekTasks(tasks), [tasks]);
  const needsChanges = useMemo(() => needsChangesDeliverables(deliverables, myProjectIds), [deliverables, myProjectIds]);
  const openFeedback = useMemo(
    () =>
      [...openFeedbackFor(feedback, myProjectIds)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [feedback, myProjectIds],
  );
  const todayHours = timeLoading ? null : hoursLoggedToday(timeEntries);
  const weekHours = timeLoading ? null : hoursLoggedThisWeek(timeEntries);

  // Trends are real cumulative-by-day histories of the same cohort as the number shown (see buildCumulativeTrend).
  const activeTrend = useMemo(() => buildCumulativeTrend(active.map((task) => ({ at: task.createdAt }))), [active]);
  const reviewTrend = useMemo(() => buildCumulativeTrend(inReview.map((task) => ({ at: task.createdAt }))), [inReview]);
  const changesTrend = useMemo(
    () => buildCumulativeTrend(needsChanges.map((item) => ({ at: item.updatedAt }))),
    [needsChanges],
  );

  const dailyHours = useMemo(() => hoursByDay(timeEntries, 14), [timeEntries]);
  const dailyHoursTotal = dailyHours.reduce((sum, day) => sum + day.hours, 0);
  const fileCounts = useMemo(() => deliverableStatusCounts(myFiles), [myFiles]);
  const totalFiles = fileCounts.reduce((sum, item) => sum + item.count, 0);

  const upcomingMilestones = useMemo(() => {
    return myProjects
      .flatMap((project) =>
        project.milestones
          .filter((milestone) => milestone.status !== "Completed")
          .map((project_milestone) => ({ project, milestone: project_milestone })),
      )
      .sort((a, b) => {
        if (a.milestone.dueDate && b.milestone.dueDate) return a.milestone.dueDate.localeCompare(b.milestone.dueDate);
        if (a.milestone.dueDate) return -1;
        if (b.milestone.dueDate) return 1;
        return a.milestone.order - b.milestone.order;
      })
      .slice(0, 5);
  }, [myProjects]);

  const recentlyApproved = useMemo(
    () =>
      myFiles
        .filter((item) => item.status === "Approved")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 5),
    [myFiles],
  );

  const recentActivity = useMemo(() => collectRecentProjectActivity(myProjects, 5), [myProjects]);
  const approvalProjects = myProjects.slice(0, 3);

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
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Here&apos;s what needs your attention today.</p>
      </div>

      <section aria-label="Key metrics">
        <AdminStatGrid columns={4}>
          <AdminStatCard label="Active tasks" value={active.length} href="/team/tasks" trend={activeTrend} />
          <AdminStatCard
            label="Due today"
            value={dueToday.length}
            onClick={() => document.getElementById("today-work")?.scrollIntoView({ behavior: "smooth" })}
          />
          <AdminStatCard label="Tasks in review" value={inReview.length} href="/team/tasks" trend={reviewTrend} />
          <AdminStatCard
            label="Files needing changes"
            value={needsChanges.length}
            href={canFiles ? "/team/files" : "/team/projects"}
            trend={changesTrend}
            higherIsBetter={false}
          />
        </AdminStatGrid>
      </section>

      <section aria-label="Charts" className="grid items-start gap-3 lg:grid-cols-[1.65fr_1fr]">
        <div className={cardClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={cardTitleClass}>Hours logged</h2>
              <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                {timeLoading ? "Loading…" : `${todayHours}h today · ${weekHours}h this week · last 14 days`}
              </p>
            </div>
            <Link to="/team/time" className={linkClass}>
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

        <div className={cardClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={cardTitleClass}>Files by status</h2>
              <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                {totalFiles} file{totalFiles === 1 ? "" : "s"} on your projects
              </p>
            </div>
            {canFiles ? (
              <Link to="/team/files" className={linkClass}>
                View files
              </Link>
            ) : null}
          </div>
          <div className="mt-3">
            {totalFiles === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--admin-muted)]">No files on your projects yet.</p>
            ) : (
              <CategoryBarChart
                ariaLabel="Files on your projects by status"
                unit="file"
                data={fileCounts.map((item) => ({
                  key: item.status,
                  label: item.status,
                  count: item.count,
                  color: fileStatusColor[item.status],
                }))}
              />
            )}
          </div>
        </div>
      </section>

      <section aria-label="Design review" className="grid items-start gap-3 lg:grid-cols-2">
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={cardTitleClass}>Design approvals</h2>
            <Link to="/team/projects" className={linkClass}>
              View projects
            </Link>
          </div>
          {approvalProjects.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">No projects yet.</p>
          ) : (
            <div className="mt-3 space-y-5">
              {approvalProjects.map((project) => {
                const rows = checkpointRows(deliverables.filter((item) => item.projectId === project.id));
                return (
                  <div key={project.id}>
                    <Link
                      to={teamProjectHref(project.id)}
                      className="text-sm font-medium text-[var(--admin-ink)] hover:text-[var(--admin-blue)] hover:underline"
                    >
                      {project.name}
                    </Link>
                    <ul className="mt-1.5 divide-y divide-[var(--admin-line)]">
                      {rows.map((row) => (
                        <li key={row.checkpoint} className="flex items-center justify-between gap-3 py-2">
                          <span className="min-w-0 truncate text-[13px] text-[var(--admin-muted)]">
                            {designCheckpointLabel(row.checkpoint)}
                          </span>
                          {row.deliverableId ? (
                            <Link
                              to={teamProjectHref(project.id, { tab: "files", file: row.deliverableId })}
                              aria-label={`${designCheckpointLabel(row.checkpoint)}: ${row.state}`}
                            >
                              <CheckpointBadge state={row.state} />
                            </Link>
                          ) : (
                            <CheckpointBadge state={row.state} />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={cardTitleClass}>Files needing changes</h2>
            {canFiles ? (
              <Link to="/team/files" className={linkClass}>
                View files
              </Link>
            ) : null}
          </div>
          {needsChanges.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">Nothing needs changes right now.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--admin-line)]">
              {needsChanges.slice(0, 5).map((item) => {
                const note = feedback
                  .filter((entry) => entry.deliverableId === item.id && entry.status === "Open")
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                return (
                  <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--admin-ink)]">{item.name}</p>
                        <p className="truncate text-[12px] text-[var(--admin-muted)]">
                          {projectsById.get(item.projectId)?.name ?? "Project"} · {item.category}
                        </p>
                      </div>
                      <Link to={teamProjectHref(item.projectId, { tab: "files", file: item.id })} className={linkClass}>
                        Open
                      </Link>
                    </div>
                    {note ? <p className="mt-1 line-clamp-2 text-[13px] text-[var(--admin-ink)]">{note.message}</p> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section id="today-work" className="scroll-mt-20 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className={cardTitleClass}>Today&apos;s Tasks</h2>
          <Link to="/team/tasks" className={linkClass}>
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
          <h2 className={cardTitleClass}>Due This Week</h2>
          <Link to="/team/tasks" className={linkClass}>
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
          <h2 className={cardTitleClass}>My Active Projects</h2>
          <Link to="/team/projects" className={linkClass}>
            View all
          </Link>
        </div>
        {myProjects.length === 0 ? (
          <TeamEmptyState title="No projects yet" body="You haven't been assigned to any projects." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {myProjects.slice(0, 4).map((project) => {
              const design = designPhaseProgress(project);
              const projectFiles = myFiles.filter((item) => item.projectId === project.id);
              const filesInReview = projectFiles.filter((item) => item.status === "In Review").length;
              const filesNeedChanges = projectFiles.filter((item) => item.status === "Needs Changes").length;
              const activeCount = tasks.filter(
                (task) => task.projectId === project.id && (task.status === "Todo" || task.status === "In Progress"),
              ).length;
              return (
                <TeamProjectCard
                  key={project.id}
                  project={project}
                  clientName={clientsById.get(project.clientId)?.businessName ?? "Client"}
                  assignedTaskCount={myOpenTaskCount(project, profile?.id ?? "", profile?.fullName ?? "")}
                  extra={
                    <div className="mt-3 space-y-2">
                      {design.total === 0 ? (
                        <p className="text-[12px] text-[var(--admin-muted)]">No design tasks yet.</p>
                      ) : (
                        <div>
                          <ProgressBar value={Math.round((design.completed / design.total) * 100)} label="Design" />
                          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                            {design.completed} / {design.total} design tasks complete
                          </p>
                        </div>
                      )}
                      <p className="text-[12px] text-[var(--admin-muted)]">
                        {activeCount} active task{activeCount === 1 ? "" : "s"} · {projectFiles.length} file
                        {projectFiles.length === 1 ? "" : "s"}
                      </p>
                      {filesInReview > 0 || filesNeedChanges > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {filesInReview > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-[rgb(245_158_11_/_0.12)] px-2 py-0.5 font-heading text-[11px] font-semibold text-[#92610a]">
                              {filesInReview} in review
                            </span>
                          ) : null}
                          {filesNeedChanges > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-[rgb(220_38_38_/_0.08)] px-2 py-0.5 font-heading text-[11px] font-semibold text-[#b42318]">
                              {filesNeedChanges} need changes
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className={cardClass}>
          <h2 className={cardTitleClass}>Upcoming Milestones</h2>
          {upcomingMilestones.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">No open milestones on your projects.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--admin-line)]">
              {upcomingMilestones.map(({ project, milestone }) => (
                <li key={milestone.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--admin-ink)]">{milestone.name}</p>
                    <p className="truncate text-[12px] text-[var(--admin-muted)]">
                      {project.name} · {milestone.dueDate ? formatClientDate(milestone.dueDate) : "No due date"}
                    </p>
                  </div>
                  <MilestoneStatusBadge status={milestone.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cardClass}>
          <h2 className={cardTitleClass}>Client Feedback</h2>
          {openFeedback.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">No open feedback on your projects.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--admin-line)]">
              {openFeedback.slice(0, 5).map((item) => {
                const file = deliverables.find((entry) => entry.id === item.deliverableId);
                return (
                  <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="truncate text-[12px] text-[var(--admin-muted)]">
                      {projectsById.get(item.projectId)?.name ?? "Project"} · {file?.name ?? "File"} ·{" "}
                      {formatClientDate(item.createdAt)}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-[var(--admin-ink)]">{item.message}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={cardClass}>
          <h2 className={cardTitleClass}>Approved Files</h2>
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

        <div className={cardClass}>
          <h2 className={cardTitleClass}>Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">Updates on your projects will appear here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--admin-line)]">
              {recentActivity.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm text-[var(--admin-ink)]">{item.description}</p>
                    <p className="mt-0.5 truncate text-[12px] text-[var(--admin-muted)]">
                      {item.projectName} · {formatClientDate(item.createdAt)}
                    </p>
                  </div>
                  <Link to={teamProjectHref(item.projectId, { tab: "activity" })} className={cn(linkClass, "shrink-0")}>
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className={cardClass}>
        <h2 className={cardTitleClass}>Quick Actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { to: "/team/tasks", label: "View My Tasks", show: true },
            { to: "/team/files", label: "Upload File", show: canFiles },
            { to: "/team/projects", label: "Open My Projects", show: true },
            { to: "/team/messages", label: "Messages", show: canMessages },
          ]
            .filter((item) => item.show)
            .map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="inline-flex h-9 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-3.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
              >
                {item.label}
              </Link>
            ))}
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
            return (
              taskContextExtra(
                openTask,
                effectiveTaskType(openTask),
                project,
                deliverables.filter((item) => item.projectId === project.id),
                onOpenFiles,
              ) ?? undefined
            );
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
