import { AlertTriangle, Gauge } from "lucide-react";
import { Link } from "react-router-dom";
import { OverviewCard, OverviewEmpty } from "@/components/admin/overview/kit";
import type { StaffPerformanceRow } from "@/data/staffPerformance";
import { cn } from "@/lib/cn";

function rateTone(rate: number | null): string {
  if (rate === null) return "text-[var(--admin-muted)]";
  if (rate >= 0.9) return "text-[#0f7a56]";
  if (rate >= 0.7) return "text-[#b45309]";
  return "text-[#b42318]";
}

function lastCompletedLabel(row: StaffPerformanceRow): string {
  if (row.daysSinceLastCompleted === null) return "Never completed a task";
  if (row.daysSinceLastCompleted === 0) return "Completed a task today";
  if (row.daysSinceLastCompleted === 1) return "Completed a task yesterday";
  return `Last completed ${row.daysSinceLastCompleted} days ago`;
}

/**
 * On-time delivery and activity per staff member -- the numbers behind a promotion or a
 * performance conversation. Only lists staff who have ever had a task assigned; roles that never
 * receive tasks (sales, accounting, ...) are left out rather than shown as permanently inactive.
 */
export function StaffPerformancePanel({ rows }: { rows: StaffPerformanceRow[] }) {
  return (
    <OverviewCard
      icon={Gauge}
      title="Staff performance"
      description="On-time task delivery and activity, for promotion and performance calls."
      action={{ label: "View team", to: "/admin/team" }}
    >
      {rows.length === 0 ? (
        <OverviewEmpty
          icon={Gauge}
          title="No task history yet"
          body="Once staff are assigned tasks and complete them, their on-time record shows up here."
        />
      ) : (
        <ul className="divide-y divide-[var(--admin-line)]">
          {rows.map((row) => (
            <li
              key={row.userId}
              className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Link
                  to={`/admin/team/${row.userId}`}
                  className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                >
                  {row.fullName}
                  {row.isActive ? null : <span className="ml-1.5 text-[12px] font-normal text-[var(--admin-muted)]">(deactivated)</span>}
                </Link>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                  {row.templateLabel} · {lastCompletedLabel(row)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {row.isInactive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(220_38_38_/_0.08)] px-2 py-0.5 font-heading text-[11px] font-semibold text-[#b42318]">
                    Inactive
                  </span>
                ) : null}
                {row.overdueNow > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(245_158_11_/_0.14)] px-2 py-0.5 font-heading text-[11px] font-semibold text-[#b45309]">
                    <AlertTriangle size={11} strokeWidth={2} aria-hidden="true" />
                    {row.overdueNow} overdue
                  </span>
                ) : null}
                <span className={cn("font-heading text-[13px] font-semibold tabular-nums", rateTone(row.onTimeRate))}>
                  {row.onTimeRate === null ? "—" : `${Math.round(row.onTimeRate * 100)}%`}
                  <span className="ml-1 font-normal text-[var(--admin-muted)]">on time</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </OverviewCard>
  );
}
