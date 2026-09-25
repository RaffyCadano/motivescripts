import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type AdminStepState = "done" | "current" | "upcoming";

export type AdminStep = { id: string; label: string; state: AdminStepState };

/**
 * A row of workflow steps for the admin project overview: a progress segment on top of each step (filled when
 * done, half-filled for the current one), then a check / dot and the label. Two columns on a phone, four on a
 * tablet and one line on a wide screen. Shared by the commercial and the delivery progress panels.
 */
export function AdminStepTrack({ steps }: { steps: AdminStep[] }) {
  return (
    <ol className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-flow-col lg:auto-cols-fr">
      {steps.map((step) => {
        const done = step.state === "done";
        const current = step.state === "current";
        return (
          <li key={step.id} className="min-w-0" aria-current={current ? "step" : undefined}>
            <span
              aria-hidden="true"
              className={cn(
                "mb-2 block h-1.5 rounded-full",
                done && "bg-[var(--admin-blue)]",
                current && "bg-[linear-gradient(90deg,var(--admin-blue)_0%,var(--admin-blue)_45%,rgb(0_80_240_/_0.18)_45%)]",
                !done && !current && "bg-[var(--admin-line)]",
              )}
            />
            <div className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]",
                  done && "border-[var(--admin-blue)] bg-[var(--admin-blue)] text-white",
                  current && "border-[var(--admin-blue)] bg-white",
                  !done && !current && "border-[var(--admin-line)] bg-white",
                )}
              >
                {done ? <Check size={11} strokeWidth={3} /> : current ? <span className="size-1.5 rounded-full bg-[var(--admin-blue)]" /> : null}
              </span>
              <span
                className={cn(
                  "text-[13px] leading-snug",
                  current ? "font-heading font-semibold text-[var(--admin-blue)]" : done ? "font-medium text-[var(--admin-ink)]" : "text-[var(--admin-muted)]",
                )}
              >
                {step.label}
                <span className="sr-only">{done ? ", completed" : current ? ", current step" : ", upcoming"}</span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The small "3 of 8 done" / "Complete" pill in a panel header. */
export function AdminProgressPill({ done, total }: { done: number; total: number }) {
  const all = total > 0 && done >= total;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-heading text-xs font-semibold",
        all ? "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]" : "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
      )}
    >
      {all ? <Check size={12} strokeWidth={2.8} aria-hidden="true" /> : null}
      {all ? "Complete" : `${done} of ${total} done`}
    </span>
  );
}
