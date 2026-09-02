import { normalizeProductionTaskTitle } from "@/data/productionTaskInstructions";
import type { ProjectTeamSlotId } from "@/data/projectWorkspace";

export type TaskRecommendedRoleId = ProjectTeamSlotId;

export const TASK_RECOMMENDED_ROLE_OPTIONS: ReadonlyArray<{
  id: TaskRecommendedRoleId;
  label: string;
}> = [
  { id: "project_manager", label: "Project Manager" },
  { id: "designer", label: "Designer" },
  { id: "developer", label: "Developer" },
  { id: "content_writer", label: "Content Writer" },
  { id: "team_member", label: "QA / Tester" },
] as const;

const ROLE_LABELS = Object.fromEntries(TASK_RECOMMENDED_ROLE_OPTIONS.map((item) => [item.id, item.label])) as Record<
  TaskRecommendedRoleId,
  string
>;

const EXACT_TITLE_ROLES: Record<string, TaskRecommendedRoleId> = {
  "review approved scope": "project_manager",
  "confirm sitemap and requirements": "project_manager",
  "collect/confirm client content and assets": "project_manager",
  "prepare staging for client review": "project_manager",
  "establish design direction": "designer",
  "design homepage": "designer",
  "design responsive/mobile layouts": "designer",
  "implement responsive layouts": "developer",
  "integrate approved content": "developer",
  "prepare/deploy staging": "developer",
  "build homepage": "developer",
  "address requested revisions": "developer",
  "deploy production": "developer",
  "test staging website": "team_member",
  "test responsive layouts": "team_member",
  "verify production website": "team_member",
  "final qa": "team_member",
};

const TITLE_PREFIX_ROLES: Array<{ prefix: string; role: TaskRecommendedRoleId }> = [
  { prefix: "design ", role: "designer" },
  { prefix: "build ", role: "developer" },
  { prefix: "implement ", role: "developer" },
  { prefix: "add ", role: "developer" },
  { prefix: "set up ", role: "developer" },
  { prefix: "install ", role: "developer" },
  { prefix: "connect ", role: "developer" },
  { prefix: "performance ", role: "developer" },
  { prefix: "security ", role: "developer" },
  { prefix: "test ", role: "team_member" },
  { prefix: "write ", role: "content_writer" },
  { prefix: "migrate ", role: "content_writer" },
  { prefix: "prepare the contact ", role: "content_writer" },
];

export function isTaskRecommendedRoleId(value: string | null | undefined): value is TaskRecommendedRoleId {
  return TASK_RECOMMENDED_ROLE_OPTIONS.some((item) => item.id === value);
}

export function recommendedRoleLabel(role: TaskRecommendedRoleId | null | undefined): string | null {
  if (!role) return null;
  return ROLE_LABELS[role] ?? null;
}

export function recommendedRoleForTaskTitle(title: string): TaskRecommendedRoleId | null {
  const normalized = normalizeProductionTaskTitle(title);
  if (!normalized) return null;

  const exact = EXACT_TITLE_ROLES[normalized];
  if (exact) return exact;

  for (const entry of TITLE_PREFIX_ROLES) {
    if (normalized.startsWith(entry.prefix)) return entry.role;
  }

  if (normalized.includes("content") && (normalized.includes("collect") || normalized.includes("confirm"))) {
    return "project_manager";
  }

  return null;
}

export function resolveTaskRecommendedRole(task: {
  title: string;
  recommendedRole?: TaskRecommendedRoleId | null;
}): TaskRecommendedRoleId | null {
  if (task.recommendedRole) return task.recommendedRole;
  return recommendedRoleForTaskTitle(task.title);
}

export function parseStoredRecommendedRole(value: string | null | undefined): TaskRecommendedRoleId | null {
  if (isTaskRecommendedRoleId(value)) return value;
  return null;
}
