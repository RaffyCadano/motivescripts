import { cn } from "@/lib/cn";

type Tone = "progress" | "review" | "done" | "neutral" | "changes";

const tones: Record<Tone, string> = {
  progress: "bg-[rgb(0_80_240_/_0.08)] text-[var(--client-blue)]",
  review: "bg-[rgb(0_200_255_/_0.12)] text-[#0077aa]",
  done: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  changes: "bg-[rgb(7_17_31_/_0.06)] text-[var(--client-ink)]",
  neutral: "bg-[var(--client-bg)] text-[var(--client-muted)]",
};

type ClientStatusBadgeProps = {
  label: string;
  tone?: Tone;
};

export function ClientStatusBadge({ label, tone = "progress" }: ClientStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-heading text-[11px] font-semibold tracking-tight",
        tones[tone],
      )}
    >
      {label}
    </span>
  );
}
