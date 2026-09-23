export type OverviewBarListItem = {
  key: string;
  label: string;
  value: number;
  color: string;
  /** Renders a diagonal stripe fill instead of a solid one -- for a category that's
   * intentionally excluded from the categorical hue rotation (e.g. a "Lost"/neutral
   * outcome), so it never has to fight a saturated color for CVD separation. */
  hatched?: boolean;
};

/**
 * A small horizontal bar list: each row's bar length is relative to the largest
 * single value (not a stacked share of the whole), with the count and percent-
 * of-total always shown as text -- color is never the only way to read a row.
 */
export function OverviewBarList({ items, emptyLabel }: { items: OverviewBarListItem[]; emptyLabel: string }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(1, ...items.map((item) => item.value));

  if (total === 0) {
    return <p className="py-6 text-center text-sm text-[var(--admin-muted)]">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const pct = Math.round((item.value / total) * 100);
        const widthPct = Math.max((item.value / max) * 100, item.value > 0 ? 3 : 0);
        return (
          <li key={item.key}>
            <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="min-w-0 truncate text-[var(--admin-ink)]">{item.label}</span>
              <span className="shrink-0 font-heading font-semibold text-[var(--admin-ink)]">
                {item.value} <span className="font-normal text-[var(--admin-muted)]">({pct}%)</span>
              </span>
            </div>
            <div
              className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--admin-bg)]"
              role="img"
              aria-label={`${item.label}: ${item.value}, ${pct}% of ${total}`}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: item.hatched ? undefined : item.color,
                  backgroundImage: item.hatched
                    ? `repeating-linear-gradient(135deg, ${item.color} 0 3px, transparent 3px 6px)`
                    : undefined,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
