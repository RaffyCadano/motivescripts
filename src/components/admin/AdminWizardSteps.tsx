import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The "Step 2 of 4" header for an admin form that runs in steps: a numbered track the person can also click to
 * move between steps. Whether a jump is allowed (an earlier step is incomplete) is up to `onGo`.
 */
export function AdminWizardSteps({
  steps,
  current,
  onGo,
  hint,
}: {
  steps: readonly string[];
  current: number;
  onGo: (index: number) => void;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">
          Step {current + 1} of {steps.length}
        </p>
        {hint ? <p className="text-[12px] text-[var(--admin-muted)]">{hint}</p> : null}
      </div>
      <ol className="mt-4 flex items-start">
        {steps.map((label, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={label} className="flex min-w-0 flex-1 items-start last:flex-none">
              <button
                type="button"
                onClick={() => onGo(index)}
                aria-current={active ? "step" : undefined}
                className="group flex flex-col items-center gap-2 text-center"
              >
                <span
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-full border-2 font-heading text-xs font-semibold transition-colors",
                    done && "border-[var(--admin-blue)] bg-[var(--admin-blue)] text-white",
                    active && "border-[var(--admin-blue)] bg-white text-[var(--admin-blue)] ring-4 ring-[rgb(0_80_240_/_0.12)]",
                    !done && !active && "border-[var(--admin-line)] bg-white text-[var(--admin-muted)] group-hover:border-[rgb(0_80_240_/_0.35)]",
                  )}
                >
                  {done ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "font-heading text-[12px] font-semibold",
                    active ? "text-[var(--admin-ink)]" : "text-[var(--admin-muted)]",
                    !active && "hidden sm:block",
                  )}
                >
                  {label}
                </span>
              </button>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn("mx-2 mt-4 h-px flex-1", index < current ? "bg-[var(--admin-blue)]" : "bg-[var(--admin-line)]")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
