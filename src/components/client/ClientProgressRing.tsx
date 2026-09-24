import { cn } from "@/lib/cn";

type ClientProgressRingProps = {
  value: number;
  /** Diameter in px. */
  size?: number;
  /** Colors the ring green: the project is finished. */
  complete?: boolean;
  label?: string;
};

/** A circular progress meter with the percentage in the middle. */
export function ClientProgressRing({ value, size = 96, complete = false, label = "Project progress" }: ClientProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const stroke = Math.max(6, Math.round(size / 12));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-[var(--client-line)]" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className={cn(
            "transition-[stroke-dashoffset] duration-[var(--duration-slow)] ease-[var(--ease-out)]",
            complete ? "stroke-[#0f7a56]" : "stroke-[var(--client-blue)]",
          )}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-heading font-semibold tracking-tight text-[var(--client-ink)]"
        style={{ fontSize: Math.round(size * 0.26) }}
      >
        {clamped}
        <span className="text-[0.55em] text-[var(--client-muted)]">%</span>
      </span>
    </div>
  );
}
