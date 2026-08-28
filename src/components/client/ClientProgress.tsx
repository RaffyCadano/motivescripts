import { cn } from "@/lib/cn";

type ClientProgressProps = {
  value: number;
  label?: string;
};

export function ClientProgress({ value, label }: ClientProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        {label ? <span className="text-sm text-[var(--client-muted)]">{label}</span> : <span />}
        <span className="font-heading text-sm font-semibold text-[var(--client-ink)]">{clamped}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-[var(--client-bg)]"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Project progress"}
      >
        <div
          className={cn(
            "h-full rounded-full bg-[var(--client-blue)]",
            "transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out)]",
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
