import { useEffect, useMemo, useState } from "react";
import { AlarmClock, ArrowLeft, CalendarClock, CalendarRange, Eye, FolderKanban, PencilLine } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { firstNameFrom } from "@/auth/userDisplay";
import { OverviewAssignedProjects } from "@/components/admin/pm/OverviewAssignedProjects";
import { MetricTile, SectionLabel } from "@/components/admin/overview/kit";
import { PmAttentionQueue } from "@/components/admin/pm/PmAttentionQueue";
import { PmCharts } from "@/components/admin/pm/PmCharts";
import { PmBlockedSection } from "@/components/admin/pm/PmBlockedSection";
import { PmDiscoveryActionCenter } from "@/components/admin/pm/PmDiscoveryActionCenter";
import { PmProjectHealth } from "@/components/admin/pm/PmProjectHealth";
import { PmReviewsSection } from "@/components/admin/pm/PmReviewsSection";
import { PmTaskListSection } from "@/components/admin/pm/PmTaskListSection";
import { PmTeamMembers, pmTeamMembers } from "@/components/admin/pm/PmTeamMembers";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { TeamTaskDetail } from "@/components/team/TeamTaskDetail";
import { useTeamWork } from "@/components/team/useTeamWork";
import { blockedTasks, dueThisWeekTasks } from "@/data/developerOverview";
import { fetchDiscoveryIntakes } from "@/data/discoveryIntakeRepository";
import {
  activePmProjects,
  buildPmAttentionQueue,
  buildPmDiscoveryBoard,
  buildPmDiscoveryItems,
  buildPmProjectHealth,
} from "@/data/pmOverview";
import { awaitingReview, needsAttention } from "@/data/review";
import { dueBucket, greetingFor, isTaskOverdue, myTasksSummaryStats, type TeamWorkTask } from "@/data/teamWorkspace";
import { pmFocusFromHash } from "@/data/pmFocusViews";
import { AgencyDbError } from "@/lib/dbErrors";
import { useMessaging } from "@/providers/MessagingProvider";

