export const TASK_TYPES = [
  "discovery",
  "content_collection",
  "design",
  "production",
  "client_review",
  "qa",
  "internal",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export function isTaskType(value: string | null | undefined): value is TaskType {
  return (TASK_TYPES as readonly string[]).includes(value ?? "");
}

export function taskTypeLabel(type: TaskType): string {
  switch (type) {
    case "discovery":
      return "Discovery";
    case "content_collection":
      return "Content Collection";
    case "design":
      return "Design";
    case "production":
      return "Production";
    case "client_review":
      return "Client Review";
    case "qa":
      return "QA";
    case "internal":
      return "Internal";
  }
}

const EXACT_TITLE_TYPES: Record<string, TaskType> = {
  "review approved scope": "discovery",
  "confirm sitemap and requirements": "discovery",
  "collect/confirm client content and assets": "content_collection",
  "prepare contact information": "content_collection",
  "migrate approved content": "content_collection",
  "establish design direction": "design",
  "design homepage": "design",
  "design responsive/mobile layouts": "design",
  "prepare/deploy staging": "client_review",
  "prepare staging for client review": "client_review",
  "address requested revisions": "client_review",
  "test staging website": "qa",
  "test responsive layouts": "qa",
  "final qa": "qa",
};

const PREFIX_TYPES: [RegExp, TaskType][] = [
  [/^design /, "design"],
  [/^test /, "qa"],
  [/^write .* copy$/, "production"],
  [/^build /, "production"],
  [/^implement /, "production"],
  [/^add /, "production"],
  [/^set up /, "production"],
  [/^install /, "production"],
  [/^connect /, "production"],
];

/**
 * Client-side fallback only, used to fill in a display value while `task.taskType` is
 * null (e.g. a task created before the classification migration ran, or the schema
 * cache hasn't picked up the new column yet). The database column is authoritative;
 * this never overwrites it and never re-implements authorization.
 */
export function classifyTaskTitle(title: string): TaskType {
  const key = title.trim().toLowerCase();
  if (EXACT_TITLE_TYPES[key]) return EXACT_TITLE_TYPES[key];
  for (const [pattern, type] of PREFIX_TYPES) {
    if (pattern.test(key)) return type;
  }
  return "internal";
}

export function effectiveTaskType(task: { taskType: TaskType | null; title: string }): TaskType {
  return task.taskType ?? classifyTaskTitle(task.title);
}
