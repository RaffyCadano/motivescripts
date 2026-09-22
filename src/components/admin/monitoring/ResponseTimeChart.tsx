import { useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { WebsiteHealthCheck } from "@/data/websiteHealth";

const WIDTH = 960;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

type Plotted = { x: number; y: number; check: WebsiteHealthCheck };

/** Rounds up to a "clean" axis max: 1/2/5 x a power of ten, per the mark spec (clean numbers, not raw maxima). */
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

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s` : `${Math.round(ms)}ms`;
}

function formatTimeTick(iso: string, spansMultipleDays: boolean): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return spansMultipleDays
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/**
 * Response time over the selected window. Only healthy/degraded checks carry a response time --
 * the line breaks (never interpolates) across a down period, so an outage never gets papered over
 * as a smooth line. Single series: no legend box needed, the card title already says what's plotted.
 */
export function ResponseTimeChart({ checks }: { checks: WebsiteHealthCheck[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { points, segments, yMax, spansMultipleDays } = useMemo(() => {
    const withTime = checks
      .map((check) => ({ check, ms: new Date(check.checkedAt).getTime() }))
      .filter((row) => !Number.isNaN(row.ms));
    if (withTime.length < 2) return { points: [] as Plotted[], segments: [] as Plotted[][], yMax: 100, spansMultipleDays: false };

    const minTime = withTime[0].ms;
    const maxTime = withTime[withTime.length - 1].ms;
    const timeRange = Math.max(maxTime - minTime, 1);
    const xScale = (t: number) => PAD.left + ((t - minTime) / timeRange) * PLOT_W;

    const maxResponse = Math.max(0, ...withTime.map((row) => row.check.responseTimeMs ?? 0));
    const niceYMax = niceMax(maxResponse || 100);
    const yScale = (ms: number) => PAD.top + PLOT_H - (ms / niceYMax) * PLOT_H;

    const allPoints: Plotted[] = [];
    const runs: Plotted[][] = [];
    let current: Plotted[] = [];
    for (const row of withTime) {
      if (row.check.responseTimeMs === null) {
        if (current.length > 0) runs.push(current);
        current = [];
        continue;
      }
      const point: Plotted = { x: xScale(row.ms), y: yScale(row.check.responseTimeMs), check: row.check };
      current.push(point);
      allPoints.push(point);
    }
    if (current.length > 0) runs.push(current);

    return {
      points: allPoints,
      segments: runs,
      yMax: niceYMax,
      spansMultipleDays: maxTime - minTime > 36 * 60 * 60 * 1000,
    };
  }, [checks]);

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
      <div className="flex h-[180px] items-center justify-center text-sm text-[var(--admin-muted)]">
        Not enough data yet for this window.
      </div>
    );
  }

  const yTicks = [0, yMax / 2, yMax];
  const xTickPoints = [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]];
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const last = points[points.length - 1];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ height: "auto" }} role="img" aria-label="Response time over the selected window">
        {yTicks.map((tick) => {
          const y = PAD.top + PLOT_H - (tick / yMax) * PLOT_H;
          return (
            <g key={tick}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} stroke="var(--admin-line)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y} textAnchor="end" dominantBaseline="middle" className="fill-[var(--admin-muted)]" fontSize={11}>
                {formatMs(tick)}
              </text>
            </g>
          );
        })}

        {segments.map((segment, segmentIndex) => {
          const path = segment.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
          return <path key={segmentIndex} d={path} fill="none" stroke="var(--admin-blue)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
        })}

        {/* End marker + direct label, per spec: lines get a value at the end. */}
        <circle cx={last.x} cy={last.y} r={4} fill="var(--admin-blue)" stroke="var(--admin-card)" strokeWidth={2} />
        <text x={Math.min(last.x + 8, WIDTH - PAD.right - 2)} y={last.y} textAnchor="end" dominantBaseline="middle" fontSize={11} className="fill-[var(--admin-ink)] font-semibold">
          {last.check.responseTimeMs !== null ? formatMs(last.check.responseTimeMs) : ""}
        </text>

        {xTickPoints.map((point, index) => (
          <text
            key={index}
            x={point.x}
            y={HEIGHT - 8}
            textAnchor={index === 0 ? "start" : index === xTickPoints.length - 1 ? "end" : "middle"}
            fontSize={11}
            className="fill-[var(--admin-muted)]"
          >
            {formatTimeTick(point.check.checkedAt, spansMultipleDays)}
          </text>
        ))}

        {hovered ? (
          <g aria-hidden="true">
            <line x1={hovered.x} x2={hovered.x} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--admin-muted)" strokeWidth={1} strokeDasharray="2 3" />
            <circle cx={hovered.x} cy={hovered.y} r={5} fill="var(--admin-blue)" stroke="var(--admin-card)" strokeWidth={2} />
          </g>
        ) : null}

        {/* Full-plot hit area: the crosshair finds the X, the reader never has to aim at the line. */}
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
          <p className="font-heading font-semibold text-[var(--admin-ink)]">
            {hovered.check.responseTimeMs !== null ? formatMs(hovered.check.responseTimeMs) : "—"}
          </p>
          <p className="text-[var(--admin-muted)]">
            {new Date(hovered.check.checkedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      ) : null}
    </div>
  );
}
