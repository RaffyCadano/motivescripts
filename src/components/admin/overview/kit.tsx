import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { trendChange } from "@/data/overviewExtras";
import { cn } from "@/lib/cn";

/** The one card look used across the redesigned Overview. */
export const overviewCardClass =
  "rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] shadow-[0_1px_2px_rgb(7_17_31_/_0.04)]";

export function OverviewCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: { label: string; to: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(overviewCardClass, "p-5", className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon ? (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
              <Icon size={16} strokeWidth={2} aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="font-heading text-[15px] font-semibold tracking-tight text-[var(--admin-ink)]">{title}</h2>
            {description ? <p className="mt-0.5 text-[12px] leading-snug text-[var(--admin-muted)]">{description}</p> : null}
          </div>
        </div>
        {action ? (
          <Link to={action.to} className="shrink-0 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
            {action.label}
          </Link>
        ) : null}
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** What a card shows when there is nothing to show yet: an icon, one line of explanation, and where to start. */
export function OverviewEmpty({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-[var(--admin-bg)] text-[var(--admin-muted)]">
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="mt-3 font-heading text-sm font-semibold text-[var(--admin-ink)]">{title}</p>
      <p className="mt-1 max-w-xs text-[13px] leading-snug text-[var(--admin-muted)]">{body}</p>
      {action ? (
        <Link
          to={action.to}
          className="mt-4 inline-flex h-9 items-center rounded-[var(--admin-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[rgb(0_80_240_/_0.08)] px-3.5 font-heading text-[13px] font-semibold text-[var(--admin-blue)] hover:bg-[rgb(0_80_240_/_0.14)]"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-2.5 font-heading text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)]">{children}</h2>;
}

type Tone = "neutral" | "good" | "warn" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  good: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  warn: "bg-[rgb(245_158_11_/_0.14)] text-[#b45309]",
  danger: "bg-[rgb(220_38_38_/_0.09)] text-[#b42318]",
};

/**
 * One headline number: an icon, the label, the value, and a line of context. A count can also show how it changed
 * over the last 12 days. The whole tile is a link to where you would act on it.
 */
export function MetricTile({
  icon: Icon,
  label,
  value,
  caption,
  href,
  tone = "neutral",
  valueTone,
  trend,
  higherIsBetter = true,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  caption?: string;
  href: string;
  tone?: Tone;
  /** "danger" colours the number itself, for money that is late. */
  valueTone?: "danger";
  trend?: number[];
  higherIsBetter?: boolean;
}) {
  const change = trend ? trendChange(trend) : null;
  const showChange = change && change.direction !== "flat";
  const good = change && change.direction !== "flat" ? (change.direction === "up") === higherIsBetter : null;

  return (
    <Link
      to={href}
      className={cn(
        overviewCardClass,
        "group flex min-w-0 flex-col gap-3 p-4 transition-[border-color,box-shadow] hover:border-[rgb(0_80_240_/_0.3)] hover:shadow-[0_4px_14px_rgb(7_17_31_/_0.07)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-blue)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("flex size-9 items-center justify-center rounded-lg", TONES[tone])}>
          <Icon size={17} strokeWidth={2} aria-hidden="true" />
        </span>
        {showChange ? (
          <span
            title="Change over the last 12 days"
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
              good ? "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]" : "bg-[rgb(220_38_38_/_0.08)] text-[#b42318]",
            )}
          >
            {change.label}
          </span>
        ) : (
          <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" className="text-[var(--admin-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[12px] text-[var(--admin-muted)]">{label}</p>
        <p
          className={cn(
            "mt-0.5 truncate font-heading text-[1.65rem] font-semibold leading-tight tracking-tight",
            valueTone === "danger" ? "text-[#b42318]" : "text-[var(--admin-ink)]",
          )}
        >
          {value}
        </p>
        {caption ? <p className="mt-0.5 truncate text-[12px] text-[var(--admin-muted)]">{caption}</p> : null}
      </div>
    </Link>
  );
}
