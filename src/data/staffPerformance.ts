/**
 * Per-staff task performance for the admin Overview's "Staff performance" panel: on-time vs. late
 * completions, tasks currently overdue, and an inactivity flag -- the numbers behind a promote/
 * let-go conversation. Plain functions over records the page has already loaded (each project's
 * own task list), no fetching, so this can be tested on its own.
 */
import type { AgencyProject } from "@/data/agencyProjects";
import type { TeamMember } from "@/data/team";
import { daysSince, parseCalendarDay } from "./overviewExtras.ts";

/** No completed task in this many days (or ever) counts as inactive. */
export const STAFF_INACTIVE_AFTER_DAYS = 14;

export type StaffPerformanceRow = {
  userId: string;
  fullName: string;
  templateLabel: string;
  isActive: boolean;
  totalAssigned: number;
  completed: number;
  onTime: number;
  late: number;
  /** Currently open (not Completed) and past its due date. */
  overdueNow: number;
  /** Share of judged completions (onTime / (onTime + late)) that landed on time; null when no
   * completed task had a due date to judge against yet. */
  onTimeRate: number | null;
  lastCompletedAt: string | null;
  daysSinceLastCompleted: number | null;
  /** No completed task in STAFF_INACTIVE_AFTER_DAYS+ days -- including never. */
  isInactive: boolean;
};

function localCalendarDay(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type PerformanceProject = Pick<AgencyProject, "tasks">;
type PerformanceMember = Pick<TeamMember, "id" | "fullName" | "templateLabel" | "isActive">;

/**
 * One row per staff member who has at least one task ever assigned to them -- staff whose role
 * never receives tasks (sales, accounting, ...) are left out rather than shown as permanently
 * "inactive" for a metric that was never going to apply to them.
 *
 * Sorted so the people most likely to need a conversation come first: inactive staff, then most
 * currently-overdue, then lowest on-time rate.
 */
export function buildStaffPerformance(
  projects: PerformanceProject[],
  members: PerformanceMember[],
  now: Date = new Date(),
): StaffPerformanceRow[] {
  const tasksByMember = new Map<string, AgencyProject["tasks"]>();
  for (const project of projects) {
    for (const task of project.tasks) {
      // Still awaiting the assignee's acceptance -- not really theirs yet, so it isn't fair to
      // judge their on-time rate or inactivity against it (or count it as currently overdue).
      if (!task.assignedTo || task.assignmentStatus === "pending") continue;
      const list = tasksByMember.get(task.assignedTo);
      if (list) list.push(task);
      else tasksByMember.set(task.assignedTo, [task]);
    }
  }

  const rows: StaffPerformanceRow[] = [];
  for (const member of members) {
    const tasks = tasksByMember.get(member.id);
    if (!tasks || tasks.length === 0) continue;

    let completed = 0;
    let onTime = 0;
    let late = 0;
    let overdueNow = 0;
    let lastCompletedAt: string | null = null;

    for (const task of tasks) {
      if (task.status === "Completed") {
        completed += 1;
        if (task.completedAt && (!lastCompletedAt || task.completedAt > lastCompletedAt)) {
          lastCompletedAt = task.completedAt;
        }
        if (task.dueDate && task.completedAt) {
          if (localCalendarDay(task.completedAt) <= task.dueDate.slice(0, 10)) onTime += 1;
          else late += 1;
        }
      } else if (task.dueDate && parseCalendarDay(task.dueDate).getTime() < now.getTime()) {
        overdueNow += 1;
      }
    }

    const judged = onTime + late;
    const daysSinceLastCompleted = lastCompletedAt ? daysSince(lastCompletedAt, now) : null;
    rows.push({
      userId: member.id,
      fullName: member.fullName,
      templateLabel: member.templateLabel,
      isActive: member.isActive,
      totalAssigned: tasks.length,
      completed,
      onTime,
      late,
      overdueNow,
      onTimeRate: judged > 0 ? onTime / judged : null,
      lastCompletedAt,
      daysSinceLastCompleted,
      isInactive: daysSinceLastCompleted === null || daysSinceLastCompleted >= STAFF_INACTIVE_AFTER_DAYS,
    });
  }

  return rows.sort((a, b) => {
    if (a.isInactive !== b.isInactive) return a.isInactive ? -1 : 1;
    if (b.overdueNow !== a.overdueNow) return b.overdueNow - a.overdueNow;
    return (a.onTimeRate ?? 1) - (b.onTimeRate ?? 1);
  });
}
