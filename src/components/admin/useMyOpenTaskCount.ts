import { useMemo } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { collectAssignedTasks, myTasksSummaryStats } from "@/data/teamWorkspace";

export function useMyOpenTaskCount(): number {
  const { profile } = useAuth();
  const { projects } = useLeads();

  return useMemo(() => {
    if (!profile?.id) return 0;
    const clientsById = new Map<string, { businessName: string }>();
    const tasks = collectAssignedTasks(projects, clientsById, profile.id, profile.fullName ?? "");
    return myTasksSummaryStats(tasks).totalOpen;
  }, [profile?.fullName, profile?.id, projects]);
}

export function useMyTasksSummary() {
  const { profile } = useAuth();
  const { projects } = useLeads();

  return useMemo(() => {
    if (!profile?.id) {
      return { overdue: 0, dueToday: 0, upcoming: 0, totalOpen: 0 };
    }
    const clientsById = new Map(projects.map((project) => [project.clientId, { businessName: "" }]));
    const tasks = collectAssignedTasks(projects, clientsById, profile.id, profile.fullName ?? "");
    return myTasksSummaryStats(tasks);
  }, [profile?.fullName, profile?.id, projects]);
}
