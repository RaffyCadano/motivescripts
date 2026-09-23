import { useEffect, useState } from "react";
import type { RevenuePeriodTotals } from "@/data/financialReports";
import { formatUsdFromCents } from "@/data/money";
import { cn } from "@/lib/cn";

// Categorical identity pair (not a good/bad judgment, unlike new-vs-canceled elsewhere in this
// app) -- recurring reuses the same blue as the MRR chart, since it's the same underlying revenue.
// Validated: CVD and normal-vision separation both pass comfortably. The amber fails the 3:1
// contrast-vs-surface check on its own, which the skill treats as needing a table view or visible
// labels as relief -- this page already has the full periods table right below the chart, and
// every bar's totals are also shown in a labeled hover tooltip, so color is never load-bearing
// alone.
const RECURRING_COLOR = "var(--admin-blue)";
const ONE_TIME_COLOR = "#f59e0b";

/**
 * Total revenue per period, recurring and one-time stacked -- the natural form for "parts of a
 * whole over time" (mark/anatomy: 2px surface gap between stacked segments, rounded bar tops).
 * Reflects whatever the page's own search/group-by filters currently show.
 */
export function RevenueByPeriodChart({ periods }: { periods: RevenuePeriodTotals[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // Table below sorts newest-first; a chart reads left-to-right as oldest-to-newest.
  const ordered = [...periods].reverse();

  useEffect(() => {
    setHoverIndex(null);
  }, [periods]);

  const maxTotal = Math.max(1, ...ordered.map((p) => p.totalCents));

  if (ordered.length === 0) return null;

  return (
    <div>
      <div className="flex h-40 items-end gap-1">
        {ordered.map((period, index) => {
          const hovered = hoverIndex === index;
          const recurringHeight = (period.recurringCents / maxTotal) * 100;
          const oneTimeHeight = (period.oneTimeCents / maxTotal) * 100;
          const showLabel = ordered.length <= 8 || index === ordered.length - 1 || index % Math.ceil(ordered.length / 8) === 0;
          return (
            <button
              key={period.key}
              type="button"
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-end gap-1 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-blue)]",
                hoverIndex !== null && !hovered ? "opacity-55" : "opacity-100",
              )}
              onPointerEnter={() => setHoverIndex(index)}
              onFocus={() => setHoverIndex(index)}
              onPointerLeave={() => setHoverIndex(null)}
              onBlur={() => setHoverIndex(null)}
              aria-label={`${period.label}: ${formatUsdFromCents(period.totalCents)} total, ${formatUsdFromCents(period.recurringCents)} recurring, ${formatUsdFromCents(period.oneTimeCents)} one-time`}
            >
              <div className="flex h-32 w-full flex-col-reverse items-stretch overflow-hidden rounded-t-[3px]">
                <div
                  className="w-full"
                  style={{ height: `${Math.max(recurringHeight, period.recurringCents > 0 ? 3 : 0)}%`, backgroundColor: RECURRING_COLOR }}
                />
                {period.recurringCents > 0 && period.oneTimeCents > 0 ? <div className="h-[2px] w-full bg-[var(--admin-card)]" /> : null}
                <div
                  className="w-full rounded-t-[3px]"
                  style={{ height: `${Math.max(oneTimeHeight, period.oneTimeCents > 0 ? 3 : 0)}%`, backgroundColor: ONE_TIME_COLOR }}
                />
              </div>
              <span className="h-3.5 text-[10px] text-[var(--admin-muted)]">{showLabel ? period.label : ""}</span>
            </button>
          );
        })}
      </div>

      {hoverIndex !== null ? (
        <div className="mt-2 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-2 text-[12px]">
          <p className="font-heading font-semibold text-[var(--admin-ink)]">
            {ordered[hoverIndex].label} · {formatUsdFromCents(ordered[hoverIndex].totalCents)}
          </p>
          <p className="text-[var(--admin-muted)]">
            {formatUsdFromCents(ordered[hoverIndex].recurringCents)} recurring · {formatUsdFromCents(ordered[hoverIndex].oneTimeCents)} one-time
          </p>
        </div>
      ) : null}

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        <li className="flex items-center gap-1.5 text-[12px] text-[var(--admin-muted)]">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: RECURRING_COLOR }} aria-hidden="true" />
          Recurring
        </li>
        <li className="flex items-center gap-1.5 text-[12px] text-[var(--admin-muted)]">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: ONE_TIME_COLOR }} aria-hidden="true" />
          One-time
        </li>
      </ul>
    </div>
  );
}