export function PmOverview() {
  const { profile } = useAuth();
  const { hash } = useLocation();
  const focus = pmFocusFromHash(hash);
  const { deliverables, feedback } = useLeads();
  const { clientsById, tasks, myProjects, assignmentError, changeTaskStatus } = useTeamWork();
  const { conversations } = useMessaging();
  const team = useTeamDirectory();
  const [intakes, setIntakes] = useState<Awaited<ReturnType<typeof fetchDiscoveryIntakes>>>([]);

  const [openTask, setOpenTask] = useState<TeamWorkTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchDiscoveryIntakes()
      .then((rows) => {
        if (active) setIntakes(rows);
      })
      .catch(() => {
        if (active) setIntakes([]);
      });
    return () => {
      active = false;
    };
  }, [myProjects.length]);

  const projectIds = useMemo(() => new Set(myProjects.map((project) => project.id)), [myProjects]);
  const myClientIds = useMemo(() => new Set(myProjects.map((project) => project.clientId)), [myProjects]);
  const teamMembers = useMemo(
    () => pmTeamMembers(team.data?.members ?? [], profile?.id ?? "", projectIds, myClientIds, myProjects),
    [myClientIds, myProjects, profile?.id, projectIds, team.data?.members],
  );
  const activeProjects = useMemo(() => activePmProjects(myProjects), [myProjects]);
  const projectsById = useMemo(() => new Map(myProjects.map((project) => [project.id, project])), [myProjects]);
  const taskStats = useMemo(() => myTasksSummaryStats(tasks), [tasks]);
  const intakesByProject = useMemo(() => new Map(intakes.map((item) => [item.projectId, item])), [intakes]);
  const feedbackCountByProject = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of feedback) {
      if (row.status !== "Open" || !projectIds.has(row.projectId)) continue;
      counts.set(row.projectId, (counts.get(row.projectId) ?? 0) + 1);
    }
    return counts;
  }, [feedback, projectIds]);

  const scopedDeliverables = useMemo(
    () => deliverables.filter((item) => projectIds.has(item.projectId)),
    [deliverables, projectIds],
  );
  const needsChangesCount = useMemo(() => needsAttention(scopedDeliverables).length, [scopedDeliverables]);
  const inReviewCount = useMemo(() => awaitingReview(scopedDeliverables).length, [scopedDeliverables]);

  const dueTodayTasks = useMemo(
    () => tasks.filter((task) => task.status !== "Completed" && dueBucket(task.dueDate) === "today"),
    [tasks],
  );
  const dueThisWeek = useMemo(() => dueThisWeekTasks(tasks), [tasks]);
  const overdueTasks = useMemo(() => tasks.filter(isTaskOverdue), [tasks]);
  const blocked = useMemo(() => blockedTasks(tasks), [tasks]);

  const discoveryItems = useMemo(
    () =>
      buildPmDiscoveryItems({
        intakes,
        projects: myProjects,
        clientsById,
        projectIds,
        limit: 12,
      }),
    [clientsById, intakes, myProjects, projectIds],
  );

  const discoveryBoard = useMemo(
    () => buildPmDiscoveryBoard({ intakes, projects: myProjects, clientsById, projectIds }),
    [clientsById, intakes, myProjects, projectIds],
  );

  const attentionItems = useMemo(
    () =>
      buildPmAttentionQueue({
        tasks,
        projects: myProjects,
        projectIds,
        deliverables,
        discoveryItems,
      }),
    [deliverables, discoveryItems, myProjects, projectIds, tasks],
  );

  const health = useMemo(
    () =>
      buildPmProjectHealth({
        projects: myProjects,
        projectIds,
        clientsById,
        tasks,
        intakes,
        deliverables,
        feedback,
        conversations,
      }),
    [clientsById, conversations, deliverables, feedback, intakes, myProjects, projectIds, tasks],
  );

  const firstName = firstNameFrom(profile?.fullName || "there");

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


  const taskModal = openTask ? (
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
        onStatusChange={(status, blockedReason, qaResult, qaFailNote) =>
          void onStatusChange(status, blockedReason, qaResult, qaFailNote)
        }
      />
    ) : null;

  if (focus) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--admin-blue)] hover:underline"
          >
            <ArrowLeft size={13} strokeWidth={2.2} aria-hidden="true" />
            Overview
          </Link>
          <h1 className="mt-2 font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">{focus.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-muted)]">{focus.description}</p>
        </div>

        {assignmentError ? <p className="text-sm text-[#b45309]">{assignmentError}</p> : null}

        {focus.key === "needs-attention" ? (
          <>
            <PmAttentionQueue items={attentionItems} />
            <PmBlockedSection tasks={blocked} onOpen={setOpenTask} />
          </>
        ) : null}

        {focus.key === "today-work" ? (
          <>
            <PmTaskListSection
              id="today-work"
              icon={CalendarClock}
              title="Today's Work"
              tasks={dueTodayTasks}
              emptyTitle="Nothing due today"
              emptyBody="Nothing on your task list is due today."
              onOpen={setOpenTask}
              viewAllHref="/admin/my-tasks"
            />
            <PmTaskListSection
              id="upcoming"
              icon={CalendarRange}
              title="Due This Week"
              tasks={dueThisWeek}
              emptyTitle="Nothing else due this week"
              emptyBody="Nothing else on your task list is due in the next few days."
              onOpen={setOpenTask}
              viewAllHref="/admin/my-tasks"
            />
          </>
        ) : null}

        {focus.key === "overdue" ? (
          <PmTaskListSection
            id="overdue"
            icon={AlarmClock}
            title="Overdue"
            tasks={overdueTasks}
            emptyTitle="Nothing overdue"
            emptyBody="You're all caught up — nothing is overdue."
            onOpen={setOpenTask}
            viewAllHref="/admin/my-tasks"
          />
        ) : null}

        {focus.key === "reviews" ? (
          <PmReviewsSection deliverables={deliverables} projectIds={projectIds} projectsById={projectsById} />
        ) : null}

        {taskModal}
      </div>
    );
  }

  const attentionCount = attentionItems.length;
  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const summary =
    (attentionCount === 0
      ? "You’re all caught up. Nothing needs you right now."
      : `${attentionCount} ${attentionCount === 1 ? "thing needs" : "things need"} your attention.`) +
    (myProjects.length === 0 ? " No projects are assigned to you yet." : "");

  return (
    <div className="space-y-6">
      <header className="min-w-0">
        <p className="text-[12px] font-medium text-[var(--admin-muted)]">{todayLabel}</p>
        <h1 className="mt-1 font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">
          {greetingFor()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">{summary}</p>
      </header>

      {assignmentError ? <p className="text-sm text-[#b45309]">{assignmentError}</p> : null}

      {attentionCount > 0 ? <PmAttentionQueue items={attentionItems} /> : null}

      <section aria-label="PM key metrics">
        <SectionLabel>Today</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <MetricTile icon={FolderKanban} label="Active projects" value={activeProjects.length} href="/admin/projects" caption="In progress" />
          <MetricTile icon={CalendarClock} label="Due today" value={taskStats.dueToday} href="#today-work" caption="Tasks due today" tone={taskStats.dueToday > 0 ? "warn" : "neutral"} />
          <MetricTile
            icon={AlarmClock}
            label="Overdue"
            value={taskStats.overdue}
            href="#overdue"
            caption="Past their due date"
            tone={taskStats.overdue > 0 ? "danger" : "neutral"}
            valueTone={taskStats.overdue > 0 ? "danger" : undefined}
          />
          <MetricTile icon={PencilLine} label="Needs changes" value={needsChangesCount} href="#reviews" caption="Deliverables to revise" tone={needsChangesCount > 0 ? "warn" : "neutral"} />
          <MetricTile icon={Eye} label="In review" value={inReviewCount} href="#reviews" caption="Awaiting review" />
        </div>
      </section>

      <PmCharts projects={myProjects} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PmTaskListSection
          id="today-work"
          icon={CalendarClock}
          title="Today's Work"
          tasks={dueTodayTasks}
          emptyTitle="Nothing due today"
          emptyBody="Nothing on your task list is due today."
          onOpen={setOpenTask}
          viewAllHref="/admin/my-tasks"
        />
        <PmTaskListSection
          id="upcoming"
          icon={CalendarRange}
          title="Due This Week"
          tasks={dueThisWeek}
          emptyTitle="Nothing else this week"
          emptyBody="Nothing else on your task list is due in the next few days."
          onOpen={setOpenTask}
          viewAllHref="/admin/my-tasks"
        />
      </div>

      <OverviewAssignedProjects
        projects={myProjects}
        clientsById={clientsById}
        tasks={tasks}
        intakesByProject={intakesByProject}
        deliverables={deliverables}
        feedbackCountByProject={feedbackCountByProject}
      />

      <PmProjectHealth items={health} />

      <PmReviewsSection deliverables={deliverables} projectIds={projectIds} projectsById={projectsById} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PmTaskListSection
          id="overdue"
          icon={AlarmClock}
          title="Overdue"
          tasks={overdueTasks}
          emptyTitle="Nothing overdue"
          emptyBody="You're all caught up — nothing is overdue."
          onOpen={setOpenTask}
          viewAllHref="/admin/my-tasks"
        />
        <PmBlockedSection tasks={blocked} onOpen={setOpenTask} />
      </div>

      <PmTeamMembers members={teamMembers} />

      <PmDiscoveryActionCenter items={discoveryBoard} />

      {taskModal}
    </div>
  );
}
