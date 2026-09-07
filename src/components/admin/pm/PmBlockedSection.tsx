import { Link } from "react-router-dom";
import { blockedReason } from "@/data/developerOverview";
import { adminProjectTasksHref, type TeamWorkTask } from "@/data/teamWorkspace";

/** Full-detail Blocked list -- shows the real blocker reason, or an honest "no reason provided" instead of inventing one. */
export function PmBlockedSection({ tasks, onOpen }: { tasks: TeamWorkTask[]; onOpen: (task: TeamWorkTask) => void }) {
  return (
    <section id="blocked" className="scroll-mt-20 space-y-3">
      <h2 className="font-heading text-sm font-semibold tracking-tight">Blocked</h2>
      {tasks.length === 0 ? (
        <p className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-8 text-sm text-[var(--admin-muted)]">
          Nothing is blocked right now.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--admin-line)] rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
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
    </section>
  );
}
