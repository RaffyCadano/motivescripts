import { Check, CircleDot, Eye, Hammer, Pause } from "lucide-react";
import type { AgencyProjectStatus } from "@/data/agencyProjects";
import { cn } from "@/lib/cn";

const styles: Record<AgencyProjectStatus, string> = {
  Planning: "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
  "In Development": "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  "Client Review": "bg-[rgb(0_200_255_/_0.12)] text-[#0077aa]",
  "On Hold": "bg-[rgb(7_17_31_/_0.06)] text-[var(--admin-muted)]",
  Completed: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
};

const icons = {
  Planning: CircleDot,
  "In Development": Hammer,
  "Client Review": Eye,
  "On Hold": Pause,
  Completed: Check,
} as const;

export function ProjectStatusBadge({ status }: { status: AgencyProjectStatus }) {
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
