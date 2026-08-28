import { Archive, Check, CircleDashed, Eye, PencilLine } from "lucide-react";
import type { DeliverableStatus } from "@/data/files";
import { cn } from "@/lib/cn";

const styles: Record<DeliverableStatus, string> = {
  Draft: "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
  "In Review": "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  "Needs Changes": "bg-[rgb(7_17_31_/_0.06)] text-[var(--admin-ink)]",
  Approved: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  Archived: "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
};

const icons = {
  Draft: CircleDashed,
  "In Review": Eye,
  "Needs Changes": PencilLine,
  Approved: Check,
  Archived: Archive,
} as const;

export function DeliverableStatusBadge({ status }: { status: DeliverableStatus }) {
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
