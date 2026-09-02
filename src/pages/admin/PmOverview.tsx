import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { firstNameFrom } from "@/auth/userDisplay";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { OverviewDiscoveryAttention } from "@/components/admin/OverviewDiscoveryAttention";
import { OverviewAssignedProjects } from "@/components/admin/pm/OverviewAssignedProjects";
import { PmClientFollowUps } from "@/components/admin/pm/PmClientFollowUps";
import { PmNextActions } from "@/components/admin/pm/PmNextActions";
import { PmOverviewMyTasks } from "@/components/admin/pm/PmOverviewMyTasks";
import { PmProjectHealth } from "@/components/admin/pm/PmProjectHealth";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useTeamWork } from "@/components/team/useTeamWork";
import { fetchDiscoveryIntakes } from "@/data/discoveryIntakeRepository";
import {
  activePmProjects,
  buildPmClientFollowUps,
  buildPmDiscoveryItems,
  buildPmDiscoveryStats,
  buildPmNextActions,
  buildPmProjectHealth,
} from "@/data/pmOverview";
import { greetingFor, isDueSoon, myTasksSummaryStats } from "@/data/teamWorkspace";
import { useMessaging } from "@/providers/MessagingProvider";

export function PmOverview() {
  const { profile } = useAuth();
  const { deliverables, feedback } = useLeads();
  const { clientsById, tasks, myProjects, assignmentError, changeTaskStatus } = useTeamWork();
  const { conversations } = useMessaging();
  const [intakes, setIntakes] = useState<Awaited<ReturnType<typeof fetchDiscoveryIntakes>>>([]);

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
  const activeProjects = useMemo(() => activePmProjects(myProjects), [myProjects]);
  const taskStats = useMemo(() => myTasksSummaryStats(tasks), [tasks]);
  const discoveryStats = useMemo(() => buildPmDiscoveryStats(intakes, projectIds), [intakes, projectIds]);
  const intakesByProject = useMemo(() => new Map(intakes.map((item) => [item.projectId, item])), [intakes]);
  const feedbackCountByProject = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of feedback) {
      if (row.status !== "Open" || !projectIds.has(row.projectId)) continue;
      counts.set(row.projectId, (counts.get(row.projectId) ?? 0) + 1);
    }
    return counts;
  }, [feedback, projectIds]);

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

  const followUps = useMemo(
    () =>
      buildPmClientFollowUps({
        projects: myProjects,
        projectIds,
        clientsById,
        deliverables,
        feedback,
        conversations,
        discoveryItems,
      }),
    [clientsById, conversations, deliverables, discoveryItems, feedback, myProjects, projectIds],
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

  const nextActions = useMemo(
    () =>
      buildPmNextActions({
        projects: myProjects,
        projectIds,
        tasks,
        discoveryItems,
        followUps,
        health,
      }),
    [discoveryItems, followUps, health, myProjects, projectIds, tasks],
  );

  const tasksDueSoon = useMemo(
    () => tasks.filter((task) => task.status !== "Completed" && isDueSoon(task)).length,
    [tasks],
  );

  const firstName = firstNameFrom(profile?.fullName || "there");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">
          {greetingFor()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">
          Here&apos;s what needs your attention across your projects.
        </p>
      </div>

      {assignmentError ? <p className="text-sm text-[#b45309]">{assignmentError}</p> : null}

      <section aria-label="PM summary">
        <AdminStatGrid columns={5}>
          <AdminStatCard label="My Active Projects" value={activeProjects.length} href="/admin/projects" />
          <AdminStatCard
            label="Discovery Awaiting Review"
            value={discoveryStats.awaitingReview + discoveryStats.underReview}
            href="/admin/projects"
          />
          <AdminStatCard label="Tasks Due Soon" value={tasksDueSoon} href="/admin/my-tasks" />
          <AdminStatCard label="Overdue Tasks" value={taskStats.overdue} href="/admin/my-tasks" />
          <AdminStatCard label="Client Follow-ups" value={followUps.length} href="/admin/messages" />
        </AdminStatGrid>
      </section>

      <OverviewAssignedProjects
        projects={myProjects}
        clientsById={clientsById}
        tasks={tasks}
        intakesByProject={intakesByProject}
        deliverables={deliverables}
        feedbackCountByProject={feedbackCountByProject}
      />

      <OverviewDiscoveryAttention projectIds={projectIds} limit={8} />

      <PmOverviewMyTasks tasks={tasks} deliverables={deliverables} onStatusChange={changeTaskStatus} />

      <PmClientFollowUps items={followUps} />

      <PmProjectHealth items={health} />

      {nextActions.length > 0 ? <PmNextActions items={nextActions} /> : null}
    </div>
  );
}
