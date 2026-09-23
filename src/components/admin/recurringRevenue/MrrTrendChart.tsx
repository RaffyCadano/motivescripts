import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { formatMonthLabel, type RecurringRevenueMonth } from "@/data/recurringRevenue";
import { formatUsdFromCents } from "@/data/money";

const WIDTH = 960;
const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

type Plotted = { x: number; y: number; month: RecurringRevenueMonth };

/** Rounds up to a "clean" axis max: 1/2/5 x a power of ten. Same rule as ResponseTimeChart. */
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  for (const step of steps) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

/**
 * Monthly recurring revenue over the last 12 months, reconstructed server-side from
 * service_plans' own created_at/canceled_at (see recurring_revenue_monthly_trend()). Single
 * series -- no legend box needed, the card title already says what's plotted.
 */
export function MrrTrendChart({ months }: { months: RecurringRevenueMonth[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    setHoverIndex(null);
  }, [months]);

  const { points, yMax } = useMemo(() => {
    if (months.length === 0) return { points: [] as Plotted[], yMax: 100 };
    const xStep = months.length > 1 ? PLOT_W / (months.length - 1) : 0;
    const maxCents = Math.max(0, ...months.map((m) => m.mrrCents));
    const niceYMax = niceMax(maxCents || 10000);
    const yScale = (cents: number) => PAD.top + PLOT_H - (cents / niceYMax) * PLOT_H;
    const plotted = months.map((month, index) => ({
      x: PAD.left + xStep * index,
      y: yScale(month.mrrCents),
      month,
    }));
    return { points: plotted, yMax: niceYMax };
  }, [months]);

  function onMove(event: ReactPointerEvent<SVGRectElement>) {
    if (points.length === 0) return;
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((point, index) => {
      const dist = Math.abs(point.x - px);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = index;
      }
    });
    setHoverIndex(nearest);
  }

  if (points.length < 2) {
    return (
      <div className="flex h-[160px] items-center justify-center text-sm text-[var(--admin-muted)]">
        Not enough history yet.
      </div>
    );
  }

  const yTicks = [0, yMax / 2, yMax];
  const tickEvery = Math.ceil(points.length / 6);
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const last = points[points.length - 1];
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ height: "auto" }} role="img" aria-label="Monthly recurring revenue over the last 12 months">
        {yTicks.map((tick) => {
          const y = PAD.top + PLOT_H - (tick / yMax) * PLOT_H;
          return (
            <g key={tick}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} stroke="var(--admin-line)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y} textAnchor="end" dominantBaseline="middle" className="fill-[var(--admin-muted)]" fontSize={11}>
                {formatUsdFromCents(tick)}
              </text>
            </g>
          );
        })}

        <path d={path} fill="none" stroke="var(--admin-blue)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* End marker + direct label, per spec: lines get a value at the end. */}
        <circle cx={last.x} cy={last.y} r={4} fill="var(--admin-blue)" stroke="var(--admin-card)" strokeWidth={2} />
        <text x={Math.min(last.x + 8, WIDTH - PAD.right - 2)} y={last.y} textAnchor="end" dominantBaseline="middle" fontSize={11} className="fill-[var(--admin-ink)] font-semibold">
          {formatUsdFromCents(last.month.mrrCents)}
        </text>

        {points.map((point, index) =>
          index % tickEvery === 0 || index === points.length - 1 ? (
            <text
              key={index}
              x={point.x}
              y={HEIGHT - 8}
              textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
              fontSize={11}
              className="fill-[var(--admin-muted)]"
            >
              {formatMonthLabel(point.month.monthStart)}
            </text>
          ) : null,
        )}

        {hovered ? (
          <g aria-hidden="true">
            <line x1={hovered.x} x2={hovered.x} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--admin-muted)" strokeWidth={1} strokeDasharray="2 3" />
            <circle cx={hovered.x} cy={hovered.y} r={5} fill="var(--admin-blue)" stroke="var(--admin-card)" strokeWidth={2} />
          </g>
        ) : null}

        <rect
          x={PAD.left}
          y={PAD.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHoverIndex(null)}
        />
      </svg>

      {hovered ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-[var(--admin-line)] bg-[var(--admin-card)] px-2.5 py-1.5 text-[12px] shadow-[0_8px_24px_rgb(0_0_0_/_0.08)]"
          style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: `${(hovered.y / HEIGHT) * 100 - 2}%` }}
        >
          <p className="font-heading font-semibold text-[var(--admin-ink)]">{formatUsdFromCents(hovered.month.mrrCents)}</p>
          <p className="text-[var(--admin-muted)]">
            {formatMonthLabel(hovered.month.monthStart, { withYear: true })} · {hovered.month.activeCount} active
          </p>
        </div>
      ) : null}
    </div>
  );
}
