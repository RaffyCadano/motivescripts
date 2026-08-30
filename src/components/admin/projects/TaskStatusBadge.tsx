import { Circle, CircleAlert, CircleDot, LoaderCircle } from "lucide-react";
import { taskStatusLabel, type AgencyTaskStatus } from "@/data/agencyProjects";
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

export function TaskStatusBadge({ status }: { status: AgencyTaskStatus }) {
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight",
        styles[status],
      )}
    >
      <Icon size={11} strokeWidth={2.2} aria-hidden="true" />
      {taskStatusLabel(status)}
    </span>
  );
}
