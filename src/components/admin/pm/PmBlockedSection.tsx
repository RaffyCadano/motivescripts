import { CircleCheck, OctagonAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { OverviewCard, OverviewEmpty } from "@/components/admin/overview/kit";
import { blockedReason } from "@/data/developerOverview";
import { adminProjectTasksHref, type TeamWorkTask } from "@/data/teamWorkspace";

/** Full-detail Blocked list -- shows the real blocker reason, or an honest "no reason provided" instead of inventing one. */
export function PmBlockedSection({ tasks, onOpen }: { tasks: TeamWorkTask[]; onOpen: (task: TeamWorkTask) => void }) {
  return (
    <OverviewCard id="blocked" icon={OctagonAlert} title="Blocked" count={tasks.length} description="Tasks stuck until something is sorted out">
      {tasks.length === 0 ? (
        <OverviewEmpty compact icon={CircleCheck} title="Nothing is blocked" body="Every task is free to move." />
      ) : (
        <ul className="divide-y divide-[var(--admin-line)]">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <button
                  type="button"
                  className="text-left font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                  onClick={() => onOpen(task)}
                >
                  {task.title}
                </button>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                  {task.projectName} · {task.priority} priority
                </p>
                <p className="mt-1 text-[13px] text-[var(--admin-ink)]">{blockedReason(task) ?? "No reason provided"}</p>
              </div>
              <Link
                to={adminProjectTasksHref(task.projectId)}
                className="shrink-0 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
              >
                View project
              </Link>
            </li>
          ))}
        </ul>
      )}
    </OverviewCard>
  );
}
