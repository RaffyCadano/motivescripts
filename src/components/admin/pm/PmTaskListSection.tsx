import { Link } from "react-router-dom";
import { MyTaskMobileList, MyTaskTable } from "@/components/admin/MyTaskList";
import type { TeamWorkTask } from "@/data/teamWorkspace";
import { cn } from "@/lib/cn";

type PmTaskListSectionProps = {
  id?: string;
  title: string;
  tasks: TeamWorkTask[];
  emptyTitle: string;
  emptyBody: string;
  onOpen: (task: TeamWorkTask) => void;
  viewAllHref?: string;
  viewAllLabel?: string;
};

/** Shared "task queue" card for the PM dashboard -- Today's Work, Due This Week, Overdue all reuse this. */
export function PmTaskListSection({
  id,
  title,
  tasks,
  emptyTitle,
  emptyBody,
  onOpen,
  viewAllHref,
  viewAllLabel = "View all",
}: PmTaskListSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5",
        id && "scroll-mt-20",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">{title}</h2>
        {viewAllHref ? (
          <Link to={viewAllHref} className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
            {viewAllLabel}
          </Link>
        ) : null}
      </div>

      {tasks.length === 0 ? (
        <div className="mt-3 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] px-5 py-8">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{emptyTitle}</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">{emptyBody}</p>
        </div>
      ) : (
        <div className="mt-4">
          <MyTaskTable tasks={tasks} onOpen={onOpen} />
          <MyTaskMobileList tasks={tasks} onOpen={onOpen} />
        </div>
      )}
    </section>
  );
}
