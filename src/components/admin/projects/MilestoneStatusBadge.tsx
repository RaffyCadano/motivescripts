import { Check, CircleDot, LoaderCircle, Pause } from "lucide-react";
import type { AgencyMilestoneStatus } from "@/data/agencyProjects";
import { cn } from "@/lib/cn";

const styles: Record<AgencyMilestoneStatus, string> = {
  "Not Started": "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
  "In Progress": "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  Completed: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  "On Hold": "bg-[rgb(7_17_31_/_0.06)] text-[var(--admin-muted)]",
};

const icons = {
  "Not Started": CircleDot,
  "In Progress": LoaderCircle,
  Completed: Check,
  "On Hold": Pause,
} as const;

export function MilestoneStatusBadge({ status }: { status: AgencyMilestoneStatus }) {
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight",
        styles[status],
      )}
    >
      <Icon size={11} strokeWidth={2.2} aria-hidden="true" />
      {status}
    </span>
  );
}
