import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Sparkline } from "@/components/admin/list/Sparkline";
import { trendChange } from "@/data/overviewExtras";
import { cn } from "@/lib/cn";

export function AdminStatGrid({
  columns = 4,
  children,
}: {
  columns?: 2 | 4 | 5 | 6;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2.5",
        columns === 2 && "sm:grid-cols-2",
        columns === 4 && "sm:grid-cols-2 xl:grid-cols-4",
        columns === 5 && "sm:grid-cols-3 xl:grid-cols-5",
        columns === 6 && "sm:grid-cols-3 xl:grid-cols-6",
      )}
    >
      {children}
    </div>
  );
}

function DeltaBadge({ trend, higherIsBetter }: { trend: number[]; higherIsBetter: boolean }) {
  const change = trendChange(trend);
  if (!change) return null;
  const { direction, label } = change;
  const good = direction === "flat" ? null : (direction === "up") === higherIsBetter;
  const tone =
    good === null
      ? "bg-[var(--admin-bg)] text-[var(--admin-muted)]"
      : good
        ? "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]"
        : "bg-[rgb(220_38_38_/_0.08)] text-[#b42318]";
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;

  return (
    <span
      className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold", tone)}
      title="Change over the last 12 days"
    >
      <Icon size={10} strokeWidth={2.5} aria-hidden="true" />
      {label}
    </span>
  );
}

export function AdminStatCard({
  label,
  value,
  active = false,
  secondary = false,
  href,
  onClick,
  trend,
  higherIsBetter = true,
  caption,
  tone,
}: {
  label: string;
  value: string | number;
  active?: boolean;
  secondary?: boolean;
  href?: string;
  onClick?: () => void;
  /** Optional 12-point history ending at `value` -- see buildCumulativeTrend. Also drives the delta badge. */
  trend?: number[];
  /** Whether an increase is good news (green) or bad news (red). Defaults to true; set false for backlog-style counts. */
  higherIsBetter?: boolean;
  /** A short line under the value, for example "2 invoices". */
  caption?: string;
  /** "danger" colours the value red, for money or counts that need action. */
  tone?: "danger";
}) {
  const className = cn(
    "rounded-[var(--admin-radius)] border bg-[var(--admin-card)] text-left transition-colors",
    secondary ? "px-4 py-2.5" : "px-4 py-2.5",
    active
      ? "border-[rgb(0_80_240_/_0.35)] ring-1 ring-[rgb(0_80_240_/_0.16)]"
      : "border-[var(--admin-line)] hover:border-[rgb(0_80_240_/_0.18)]",
  );
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-[var(--admin-muted)]">{label}</p>
        {trend ? <DeltaBadge trend={trend} higherIsBetter={higherIsBetter} /> : null}
      </div>
      <div className="mt-0.5 flex items-end justify-between gap-2">
        <p
          className={cn(
            "min-w-0 truncate font-heading font-semibold tracking-tight",
            secondary ? "text-xl" : "text-[1.5rem]",
            tone === "danger" ? "text-[#b42318]" : "text-[var(--admin-ink)]",
          )}
        >
          {value}
        </p>
        {trend ? (
          // Text values (money) need the room on a phone; the delta badge above still shows the direction.
          <Sparkline values={trend} className={cn("mb-0.5 shrink-0", typeof value === "string" && "max-sm:hidden")} />
        ) : null}
      </div>
      {caption ? <p className="mt-0.5 truncate text-[12px] text-[var(--admin-muted)]">{caption}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link to={href} className={className}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={className}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}
