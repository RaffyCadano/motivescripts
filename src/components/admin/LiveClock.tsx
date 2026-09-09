import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";

function formatNow(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
    <div className="flex items-center gap-2.5">
      <div className="text-right">
        <p className="text-[12px] text-[var(--admin-muted)]">Last refresh</p>
        <p className="mt-0.5 font-heading text-sm font-semibold tabular-nums text-[var(--admin-ink)]">{formatNow(now)}</p>
      </div>
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh dashboard data"
          title="Refresh"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--admin-line)] text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-hover)] hover:text-[var(--admin-blue)] disabled:opacity-60"
        >
          <RefreshCw size={14} strokeWidth={2} className={cn(refreshing && "animate-spin")} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
