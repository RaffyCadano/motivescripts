import { useMemo } from "react";
import { Link } from "react-router-dom";
import { OverviewBarList, type OverviewBarListItem } from "@/components/admin/overview/OverviewBarList";
import type { AgencyProject, AgencyTaskStatus } from "@/data/agencyProjects";
import { projectProgressRows, taskStatusCounts, workloadByDay, type WorkloadBar } from "@/data/pmCharts";
import { adminProjectHref } from "@/data/teamWorkspace";
import { cn } from "@/lib/cn";

// Identity colours for the task statuses, in workflow order. Validated together: the lowest separation between
// neighbours is 7.4 for colour-blind readers, which is why every bar also carries its label and count. "Todo" is the
// neutral "not started" state, so it is hatched grey instead of taking a hue.
const STATUS_COLORS: Record<AgencyTaskStatus, string> = {
  Todo: "#8b97a8",
  "In Progress": "#2a78d6",
  "In Review": "#eda100",
  Completed: "#0f7a56",
  Blocked: "#eb6834",
};

const OVERDUE = "#c0392b";
const BRAND = "#0050f0";
const BRAND_SOFT = "rgb(0 80 240 / 0.3)";

function Card({ title, caption, children, className }: { title: string; caption: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5", className)}>
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">{title}</h2>
      <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{caption}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function barColor(bar: WorkloadBar): string {
  if (bar.kind === "overdue") return OVERDUE;
  return bar.kind === "today" ? BRAND : BRAND_SOFT;
}

/** Open tasks due on each of the next seven days. Bars grow from the baseline; the count sits on top of each. */
function WorkloadChart({ bars }: { bars: WorkloadBar[] }) {
  const max = Math.max(1, ...bars.map((bar) => bar.count));
  const total = bars.reduce((sum, bar) => sum + bar.count, 0);
  if (total === 0) {
    return <p className="py-10 text-center text-sm text-[var(--admin-muted)]">No open tasks are due in the next week.</p>;
  }
  const summary = bars.map((bar) => `${bar.title}: ${bar.count}`).join(", ");

  return (
    <div>
      <div role="img" aria-label={`Open tasks by due date. ${summary}`} className="flex h-44 items-end gap-1.5 sm:gap-2">
        {bars.map((bar, index) => {
          const heightPct = bar.count === 0 ? 0 : Math.max((bar.count / max) * 100, 6);
          return (
            <div key={bar.key} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end" tabIndex={0}>
              <span
                className={cn(
                  "mb-1 font-heading text-[12px] font-semibold tabular-nums",
                  bar.count === 0 ? "text-[var(--admin-muted)]" : "text-[var(--admin-ink)]",
                )}
              >
                {bar.count}
              </span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-[6px] transition-[filter] group-hover:brightness-90 group-focus:brightness-90"
                  style={{
                    height: bar.count === 0 ? "2px" : `${heightPct}%`,
                    backgroundColor: bar.count === 0 ? "var(--admin-line)" : barColor(bar),
                  }}
                />
              </div>
              <span
                role="tooltip"
                className={cn(
                  "pointer-events-none absolute -top-9 z-10 hidden whitespace-nowrap rounded-md bg-[var(--admin-navy)] px-2 py-1 text-[11px] font-medium text-white shadow-md group-hover:block group-focus:block",
                  // The bars nearest each card edge line their tooltip up with the bar instead of centring, so it never spills out.
                  index <= 1 ? "left-0" : index >= bars.length - 2 ? "right-0" : "left-1/2 -translate-x-1/2",
                )}
              >
                {bar.title} · {bar.count} {bar.count === 1 ? "task" : "tasks"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 border-t border-[var(--admin-line)] pt-2 sm:gap-2" aria-hidden="true">
        {bars.map((bar) => (
          <span
            key={bar.key}
            className={cn(
              "min-w-0 flex-1 whitespace-nowrap text-center text-[10px] sm:text-[11px]",
              bar.kind === "overdue" ? "font-medium text-[#b42318]" : bar.kind === "today" ? "font-medium text-[var(--admin-blue)]" : "text-[var(--admin-muted)]",
            )}
          >
            {bar.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Open tasks by due date</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Open tasks</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.key}>
              <td>{bar.title}</td>
              <td>{bar.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgressList({ projects }: { projects: AgencyProject[] }) {
  const rows = projectProgressRows(projects);
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-[var(--admin-muted)]">No active projects yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id}>
          <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <Link to={adminProjectHref(row.id)} className="min-w-0 truncate font-medium text-[var(--admin-ink)] hover:text-[var(--admin-blue)]">
              {row.name}
            </Link>
            <span className="shrink-0 font-heading font-semibold tabular-nums text-[var(--admin-ink)]">
              {row.percent}% <span className="font-normal text-[var(--admin-muted)]">· {row.completed}/{row.total}</span>
            </span>
          </div>
          <div
            className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--admin-bg)]"
            role="img"
            aria-label={`${row.name}: ${row.completed} of ${row.total} tasks done, ${row.percent}%`}
          >
            <div className="h-full rounded-full" style={{ width: `${row.percent}%`, backgroundColor: BRAND }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Three small charts for the Project Manager overview: where tasks stand, what is due this week, project progress. */
export function PmCharts({ projects }: { projects: AgencyProject[] }) {
  // Every task in the projects that are still running, not only the ones assigned to this person.
  const tasks = useMemo(
    () => projects.filter((project) => !project.archived && project.status !== "Completed").flatMap((project) => project.tasks),
    [projects],
  );
  const statusItems = useMemo<OverviewBarListItem[]>(
    () =>
      taskStatusCounts(tasks).map(({ status, count }) => ({
        key: status,
        label: status,
        value: count,
        color: STATUS_COLORS[status],
        hatched: status === "Todo",
      })),
    [tasks],
  );
  const bars = useMemo(() => workloadByDay(tasks), [tasks]);

  return (
    <section aria-label="Charts" className="grid gap-4 lg:grid-cols-6">
      <Card title="Tasks by status" caption="All tasks in your active projects" className="lg:col-span-2">
        <OverviewBarList items={statusItems} emptyLabel="No tasks yet." />
      </Card>
      <Card title="Workload this week" caption="Open tasks in your active projects, by due date" className="lg:col-span-2">
        <WorkloadChart bars={bars} />
      </Card>
      <Card title="Project progress" caption="Share of tasks done, least finished first" className="lg:col-span-2">
        <ProgressList projects={projects} />
      </Card>
    </section>
  );
}
