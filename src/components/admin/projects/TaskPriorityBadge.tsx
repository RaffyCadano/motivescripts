import type { AgencyTaskPriority } from "@/data/agencyProjects";
import { cn } from "@/lib/cn";

const styles: Record<AgencyTaskPriority, string> = {
  Low: "text-[var(--admin-muted)]",
  Medium: "text-[var(--admin-ink)]",
  High: "text-[var(--admin-blue)]",
  Urgent: "text-[var(--admin-navy)]",
};

export function TaskPriorityBadge({ priority }: { priority: AgencyTaskPriority }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-heading text-[11px] font-semibold", styles[priority])}>
      <span
        className={cn(
          "size-1.5 rounded-full",
          priority === "Low" && "bg-[var(--admin-muted)]",
          priority === "Medium" && "bg-[var(--admin-ink)]",
          priority === "High" && "bg-[var(--admin-blue)]",
          priority === "Urgent" && "bg-[var(--admin-navy)]",
        )}
        aria-hidden="true"
      />
      {priority}
    </span>
  );
}
