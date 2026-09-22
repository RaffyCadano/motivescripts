import { useEffect, useMemo, useState } from "react";
import type { WebsiteHealthCheck } from "@/data/websiteHealth";

type BucketStatus = "healthy" | "degraded" | "down" | "unknown";

type Bucket = {
  start: number;
  end: number;
  status: BucketStatus;
  checks: WebsiteHealthCheck[];
};

// Same status colors the rest of the app already uses (badges, dots) -- reused here rather than
// invented, for consistency. Never relied on alone: every segment and the legend also carry text.
const statusFill: Record<BucketStatus, string> = {
  healthy: "#10b981",
  degraded: "#f59e0b",
  down: "#dc2626",
  unknown: "var(--admin-line)",
};

const statusLabel: Record<BucketStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
  unknown: "No data",
};

const WORST_FIRST: BucketStatus[] = ["down", "degraded", "healthy"];

function worstStatus(checks: WebsiteHealthCheck[]): BucketStatus {
  if (checks.length === 0) return "unknown";
  const statuses = new Set(checks.map((check) => check.status as BucketStatus));
  for (const candidate of WORST_FIRST) {
    if (statuses.has(candidate)) return candidate;
  }
  return "unknown";
}

const BUCKET_COUNT = 48;

/**
 * Uptime as a status timeline: the window divided into equal buckets, each colored by the worst
 * status seen in it (down outranks degraded outranks healthy) -- a bucket never hides an outage
 * behind a healthy check that happened to land in the same slice. Each segment is its own hit
 * target (bar/cell rule: the mark IS the target, no crosshair needed).
 */
export function UptimeTimeline({ checks, hoursBack }: { checks: WebsiteHealthCheck[]; hoursBack: number }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Bucket count is fixed, so a stale hoverIndex can't go out of bounds here -- but without this,
  // switching the time range or the selected project without moving the mouse would keep showing
  // the old bucket's tooltip at the same screen position, now describing a different time slice.
  useEffect(() => {
    setHoverIndex(null);
  }, [checks, hoursBack]);

  const buckets = useMemo<Bucket[]>(() => {
    const now = Date.now();
    const start = now - hoursBack * 60 * 60 * 1000;
    const bucketMs = (now - start) / BUCKET_COUNT;
    const rows: Bucket[] = Array.from({ length: BUCKET_COUNT }, (_, index) => ({
      start: start + index * bucketMs,
      end: start + (index + 1) * bucketMs,
      status: "unknown",
      checks: [],
    }));
    for (const check of checks) {
      const t = new Date(check.checkedAt).getTime();
      if (Number.isNaN(t)) continue;
      const index = Math.min(BUCKET_COUNT - 1, Math.max(0, Math.floor((t - start) / bucketMs)));
      rows[index].checks.push(check);
    }
    for (const bucket of rows) bucket.status = worstStatus(bucket.checks);
    return rows;
  }, [checks, hoursBack]);

  const hovered = hoverIndex !== null ? buckets[hoverIndex] : null;
  const spansMultipleDays = hoursBack > 36;

  function formatBucketTime(ms: number): string {
    const date = new Date(ms);
    return spansMultipleDays
      ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric" })
      : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div>
      <div className="relative flex h-8 gap-[2px] overflow-hidden rounded-[6px]">
        {buckets.map((bucket, index) => (
          <button
            key={index}
            type="button"
            className="min-w-0 flex-1 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-blue)]"
            style={{ backgroundColor: statusFill[bucket.status], opacity: hoverIndex !== null && hoverIndex !== index ? 0.55 : 1 }}
            onPointerEnter={() => setHoverIndex(index)}
            onFocus={() => setHoverIndex(index)}
            onPointerLeave={() => setHoverIndex(null)}
            onBlur={() => setHoverIndex(null)}
            aria-label={`${formatBucketTime(bucket.start)}: ${statusLabel[bucket.status]}${
              bucket.checks.length > 0 ? `, ${bucket.checks.length} check${bucket.checks.length === 1 ? "" : "s"}` : ""
            }`}
          />
        ))}
      </div>

      <div className="mt-1.5 flex justify-between text-[11px] text-[var(--admin-muted)]">
        <span>{formatBucketTime(buckets[0]?.start ?? Date.now())}</span>
        <span>now</span>
      </div>

      {hovered ? (
        <div className="mt-2 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-2 text-[12px]">
          <p className="font-heading font-semibold text-[var(--admin-ink)]">
            {statusLabel[hovered.status]}
            {hovered.checks.length > 0 ? ` · ${hovered.checks.length} check${hovered.checks.length === 1 ? "" : "s"}` : ""}
          </p>
          <p className="text-[var(--admin-muted)]">
            {formatBucketTime(hovered.start)} – {formatBucketTime(hovered.end)}
          </p>
        </div>
      ) : null}

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {(["healthy", "degraded", "down"] as const).map((status) => (
          <li key={status} className="flex items-center gap-1.5 text-[12px] text-[var(--admin-muted)]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: statusFill[status] }} aria-hidden="true" />
            {statusLabel[status]}
          </li>
        ))}
      </ul>
    </div>
  );
}
