import { Clock3, CircleCheck, CircleOff } from "lucide-react";
import { teamStatusLabel, type TeamListRow, type TeamMemberStatus } from "@/data/team";
import { cn } from "@/lib/cn";

const styles: Record<TeamMemberStatus, string> = {
  active: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  inactive: "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
  pending: "bg-[rgb(245_158_11_/_0.12)] text-[#b45309]",
};

const icons = {
  active: CircleCheck,
  inactive: CircleOff,
  pending: Clock3,
} as const;

function statusOf(row: TeamListRow): TeamMemberStatus {
  if (row.kind === "invite") return "pending";
  return row.member.isActive ? "active" : "inactive";
}

export function TeamStatusBadge({ row }: { row: TeamListRow }) {
  const status = statusOf(row);
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight",
        styles[status],
      )}
    >
      <Icon size={11} strokeWidth={2.2} aria-hidden="true" />
      {teamStatusLabel(row)}
    </span>
  );
}
