import { Circle, CircleAlert, CircleDot, Hourglass, LoaderCircle } from "lucide-react";
import { taskStatusLabel, type AgencyTaskStatus, type TaskAssignmentStatus } from "@/data/agencyProjects";
import { cn } from "@/lib/cn";

const styles: Record<AgencyTaskStatus, string> = {
  Todo: "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
  "In Progress": "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  "In Review": "bg-[rgb(245_158_11_/_0.12)] text-[#b45309]",
  Completed: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  Blocked: "bg-[rgb(7_17_31_/_0.06)] text-[var(--admin-ink)]",
};

const icons = {
  Todo: Circle,
  "In Progress": LoaderCircle,
  "In Review": CircleDot,
  Completed: CircleDot,
  Blocked: CircleAlert,
} as const;

export function TaskStatusBadge({
  status,
  assignmentStatus,
}: {
  status: AgencyTaskStatus;
  /** Pass this wherever it's known -- "pending" overrides the badge to "Awaiting acceptance" instead of the
   * underlying status, since that status (always "Todo" while pending) isn't the useful thing to show yet. */
  assignmentStatus?: TaskAssignmentStatus | null;
}) {
  if (assignmentStatus === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(0_80_240_/_0.08)] px-2 py-0.5 font-heading text-xs font-semibold tracking-tight text-[var(--admin-blue)]">
        <Hourglass size={11} strokeWidth={2.2} aria-hidden="true" />
        Awaiting acceptance
      </span>
    );
  }
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-heading text-xs font-semibold tracking-tight",
        styles[status],
      )}
    >
      <Icon size={11} strokeWidth={2.2} aria-hidden="true" />
      {taskStatusLabel(status)}
    </span>
  );
}
