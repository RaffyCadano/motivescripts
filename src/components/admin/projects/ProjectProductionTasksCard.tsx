import {
  formatProductionTaskStats,
  milestoneProductionRows,
  productionTaskStats,
  type AgencyProject,
} from "@/data/agencyProjects";
import { displayMilestoneName } from "@/data/projectMilestones";

export function ProjectProductionTasksCard({
  project,
  onOpenTasks,
}: {
  project: AgencyProject;
  onOpenTasks: () => void;
}) {
  const stats = productionTaskStats(project);
  const rows = milestoneProductionRows(project);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Production Tasks</h2>
          {stats.total === 0 ? (
            <p className="mt-1 text-sm text-[var(--admin-muted)]">No production tasks on this project yet.</p>
          ) : (
            <p className="mt-1 text-sm text-[var(--admin-ink)]">
              {formatProductionTaskStats(stats)}
            </p>
          )}
        </div>
        <button
          type="button"
          className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
          onClick={onOpenTasks}
        >
          View tasks
        </button>
      </div>

      {stats.unassigned > 0 ? (
        <p className="mt-3 rounded-lg bg-[var(--admin-bg)] px-3 py-2 text-sm text-[var(--admin-ink)]">
          <span className="font-heading font-semibold">Needs assignment</span>
          <span className="mt-0.5 block text-[var(--admin-muted)]">
            {stats.unassigned} task{stats.unassigned === 1 ? "" : "s"} {stats.unassigned === 1 ? "is" : "are"} currently
            unassigned.
          </span>
        </p>
      ) : null}

      {rows.length > 0 ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.id}>
              <dt className="font-heading text-sm font-semibold text-[var(--admin-ink)]">
                {displayMilestoneName(row.name)}
              </dt>
              <dd className="mt-0.5 text-sm text-[var(--admin-muted)]">
                {row.total === 0 ? "No tasks yet" : `${row.completed} / ${row.total} complete`}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
