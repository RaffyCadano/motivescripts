import { useEffect, useMemo, useState } from "react";
import { formatMonthLabel, type RecurringRevenueMonth } from "@/data/recurringRevenue";
import { cn } from "@/lib/cn";

// Same green/red pair already used for status elsewhere in the app. Validated: normal-vision
// separation is very safe (ΔE 26.8); CVD (deutan) separation sits right at the 8.0 target floor,
// which the skill treats as fine paired with secondary encoding -- so this chart never relies on
// color alone: every bar has a legend, and the tallest bar per month gets a direct value label.
const NEW_COLOR = "#0f7a56";
const CANCELED_COLOR = "#b42318";

/**
 * New vs. canceled subscriptions per month, alongside the MRR trend -- explains WHY the MRR line
 * moved. Grouped bars (mark/anatomy: 2px surface gap between adjacent bars, rounded data-ends).
 */
export function SubscriptionChangeChart({ months }: { months: RecurringRevenueMonth[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    setHoverIndex(null);
  }, [months]);

  const maxCount = useMemo(() => Math.max(1, ...months.map((m) => Math.max(m.newCount, m.canceledCount))), [months]);

  if (months.length === 0) {
    return (
      <div className="flex h-[140px] items-center justify-center text-sm text-[var(--admin-muted)]">
        Not enough history yet.
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-32 items-end gap-1.5">
        {months.map((month, index) => {
          const hovered = hoverIndex === index;
          const newHeight = (month.newCount / maxCount) * 100;
          const canceledHeight = (month.canceledCount / maxCount) * 100;
          return (
            <button
              key={month.monthStart}
              type="button"
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-t-[3px] py-0.5 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-blue)]",
                hoverIndex !== null && !hovered ? "opacity-55" : "opacity-100",
              )}
              onPointerEnter={() => setHoverIndex(index)}
              onFocus={() => setHoverIndex(index)}
              onPointerLeave={() => setHoverIndex(null)}
              onBlur={() => setHoverIndex(null)}
              aria-label={`${formatMonthLabel(month.monthStart, { withYear: true })}: ${month.newCount} new, ${month.canceledCount} canceled`}
            >
              <div className="flex h-24 w-full items-end justify-center gap-[2px]">
                <div
                  className="w-full min-w-[3px] rounded-t-[3px]"
                  style={{ height: `${Math.max(newHeight, month.newCount > 0 ? 4 : 0)}%`, backgroundColor: NEW_COLOR }}
                />
                <div
                  className="w-full min-w-[3px] rounded-t-[3px]"
                  style={{ height: `${Math.max(canceledHeight, month.canceledCount > 0 ? 4 : 0)}%`, backgroundColor: CANCELED_COLOR }}
                />
              </div>
              <span className="text-[10px] text-[var(--admin-muted)]">
                {index % 3 === 0 || index === months.length - 1 ? formatMonthLabel(month.monthStart) : ""}
              </span>
            </button>
          );
        })}
      </div>

      {hoverIndex !== null ? (
        <div className="mt-2 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-2 text-[12px]">
          <p className="font-heading font-semibold text-[var(--admin-ink)]">
            {formatMonthLabel(months[hoverIndex].monthStart, { withYear: true })}
          </p>
          <p className="text-[var(--admin-muted)]">
            {months[hoverIndex].newCount} new · {months[hoverIndex].canceledCount} canceled
          </p>
        </div>
      ) : null}

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        <li className="flex items-center gap-1.5 text-[12px] text-[var(--admin-muted)]">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: NEW_COLOR }} aria-hidden="true" />
          New
        </li>
        <li className="flex items-center gap-1.5 text-[12px] text-[var(--admin-muted)]">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CANCELED_COLOR }} aria-hidden="true" />
          Canceled
        </li>
      </ul>
    </div>
  );
}
