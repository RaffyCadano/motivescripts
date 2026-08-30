import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import type { AgencyTaskDraft, AgencyTaskStatus } from "@/data/agencyProjects";
import { fetchMyProjectAssignmentIds, updateMyTaskStatus } from "@/data/teamRepository";
import {
  collectAssignedTasks,
  collectMyProjects,
  myWorkStats,
  sortUpcomingTasks,
  type TeamWorkTask,
} from "@/data/teamWorkspace";

export function useTeamWork() {
  const { profile } = useAuth();
  const { clients, projects, deliverables, updateTask, reload, loadStatus } = useLeads();
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    void fetchMyProjectAssignmentIds(profile.id)
      .then((ids) => {
        if (!active) return;
        setAssignedProjectIds(ids);
        setAssignmentError(null);
      })
      .catch(() => {
        if (!active) return;
        setAssignmentError("Unable to load your project assignments.");
      });
    return () => {
      active = false;
    };
  }, [profile?.id]);

  const clientsById = useMemo(
    () => new Map(clients.map((client) => [client.id, { businessName: client.businessName }])),
    [clients],
  );

  const tasks = useMemo(
    () => collectAssignedTasks(projects, clientsById, profile?.id ?? "", profile?.fullName ?? ""),
    [clientsById, profile?.fullName, profile?.id, projects],
  );

  const myProjects = useMemo(
    () => collectMyProjects(projects, new Set(assignedProjectIds), tasks),
    [assignedProjectIds, projects, tasks],
  );

  const stats = useMemo(() => myWorkStats(tasks), [tasks]);
  const upcoming = useMemo(() => sortUpcomingTasks(tasks), [tasks]);
  const canManageTasks = hasPermission(profile, "projects.manage");

  async function changeTaskStatus(task: TeamWorkTask, status: AgencyTaskStatus) {
    const draft: AgencyTaskDraft = {
      title: task.title,
      description: task.description,
      milestoneId: task.milestoneId,
      status,
      priority: task.priority,
      assignee: task.assignee,
      assignedTo: task.assignedTo || profile?.id || "",
      dueDate: task.dueDate,
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
