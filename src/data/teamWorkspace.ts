import {
  calculateProjectProgress,
  formatProjectDayShort,
  taskCounts,
  type AgencyProject,
  type AgencyTask,
  type AgencyTaskPriority,
  type AgencyTaskStatus,
} from "@/data/agencyProjects";

export type TeamWorkTask = {
  id: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string;
  status: AgencyTaskStatus;
  priority: AgencyTaskPriority;
  assignee: string;
  assignedTo: string;
  dueDate: string;
  createdAt: string;
  completedAt: string | null;
  milestoneId: string;
};

export type DueBucket = "overdue" | "today" | "tomorrow" | "upcoming" | "none";

export type TeamTaskFilter = "all" | "todo" | "progress" | "review" | "completed" | "overdue";

export function greetingFor(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function dueBucket(dueDate: string, now = new Date()): DueBucket {
  if (!dueDate) return "none";
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return "none";
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((dueDay.getTime() - start.getTime()) / 86_400_000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return "upcoming";
}

export function dueLabel(dueDate: string): string {
  const bucket = dueBucket(dueDate);
  if (bucket === "none") return "No due date";
  if (bucket === "overdue") return "Overdue";
  if (bucket === "today") return "Due Today";
  if (bucket === "tomorrow") return "Due Tomorrow";
  return `Due ${formatProjectDayShort(dueDate)}`;
}

export function isTaskOverdue(task: Pick<TeamWorkTask, "status" | "dueDate">): boolean {
  return task.status !== "Completed" && dueBucket(task.dueDate) === "overdue";
}

export function isAssignedToMe(task: AgencyTask, userId: string, fullName: string): boolean {
  if (task.assignedTo && task.assignedTo === userId) return true;
  if (!task.assignedTo && fullName.trim() && task.assignee.trim().toLowerCase() === fullName.trim().toLowerCase()) {
    return true;
  }
  return false;
}

export function collectAssignedTasks(
  projects: AgencyProject[],
  clientsById: Map<string, { businessName: string }>,
  userId: string,
  fullName: string,
): TeamWorkTask[] {
  const rows: TeamWorkTask[] = [];
  for (const project of projects) {
    if (project.archived) continue;
    for (const task of project.tasks) {
      if (!isAssignedToMe(task, userId, fullName)) continue;
      rows.push({
        id: task.id,
        projectId: project.id,
        projectName: project.name,
        clientId: project.clientId,
        clientName: clientsById.get(project.clientId)?.businessName ?? "Client",
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee,
        assignedTo: task.assignedTo,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        milestoneId: task.milestoneId,
      });
    }
  }
  return rows;
}

export function collectMyProjects(
  projects: AgencyProject[],
  assignedProjectIds: Set<string>,
  myTasks: TeamWorkTask[],
): AgencyProject[] {
  const fromTasks = new Set(myTasks.map((task) => task.projectId));
  return projects.filter(
    (project) => !project.archived && (assignedProjectIds.has(project.id) || fromTasks.has(project.id)),
  );
}

export function sortUpcomingTasks(tasks: TeamWorkTask[]): TeamWorkTask[] {
  const rank: Record<DueBucket, number> = {
    overdue: 0,
    today: 1,
    tomorrow: 2,
    upcoming: 3,
    none: 4,
  };
  return [...tasks]
    .filter((task) => task.status !== "Completed")
    .sort((a, b) => {
      const bucketDiff = rank[dueBucket(a.dueDate)] - rank[dueBucket(b.dueDate)];
      if (bucketDiff !== 0) return bucketDiff;
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return a.title.localeCompare(b.title);
    });
}

export function filterTeamTasks(
  tasks: TeamWorkTask[],
  filter: TeamTaskFilter,
  projectId: string | "All",
  priority: AgencyTaskPriority | "All",
): TeamWorkTask[] {
  return tasks.filter((task) => {
    if (projectId !== "All" && task.projectId !== projectId) return false;
    if (priority !== "All" && task.priority !== priority) return false;
    if (filter === "all") return true;
    if (filter === "todo") return task.status === "Todo";
    if (filter === "progress") return task.status === "In Progress";
    if (filter === "review") return task.status === "In Review";
    if (filter === "completed") return task.status === "Completed";
    return isTaskOverdue(task);
  });
}

export function myWorkStats(tasks: TeamWorkTask[]) {
  return {
    dueToday: tasks.filter((task) => task.status !== "Completed" && dueBucket(task.dueDate) === "today").length,
    inProgress: tasks.filter((task) => task.status === "In Progress").length,
    completed: tasks.filter((task) => task.status === "Completed").length,
    overdue: tasks.filter((task) => isTaskOverdue(task)).length,
  };
}

export function projectWorkload(project: AgencyProject) {
  const counts = taskCounts(project);
  return {
    ...counts,
    remaining: Math.max(0, counts.total - counts.completed),
    progress: calculateProjectProgress(project),
  };
}
