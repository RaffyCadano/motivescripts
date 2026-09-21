import { useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { DailyHours, ProjectHours, TaskStatusCount } from "@/data/developerOverview";

// Fixed on-screen pixel sizes for chart text. The <svg>s scale a fixed viewBox
// to the card's width, so plain SVG font sizes would grow and shrink with the
// layout; useChartUnits converts these pixel sizes to viewBox units using the
// measured rendered width (same approach as OverviewInvoices).
const AXIS_TICK_PX = 9;
const VALUE_LABEL_PX = 10;
const CATEGORY_LABEL_PX = 9;
const TICKS = 4;

function useChartUnits(viewBoxWidth: number) {
  const ref = useRef<SVGSVGElement>(null);
  const [unitsPerPixel, setUnitsPerPixel] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const renderedWidth = el.getBoundingClientRect().width;
      if (renderedWidth > 0) setUnitsPerPixel(viewBoxWidth / renderedWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewBoxWidth]);

  return { ref, unitsPerPixel };
}

/** Round up to the next multiple of 4 (min 4) so the four gridline steps are always whole numbers. */
function scaleMaxFor(max: number): number {
  return Math.max(4, Math.ceil(max / 4) * 4);
}

/**
 * Scale max for values that are not small whole numbers (money, large counts): four gridline steps of a
 * "nice" size (1, 2, 2.5, 5 x a power of ten), so ticks read $500 / $1,000 / $1,500 rather than $925 / $1,850.
 */
function niceScaleMax(max: number): number {
  if (max <= 0) return 4;
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough) ?? rough;
  return step * 4;
}

/** Left padding wide enough for the longest tick label, never narrower than the chart's base padding. */
function padLeftFor(base: number, labels: string[], unitsPerPixel: number): number {
  const longest = Math.max(0, ...labels.map((label) => label.length));
  return Math.max(base, longest * AXIS_TICK_PX * 0.6 * unitsPerPixel + 8);
}

function Tooltip({ leftPercent, topPercent, children }: { leftPercent: number; topPercent: number; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-[var(--admin-line)] bg-[var(--admin-card)] px-2 py-1 text-xs text-[var(--admin-ink)] shadow-[0_2px_10px_rgb(7_17_31_/_0.12)]"
      style={{ left: `${Math.min(92, Math.max(8, leftPercent))}%`, top: `${topPercent}%` }}
      role="status"
    >
      {children}
    </div>
  );
}

const LINE_W = 480;
const LINE_H = 190;
const LINE_PAD = { left: 26, right: 18, top: 14, bottom: 24 };

export type LinePoint = { date: string; label: string; value: number };

/**
 * A value per day as a line. Hover (or touch) any day for the exact value. `formatTick` labels the y axis and
 * `formatValue` the tooltip; `niceScale` picks round gridline steps for money or large counts.
 */
