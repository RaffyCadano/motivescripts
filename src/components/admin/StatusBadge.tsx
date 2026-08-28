import type { LeadStatus } from "@/data/leads";
import { cn } from "@/lib/cn";

type ProjectStage = "Design" | "Development" | "Client Review";

const leadStyles: Record<LeadStatus, string> = {
  New: "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  Contacted: "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
  Qualified: "bg-[rgb(0_200_255_/_0.12)] text-[#0077aa]",
  Proposal: "bg-[rgb(0_96_255_/_0.1)] text-[var(--admin-bright)]",
  Won: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  Lost: "bg-[rgb(7_17_31_/_0.05)] text-[var(--admin-muted)]",
};

const stageStyles: Record<ProjectStage, string> = {
  Design: "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  Development: "bg-[rgb(0_96_255_/_0.1)] text-[var(--admin-bright)]",
  "Client Review": "bg-[rgb(0_200_255_/_0.12)] text-[#0077aa]",
};

type StatusBadgeProps = {
  status: LeadStatus | ProjectStage;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const className = status in leadStyles ? leadStyles[status as LeadStatus] : stageStyles[status as ProjectStage];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight",
        className,
      )}
    >
      {status}
    </span>
  );
}
