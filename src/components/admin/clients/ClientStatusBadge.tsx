import { Archive, CircleOff, CircleCheck } from "lucide-react";
import type { AgencyClientStatus } from "@/data/agencyClients";
import { cn } from "@/lib/cn";

const styles: Record<AgencyClientStatus, string> = {
  Active: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  Inactive: "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
  Archived: "bg-[rgb(7_17_31_/_0.06)] text-[var(--admin-muted)]",
};

const icons = {
  Active: CircleCheck,
  Inactive: CircleOff,
  Archived: Archive,
} as const;

export function ClientStatusBadge({ status }: { status: AgencyClientStatus }) {
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