export function ValueLineChart({
  data,
  ariaLabel,
  caption,
  valueHeader,
  formatTick = (value) => String(value),
  formatValue = (value) => String(value),
  niceScale = false,
}: {
  data: LinePoint[];
  ariaLabel: string;
  caption: string;
  valueHeader: string;
  formatTick?: (value: number) => string;
  formatValue?: (value: number) => string;
  niceScale?: boolean;
}) {
  const { ref, unitsPerPixel } = useChartUnits(LINE_W);
  const [hover, setHover] = useState<number | null>(null);

  const maxValue = Math.max(0, ...data.map((day) => day.value));
  const scaleMax = niceScale ? niceScaleMax(maxValue) : scaleMaxFor(maxValue);
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (scaleMax * i) / TICKS);
  const padLeft = padLeftFor(LINE_PAD.left, ticks.map(formatTick), unitsPerPixel);
  const innerW = LINE_W - padLeft - LINE_PAD.right;
  const innerH = LINE_H - LINE_PAD.top - LINE_PAD.bottom;
  const baselineY = LINE_PAD.top + innerH;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((day, index) => ({
    x: padLeft + index * stepX,
    y: LINE_PAD.top + innerH * (1 - day.value / scaleMax),
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${baselineY} L${points[0].x.toFixed(1)},${baselineY} Z`;

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || stepX === 0) return;
    const xUnits = ((event.clientX - rect.left) / rect.width) * LINE_W;
    const index = Math.round((xUnits - padLeft) / stepX);
    setHover(Math.min(data.length - 1, Math.max(0, index)));
  }

  const lastIndex = data.length - 1;
  const labelStep = Math.max(1, Math.round(lastIndex / 4));
  const hovered = hover !== null ? data[hover] : null;
  const hoveredPoint = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${LINE_W} ${LINE_H}`}
        width="100%"
        role="img"
        aria-label={ariaLabel}
        className="touch-pan-y"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((tick) => {
          const y = LINE_PAD.top + innerH * (1 - tick / scaleMax);
          return (
            <g key={tick}>
              <line x1={padLeft} x2={LINE_W - LINE_PAD.right} y1={y} y2={y} stroke="var(--admin-line)" strokeWidth={1} />
              <text
                x={padLeft - 5}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={AXIS_TICK_PX * unitsPerPixel}
                fill="var(--admin-muted)"
              >
                {formatTick(tick)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="rgb(0 80 240 / 0.08)" />
        <path d={linePath} fill="none" stroke="var(--admin-blue)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {data.map((day, index) =>
          (lastIndex - index) % labelStep === 0 && index > 0 ? (
            <text
              key={day.date}
              x={points[index].x}
              y={baselineY + 12 * unitsPerPixel + 4}
              textAnchor={index === lastIndex ? "end" : "middle"}
              fontSize={CATEGORY_LABEL_PX * unitsPerPixel}
              fill="var(--admin-muted)"
            >
              {index === lastIndex ? "Today" : day.label}
            </text>
          ) : null,
        )}

        {hoveredPoint ? (
          <>
            <line x1={hoveredPoint.x} x2={hoveredPoint.x} y1={LINE_PAD.top} y2={baselineY} stroke="var(--admin-muted)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r={4} fill="var(--admin-blue)" stroke="var(--admin-card)" strokeWidth={2} />
          </>
        ) : (
          <circle
            cx={points[lastIndex].x}
            cy={points[lastIndex].y}
            r={4}
            fill="var(--admin-blue)"
            stroke="var(--admin-card)"
            strokeWidth={2}
          />
        )}
      </svg>

      {hovered && hoveredPoint ? (
        <Tooltip leftPercent={(hoveredPoint.x / LINE_W) * 100} topPercent={(hoveredPoint.y / LINE_H) * 100 - 3}>
          <span className="text-[var(--admin-muted)]">{hovered.label}</span>{" "}
          <span className="font-semibold">{formatValue(hovered.value)}</span>
        </Tooltip>
      ) : null}

      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>{valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((day) => (
            <tr key={day.date}>
              <td>{day.label}</td>
              <td>{formatValue(day.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Daily hours logged as a line over the last N days. Hover (or touch) any day for the exact value. */
export function HoursLineChart({ data }: { data: DailyHours[] }) {
  return (
    <ValueLineChart
      data={data.map((day) => ({ date: day.date, label: day.label, value: day.hours }))}
      ariaLabel={`Hours logged per day over the last ${data.length} days`}
      caption="Hours logged per day"
      valueHeader="Hours"
      formatTick={(value) => `${value}h`}
      formatValue={(value) => `${value}h`}
    />
  );
}

const BAR_W = 360;
const BAR_H = 190;
const BAR_PAD = { left: 24, right: 10, top: 18, bottom: 34 };

// Status semantics, matching the status badges used elsewhere in the app. Every
// bar also carries a count and a text label, so identity is never color alone.
const statusColor: Record<TaskStatusCount["status"], string> = {
  Todo: "#94a3b8",
  "In Progress": "var(--admin-blue)",
  "In Review": "#f59e0b",
  Blocked: "#dc2626",
  Completed: "#10b981",
};

export type CategoryBar = { key: string; label: string; count: number; color: string };

/**
 * Counts per category as vertical bars. Every bar carries its own count and text label, so identity is never
 * color alone. Hover (or touch) a bar for the exact count. `unit` is the singular noun used in the tooltip.
 */
export function CategoryBarChart({
  data,
  ariaLabel,
  unit,
  formatValue,
  formatTick,
}: {
  data: CategoryBar[];
  ariaLabel: string;
  unit: string;
  /** Formats a bar's value (tooltip and label above the bar), e.g. money. Defaults to the plain count. */
  formatValue?: (value: number) => string;
  /** Formats the y-axis ticks. Defaults to formatValue, then the plain number. Passing either picks round gridline steps. */
  formatTick?: (value: number) => string;
}) {
  const { ref, unitsPerPixel } = useChartUnits(BAR_W);
  const [hover, setHover] = useState<number | null>(null);

  const niceScale = Boolean(formatValue || formatTick);
  const tickFormat = formatTick ?? formatValue ?? ((value: number) => String(value));
  const scaleMax = niceScale
    ? niceScaleMax(Math.max(0, ...data.map((item) => item.count)))
    : scaleMaxFor(Math.max(0, ...data.map((item) => item.count)));
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (scaleMax * i) / TICKS);
  const padLeft = padLeftFor(BAR_PAD.left, ticks.map(tickFormat), unitsPerPixel);
  const innerW = BAR_W - padLeft - BAR_PAD.right;
  const innerH = BAR_H - BAR_PAD.top - BAR_PAD.bottom;
  const baselineY = BAR_PAD.top + innerH;
  const slot = innerW / data.length;
  const barWidth = Math.min(30, slot * 0.5);

  const hovered = hover !== null ? data[hover] : null;
  const hoveredTop = hovered ? baselineY - innerH * (hovered.count / scaleMax) : 0;

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${BAR_W} ${BAR_H}`}
        width="100%"
        role="img"
        aria-label={ariaLabel}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((tick) => {
          const y = BAR_PAD.top + innerH * (1 - tick / scaleMax);
          return (
            <g key={tick}>
              <line x1={padLeft} x2={BAR_W - BAR_PAD.right} y1={y} y2={y} stroke="var(--admin-line)" strokeWidth={1} />
              <text
                x={padLeft - 5}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={AXIS_TICK_PX * unitsPerPixel}
                fill="var(--admin-muted)"
              >
                {tickFormat(tick)}
              </text>
            </g>
          );
        })}
        <line x1={padLeft} x2={BAR_W - BAR_PAD.right} y1={baselineY} y2={baselineY} stroke="var(--admin-muted)" strokeWidth={1} />

        {data.map((item, index) => {
          const barHeight = innerH * (item.count / scaleMax);
          const x = padLeft + index * slot + (slot - barWidth) / 2;
          const y = baselineY - barHeight;
          const words = item.label.split(" ");
          const labelSize = CATEGORY_LABEL_PX * unitsPerPixel;
          return (
            <g key={item.key} opacity={hover === null || hover === index ? 1 : 0.55}>
              <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 0)} rx={4} fill={item.color} />
              <text
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize={VALUE_LABEL_PX * unitsPerPixel}
                fontWeight={600}
                fill="var(--admin-ink)"
              >
                {formatValue ? formatValue(item.count) : item.count}
              </text>
              <text x={x + barWidth / 2} y={baselineY + labelSize + 3} textAnchor="middle" fontSize={labelSize} fill="var(--admin-muted)">
                {words.map((word, line) => (
                  <tspan key={word} x={x + barWidth / 2} dy={line === 0 ? 0 : labelSize * 1.15}>
                    {word}
                  </tspan>
                ))}
              </text>
              <rect
                x={padLeft + index * slot}
                y={BAR_PAD.top}
                width={slot}
                height={innerH + BAR_PAD.bottom}
                fill="transparent"
                onPointerEnter={() => setHover(index)}
                onPointerDown={() => setHover(index)}
              />
            </g>
          );
        })}
      </svg>

      {hovered && hover !== null ? (
        <Tooltip leftPercent={((padLeft + hover * slot + slot / 2) / BAR_W) * 100} topPercent={(hoveredTop / BAR_H) * 100 - 8}>
          <span className="text-[var(--admin-muted)]">{hovered.label}</span>{" "}
          <span className="font-semibold">
            {formatValue ? formatValue(hovered.count) : `${hovered.count} ${hovered.count === 1 ? unit : `${unit}s`}`}
          </span>
        </Tooltip>
      ) : null}
    </div>
  );
}

/** Task count per status as vertical bars. */
export function TaskStatusBarChart({ data }: { data: TaskStatusCount[] }) {
  return (
    <CategoryBarChart
      ariaLabel="Your tasks by status"
      unit="task"
      data={data.map((item) => ({ key: item.status, label: item.status, count: item.count, color: statusColor[item.status] }))}
    />
  );
}

/** Hours per project as horizontal bars, largest first. Each row carries its own name and value, so no legend is needed. */
export function HoursByProjectChart({ data }: { data: ProjectHours[] }) {
  const max = Math.max(...data.map((row) => row.hours), 0);

  return (
    <ul className="space-y-3" aria-label="Hours logged by project">
      {data.map((row) => (
        <li key={row.projectId} title={`${row.name}: ${row.hours}h`}>
          <div className="flex items-baseline justify-between gap-3 text-[12px]">
            <span className="min-w-0 truncate text-[var(--admin-ink)]">{row.name}</span>
            <span className="shrink-0 font-semibold text-[var(--admin-ink)]">{row.hours}h</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[var(--admin-bg)]">
            <div
              className="h-2 rounded-full bg-[var(--admin-blue)]"
              style={{ width: `${max > 0 ? Math.max(2, (row.hours / max) * 100) : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
