import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { firstNameFrom } from "@/auth/userDisplay";
import { adminIcons } from "@/components/admin/adminIcons";
import { OverviewAssignedProjects } from "@/components/admin/pm/OverviewAssignedProjects";
import { PmAttentionQueue } from "@/components/admin/pm/PmAttentionQueue";
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
import { AgencyDbError } from "@/lib/dbErrors";
import { useMessaging } from "@/providers/MessagingProvider";

export function PmOverview() {
  const { profile } = useAuth();
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

  async function onStatusChange(status: TeamWorkTask["status"], blockedReason?: string | null, qaResult?: string | null) {
    if (!openTask) return;
    setBusy(true);
    setError(null);
    try {
      await changeTaskStatus(openTask, status, blockedReason, qaResult);
      setOpenTask((current) => (current ? { ...current, status } : current));
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to update this task.");
    } finally {
      setBusy(false);
    }
  }

  const kpis: {
    id: string;
    value: number;
    label: string;
    caption: string;
    href: string;
    icon: keyof typeof adminIcons;
  }[] = [
    {
      id: "active-projects",
      value: activeProjects.length,
      label: "Active Projects",
      caption: "in progress",
      href: "/admin/projects",
      icon: "projects",
    },
    {
      id: "due-today",
      value: taskStats.dueToday,
      label: "Due Today",
      caption: "tasks due today",
      href: "#today-work",
      icon: "time",
    },
    {
      id: "overdue",
      value: taskStats.overdue,
      label: "Overdue",
      caption: "past due date",
      href: "#overdue",
      icon: "overdue",
    },
    {
      id: "needs-changes",
      value: needsChangesCount,
      label: "Needs Changes",
      caption: "deliverables to revise",
      href: "#reviews",
      icon: "needsChanges",
    },
    {
      id: "in-review",
      value: inReviewCount,
      label: "In Review",
      caption: "awaiting review",
      href: "#reviews",
      icon: "activity",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">
          {greetingFor()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">
          Here&apos;s what needs your attention across your projects.
        </p>
      </div>

      {assignmentError ? <p className="text-sm text-[#b45309]">{assignmentError}</p> : null}

      <section aria-label="PM key metrics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {kpis.map((item) => {
            const Icon = adminIcons[item.icon];
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
            const cardClass =
              "group block rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-4 transition-all hover:border-[var(--admin-blue)] hover:shadow-[0_2px_10px_rgb(7_17_31_/_0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-blue)]";
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

      <PmAttentionQueue items={attentionItems} />

      <PmTaskListSection
        id="today-work"
        title="Today's Work"
        tasks={dueTodayTasks}
        emptyTitle="Nothing due today"
        emptyBody="Nothing on your task list is due today."
        onOpen={setOpenTask}
        viewAllHref="/admin/my-tasks"
      />

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

      <PmTaskListSection
        id="upcoming"
        title="Due This Week"
        tasks={dueThisWeek}
        emptyTitle="Nothing else due this week"
        emptyBody="Nothing else on your task list is due in the next few days."
        onOpen={setOpenTask}
        viewAllHref="/admin/my-tasks"
      />

      <PmTaskListSection
        id="overdue"
        title="Overdue"
        tasks={overdueTasks}
        emptyTitle="Nothing overdue"
        emptyBody="You're all caught up — nothing is overdue."
        onOpen={setOpenTask}
        viewAllHref="/admin/my-tasks"
      />

      <PmBlockedSection tasks={blocked} onOpen={setOpenTask} />

      <PmTeamMembers members={teamMembers} />

      <PmDiscoveryActionCenter items={discoveryBoard} />

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
          onStatusChange={(status, blockedReason, qaResult) => void onStatusChange(status, blockedReason, qaResult)}
        />
      ) : null}
    </div>
  );
}
