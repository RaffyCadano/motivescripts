import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { invoicePeriodLabel, invoicePeriods, type InvoicePeriod, type OverviewInvoiceTotals } from "@/data/adminOverview";
import { formatMoneyFromCents } from "@/data/money";

// Status semantics, not arbitrary categorical hues -- these track invoice
// health (neutral / at-risk / critical / resolved), matching the same
// green/amber/red used for status badges elsewhere in the admin.
const rows: { key: keyof OverviewInvoiceTotals; label: string; color: string }[] = [
  { key: "outstanding", label: "Outstanding", color: "var(--admin-blue)" },
  { key: "dueSoon", label: "Due soon", color: "#f59e0b" },
  { key: "overdue", label: "Overdue", color: "#dc2626" },
  { key: "paid", label: "Paid", color: "#10b981" },
];

const WIDTH = 320;
const HEIGHT = 190;
const PAD_LEFT = 24;
const PAD_RIGHT = 10;
const PAD_TOP = 16;
const PAD_BOTTOM = 22;
const TICKS = 4;

// The <svg> below scales its 320-unit viewBox to fill the card's actual
// width, so a plain fontSize in SVG units would grow or shrink with the
// card (wider column, wider screen -> bigger text). These are the actual
// pixel sizes we want on screen; useChartFontSize converts them to
// viewBox units based on the SVG's measured rendered width so the text
// stays a constant, legible size regardless of layout.
const AXIS_TICK_PX = 9;
const VALUE_LABEL_PX = 10;
const CATEGORY_LABEL_PX = 9;

function useChartFontSize() {
  const ref = useRef<SVGSVGElement>(null);
  const [unitsPerPixel, setUnitsPerPixel] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const renderedWidth = el.getBoundingClientRect().width;
      if (renderedWidth > 0) setUnitsPerPixel(WIDTH / renderedWidth);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, unitsPerPixel };
}

/** Round a max value up to a clean 1/2/5/10 * 10^n step, in cents. */
function niceScaleMax(maxCents: number): number {
  if (maxCents <= 0) return 10000; // $100 fallback scale so a flat-zero chart still shows a scale
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxCents)));
  const normalized = maxCents / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatAxisTick(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${Math.round(dollars / 1000)}k`;
  return `$${Math.round(dollars)}`;
}

type OverviewInvoicesProps = {
  totals: OverviewInvoiceTotals;
  period: InvoicePeriod;
  onPeriodChange: (period: InvoicePeriod) => void;
};

export function OverviewInvoices({ totals, period, onPeriodChange }: OverviewInvoicesProps) {
  const values = rows.map((row) => totals[row.key]);
  const scaleMax = niceScaleMax(Math.max(...values));

  const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const baselineY = PAD_TOP + innerHeight;
  const slot = innerWidth / rows.length;
  const barWidth = Math.min(30, slot * 0.5);

  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (scaleMax * i) / TICKS);

  const { ref: svgRef, unitsPerPixel } = useChartFontSize();
  const axisTickSize = AXIS_TICK_PX * unitsPerPixel;
  const valueLabelSize = VALUE_LABEL_PX * unitsPerPixel;
  const categoryLabelSize = CATEGORY_LABEL_PX * unitsPerPixel;

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Invoices</h2>
        <div className="flex items-center gap-3">
          <Link to="/admin/invoices" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
            View invoices
          </Link>
          <label>
            <span className="sr-only">Period</span>
            <select
              value={period}
              onChange={(event) => onPeriodChange(event.target.value as InvoicePeriod)}
              className="h-7 rounded-md border border-[var(--admin-line)] bg-white px-1.5 text-[11px] text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            >
              {invoicePeriods.map((item) => (
                <option key={item} value={item}>
                  {invoicePeriodLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        role="img"
        aria-label="Invoice totals by status"
        className="mt-3"
      >
        {ticks.map((tick) => {
          const y = PAD_TOP + innerHeight * (1 - tick / scaleMax);
          return (
            <g key={tick}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--admin-line)"
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 5}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={axisTickSize}
                fill="var(--admin-muted)"
              >
                {formatAxisTick(tick)}
              </text>
            </g>
          );
        })}
        <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={baselineY} y2={baselineY} stroke="var(--admin-muted)" strokeWidth={1} />

        {rows.map((row, index) => {
          const value = totals[row.key];
          const barHeight = innerHeight * (value / scaleMax);
          const x = PAD_LEFT + index * slot + (slot - barWidth) / 2;
          const y = baselineY - barHeight;
          return (
            <g key={row.key}>
              <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 0)} rx={4} fill={row.color} />
              <text
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize={valueLabelSize}
                fontWeight={600}
                fill="var(--admin-ink)"
              >
                {formatMoneyFromCents(value)}
              </text>
              <text
                x={x + barWidth / 2}
                y={baselineY + 10}
                textAnchor="middle"
                fontSize={categoryLabelSize}
                fill="var(--admin-muted)"
              >
                {row.label}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
