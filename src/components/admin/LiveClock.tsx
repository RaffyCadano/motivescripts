import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";

function formatNow(date: Date, withYear: boolean): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" as const } : {}),
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

type LiveClockProps = {
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function LiveClock({ onRefresh, refreshing = false }: LiveClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3.5 py-2 sm:w-auto sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
      <div className="min-w-0 sm:text-right">
        <p className="text-[12px] text-[var(--admin-muted)]">Last refresh</p>
        <p className="mt-0.5 font-heading text-sm font-semibold tabular-nums text-[var(--admin-ink)]">
          <span className="sm:hidden">{formatNow(now, false)}</span>
          <span className="hidden sm:inline">{formatNow(now, true)}</span>
        </p>
      </div>
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh dashboard data"
          title="Refresh"
          className="inline-flex size-9 shrink-0 sm:size-8 items-center justify-center rounded-lg border border-[var(--admin-line)] text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-hover)] hover:text-[var(--admin-blue)] disabled:opacity-60"
        >
          <RefreshCw size={14} strokeWidth={2} className={cn(refreshing && "animate-spin")} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
