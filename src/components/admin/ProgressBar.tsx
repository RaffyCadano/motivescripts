import { cn } from "@/lib/cn";

type ProgressBarProps = {
  value: number;
  label?: string;
};

export function ProgressBar({ value, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]">
        {label ? <span className="truncate text-[var(--admin-muted)]">{label}</span> : null}
        <span className="shrink-0 font-heading font-semibold text-[var(--admin-ink)]">{clamped}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[var(--admin-bg)]"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
      >
        <div
          className={cn(
            "h-full rounded-full bg-[linear-gradient(90deg,#0050F0,#00C8FF)]",
            "transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out)]",
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
