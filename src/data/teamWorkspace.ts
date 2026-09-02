import {
  calculateProjectProgress,
  formatProjectDayShort,
  taskCounts,
  type AgencyProject,
  type AgencyTask,
  type AgencyTaskPriority,
  type AgencyTaskStatus,
} from "@/data/agencyProjects";
import type { TaskRecommendedRoleId } from "@/data/taskRecommendedRoles";
import type { TaskType } from "@/data/taskTypes";

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
  recommendedRole: TaskRecommendedRoleId | null;
  taskType: TaskType | null;
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

function buildProjectHref(basePath: string, projectId: string, options?: { tab?: string; file?: string }): string {
  const params = new URLSearchParams();
  if (options?.file) {
    params.set("tab", "files");
    params.set("file", options.file);
  } else if (options?.tab && options.tab !== "overview") {
    params.set("tab", options.tab);
  }
  const query = params.toString();
  return query ? `${basePath}/${projectId}?${query}` : `${basePath}/${projectId}`;
}

export function teamProjectHref(projectId: string, options?: { tab?: string; file?: string }): string {
  return buildProjectHref("/team/projects", projectId, options);
}

export function adminProjectHref(projectId: string, options?: { tab?: string; file?: string }): string {
  return buildProjectHref("/admin/projects", projectId, options);
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

export function isAssignedToMe(
  task: Pick<AgencyTask, "assignedTo" | "assignee">,
  userId: string,
  fullName: string,
): boolean {
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
        recommendedRole: task.recommendedRole,
        taskType: task.taskType,
      });
    }
  }
  return rows;
}

/**
 * Mirrors the SQL `assigned_to_project` helper: a project is "mine" if I have a direct
 * project assignment, OR I'm assigned to the project's client (client assignment implies
 * access to all of that client's projects), OR I already have a task in it.
 */
export function collectMyProjects(
  projects: AgencyProject[],
  assignedProjectIds: Set<string>,
  myTasks: TeamWorkTask[],
  assignedClientIds: Set<string> = new Set(),
): AgencyProject[] {
  const fromTasks = new Set(myTasks.map((task) => task.projectId));
  return projects.filter(
    (project) =>
      !project.archived &&
      (assignedProjectIds.has(project.id) || assignedClientIds.has(project.clientId) || fromTasks.has(project.id)),
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

export type MyTasksStatusFilter = "all" | "todo" | "progress" | "completed";

export function myTasksSummaryStats(tasks: TeamWorkTask[]) {
  const open = tasks.filter((task) => task.status !== "Completed");
  return {
    overdue: open.filter((task) => dueBucket(task.dueDate) === "overdue").length,
    dueToday: open.filter((task) => dueBucket(task.dueDate) === "today").length,
    upcoming: open.filter((task) => {
      const bucket = dueBucket(task.dueDate);
      return bucket === "tomorrow" || bucket === "upcoming";
    }).length,
    totalOpen: open.length,
  };
}

export function matchesTaskSearch(task: TeamWorkTask, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [task.title, task.projectName, task.description, task.milestoneName, task.clientName].some((value) =>
    value.toLowerCase().includes(needle),
  );
}

export function sortMyTasks(tasks: TeamWorkTask[]): TeamWorkTask[] {
  function rank(task: TeamWorkTask): number {
    if (task.status === "Completed") return 10;
    const bucket = dueBucket(task.dueDate);
    if (bucket === "overdue") return 0;
    if (bucket === "today") return 1;
    if (bucket === "tomorrow") return 2;
    if (bucket === "upcoming" && isDueSoon(task)) return 3;
    if (bucket === "upcoming") return 4;
    return 5;
  }
  return [...tasks].sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return a.title.localeCompare(b.title);
  });
}

export function filterMyTasks(
  tasks: TeamWorkTask[],
  options: {
    status: MyTasksStatusFilter;
    priority: AgencyTaskPriority | "All";
    projectId: string | "All";
    phase: string | "All";
    search: string;
  },
): TeamWorkTask[] {
  return tasks.filter((task) => {
    if (!matchesTaskSearch(task, options.search)) return false;
    if (options.projectId !== "All" && task.projectId !== options.projectId) return false;
    if (options.priority !== "All" && task.priority !== options.priority) return false;
    if (options.phase !== "All") {
      const label = task.milestoneName.trim() || "Ungrouped";
      if (label !== options.phase) return false;
    }
    if (options.status === "all") return true;
    if (options.status === "todo") return task.status === "Todo";
    if (options.status === "progress") return task.status === "In Progress";
    if (options.status === "completed") return task.status === "Completed";
    return true;
  });
}

export function uniqueTaskPhases(tasks: TeamWorkTask[]): string[] {
  const phases = new Set<string>();
  for (const task of tasks) {
    phases.add(task.milestoneName.trim() || "Ungrouped");
  }
  return [...phases].sort((a, b) => a.localeCompare(b));
}

export function adminProjectTasksHref(projectId: string): string {
  return adminProjectHref(projectId, { tab: "tasks" });
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
