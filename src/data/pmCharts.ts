/**
 * The numbers behind the three charts on the Project Manager overview. Plain functions over the tasks and projects
 * already loaded for that page, no fetching, so they can be tested on their own.
 */
import type { AgencyTaskStatus } from "./agencyProjects.ts";

const STATUS_ORDER: AgencyTaskStatus[] = ["Todo", "In Progress", "In Review", "Completed", "Blocked"];

export function taskStatusCounts(tasks: { status: AgencyTaskStatus }[]): { status: AgencyTaskStatus; count: number }[] {
  return STATUS_ORDER.map((status) => ({ status, count: tasks.filter((task) => task.status === status).length }));
}

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type WorkloadBar = {
  key: string;
  /** Short label under the bar: "Overdue", "Today", "Tue". */
  label: string;
  /** Full text for the tooltip and screen readers: "Tuesday, Sep 29". */
  title: string;
  count: number;
  kind: "overdue" | "today" | "day";
};

/**
 * Open tasks by due date for the next seven days, starting today, preceded by one bar for everything already
 * overdue. Finished tasks and tasks with no due date are left out.
 */
export function workloadByDay(tasks: { status: AgencyTaskStatus; dueDate: string }[], now: Date = new Date(), days = 7): WorkloadBar[] {
  const open = tasks.filter((task) => task.status !== "Completed" && task.dueDate);
  const today = isoDay(now);
  const bars: WorkloadBar[] = [
    { key: "overdue", label: "Late", title: "Overdue", count: open.filter((task) => task.dueDate.slice(0, 10) < today).length, kind: "overdue" },
  ];
  for (let offset = 0; offset < days; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const key = isoDay(date);
    bars.push({
      key,
      label: offset === 0 ? "Today" : date.toLocaleDateString("en-US", { weekday: "short" }),
      title: date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
      count: open.filter((task) => task.dueDate.slice(0, 10) === key).length,
      kind: offset === 0 ? "today" : "day",
    });
  }
  return bars;
}

export type ProjectProgressRow = { id: string; name: string; percent: number; completed: number; total: number };

/** Each project's finished share of its tasks. Least finished first, so the ones that need pushing are on top. */
export function projectProgressRows(
  projects: { id: string; name: string; status: string; archived?: boolean; tasks: { status: AgencyTaskStatus }[] }[],
  limit = 6,
): ProjectProgressRow[] {
  return projects
    .filter((project) => !project.archived && project.status !== "Completed")
    .map((project) => {
      const total = project.tasks.length;
      const completed = project.tasks.filter((task) => task.status === "Completed").length;
      return { id: project.id, name: project.name, total, completed, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
    })
    .sort((a, b) => a.percent - b.percent || a.name.localeCompare(b.name))
    .slice(0, limit);
}
