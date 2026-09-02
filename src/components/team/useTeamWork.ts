import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { usesTeamWorkspace } from "@/auth/roles";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import type { AgencyTaskDraft, AgencyTaskStatus } from "@/data/agencyProjects";
import { fetchMyClientAssignmentIds, fetchMyProjectAssignmentIds, updateMyTaskStatus } from "@/data/teamRepository";
import {
  collectAssignedTasks,
  collectMyProjects,
  isAssignedToMe,
  myWorkStats,
  sortUpcomingTasks,
  type TeamWorkTask,
} from "@/data/teamWorkspace";

export function useTeamWork() {
  const { profile } = useAuth();
  const { clients, projects, deliverables, updateTask, reload, loadStatus } = useLeads();
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);
  const [assignedClientIds, setAssignedClientIds] = useState<string[]>([]);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    void Promise.all([fetchMyProjectAssignmentIds(profile.id), fetchMyClientAssignmentIds(profile.id)])
      .then(([projectIds, clientIds]) => {
        if (!active) return;
        setAssignedProjectIds(projectIds);
        setAssignedClientIds(clientIds);
        setAssignmentError(null);
      })
      .catch(() => {
        if (!active) return;
        setAssignmentError("Unable to load your project assignments.");
      });
    return () => {
      active = false;
    };
  }, [loadStatus, profile?.id]);

  const clientsById = useMemo(
    () => new Map(clients.map((client) => [client.id, { businessName: client.businessName }])),
    [clients],
  );

  const tasks = useMemo(
    () => collectAssignedTasks(projects, clientsById, profile?.id ?? "", profile?.fullName ?? ""),
    [clientsById, profile?.fullName, profile?.id, projects],
  );

  const myProjects = useMemo(() => {
    if (usesTeamWorkspace(profile)) {
      return projects.filter((project) => !project.archived);
    }
    return collectMyProjects(projects, new Set(assignedProjectIds), tasks, new Set(assignedClientIds));
  }, [assignedClientIds, assignedProjectIds, profile, projects, tasks]);

  const stats = useMemo(() => myWorkStats(tasks), [tasks]);
  const upcoming = useMemo(() => sortUpcomingTasks(tasks), [tasks]);
  const canManageTasks = hasPermission(profile, "projects.manage");

  async function changeTaskStatus(task: TeamWorkTask, status: AgencyTaskStatus) {
    const mine = isAssignedToMe(task, profile?.id ?? "", profile?.fullName ?? "");
    if (mine) {
      await updateMyTaskStatus(task.id, status);
      await reload();
      return;
    }
    const draft: AgencyTaskDraft = {
      title: task.title,
      description: task.description,
      milestoneId: task.milestoneId,
      status,
      priority: task.priority,
      assignee: task.assignee,
      assignedTo: task.assignedTo || profile?.id || "",
      dueDate: task.dueDate,
      recommendedRole: task.recommendedRole,
      taskType: task.taskType,
    };
    if (canManageTasks) {
      await updateTask(task.projectId, task.id, draft);
      return;
    }
    await updateMyTaskStatus(task.id, status);
    await reload();
  }

  return {
    profile,
    clientsById,
    tasks,
    myProjects,
    deliverables,
    stats,
    upcoming,
    assignmentError,
    loadStatus,
    canManageTasks,
    changeTaskStatus,
    reload,
  };
}
