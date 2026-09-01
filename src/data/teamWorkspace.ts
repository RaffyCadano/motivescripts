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
  milestoneName: string;
};

export type TeamAttentionItem = {
  id: string;
  title: string;
  body: string;
  href: string;
};

export type TeamActivityItem = {
  id: string;
  projectId: string;
  projectName: string;
  description: string;
  createdAt: string;
};

export function teamProjectHref(projectId: string, options?: { tab?: string; file?: string }): string {
  const params = new URLSearchParams();
  if (options?.file) {
    params.set("tab", "files");
    params.set("file", options.file);
  } else if (options?.tab && options.tab !== "overview") {
    params.set("tab", options.tab);
  }
  const query = params.toString();
  return query ? `/team/projects/${projectId}?${query}` : `/team/projects/${projectId}`;
}

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

export function isDueSoon(task: Pick<TeamWorkTask, "status" | "dueDate">, now = new Date()): boolean {
  if (task.status === "Completed") return false;
  const bucket = dueBucket(task.dueDate, now);
  if (bucket === "today" || bucket === "tomorrow") return true;
  if (bucket !== "upcoming") return false;
  const due = new Date(`${task.dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return false;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((dueDay.getTime() - start.getTime()) / 86_400_000);
  return diff > 0 && diff <= 7;
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
        milestoneName: project.milestones.find((item) => item.id === task.milestoneId)?.name ?? "",
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
    dueSoon: tasks.filter((task) => isDueSoon(task)).length,
    inProgress: tasks.filter((task) => task.status === "In Progress").length,
    completed: tasks.filter((task) => task.status === "Completed").length,
    overdue: tasks.filter((task) => isTaskOverdue(task)).length,
    open: tasks.filter((task) => task.status !== "Completed").length,
  };
}

export function myOpenTaskCount(project: AgencyProject, userId: string, fullName: string): number {
  return project.tasks.filter((task) => isAssignedToMe(task, userId, fullName) && task.status !== "Completed").length;
}

export function collectTeamAttention(input: {
  projects: AgencyProject[];
  deliverables: { id: string; projectId: string; name: string; status: string }[];
}): TeamAttentionItem[] {
  const items: TeamAttentionItem[] = [];
  const seen = new Set<string>();
  function push(item: TeamAttentionItem) {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  }

  for (const file of input.deliverables) {
    if (file.status !== "Needs Changes") continue;
    const project = input.projects.find((item) => item.id === file.projectId);
    if (!project) continue;
    push({
      id: `file-${file.id}`,
      title: file.name,
      body: `Needs changes · ${project.name}`,
      href: teamProjectHref(file.projectId, { tab: "files", file: file.id }),
    });
  }
  for (const project of input.projects) {
    if (project.status === "Client Review") {
      push({
        id: `review-${project.id}`,
        title: project.name,
        body: "Waiting on client review",
        href: teamProjectHref(project.id),
      });
    }
  }
  return items.slice(0, 8);
}

export function collectRecentProjectActivity(projects: AgencyProject[], limit = 8): TeamActivityItem[] {
  return projects
    .flatMap((project) =>
      project.activity.map((item) => ({
        id: item.id,
        projectId: project.id,
        projectName: project.name,
        description: item.description,
        createdAt: item.createdAt,
      })),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function projectWorkload(project: AgencyProject) {
  const counts = taskCounts(project);
  return {
    ...counts,
    remaining: Math.max(0, counts.total - counts.completed),
    progress: calculateProjectProgress(project),
  };
}
