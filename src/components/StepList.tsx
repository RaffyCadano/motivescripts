import { cn } from "@/lib/cn";

type Step = { title: string; body?: string };

// Full class strings, not built from the column count: Tailwind only generates utilities it can see
// spelled out in the source.
const columnClass = {
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
  // Six steps sit as 3 + 3 on a tablet (md) rather than 2 + 2 + 2.
  6: "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
} as const;

/**
 * A connected stepper: each step is a numbered circle with its title and description centered below.
 * On desktop a thin line runs circle to circle -- each step's ::after reaches from its own center to the
 * next step's, so it lines up whatever the column width (the +1.5rem is the grid's gap-x-6) and is
 * hidden on the last step. Below lg the columns wrap, where a connecting line wouldn't line up, so it
 * is left out and the steps are just a centered grid (with an odd count in two columns, the last step
 * is centered across both instead of stranded under the left one). Numbers come from the order of `steps`; the
 * description is optional (a step can be just a title).
 */
export function StepList({
  steps,
  columns,
  compact = false,
  className,
}: {
  steps: readonly Step[];
  columns: keyof typeof columnClass;
  /** Two steps across on a phone (instead of one tall column) and a smaller title -- for short, title-only
   * lists that sit above something the visitor came to do, like a form, so they don't push it off screen. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("grid gap-x-6", compact ? "grid-cols-2 gap-y-8" : "gap-y-10", columnClass[columns], className)}>
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="group relative text-center sm:max-lg:odd:last:col-span-2 lg:after:absolute lg:after:left-1/2 lg:after:top-6 lg:after:h-px lg:after:w-[calc(100%+1.5rem)] lg:after:bg-[var(--color-line)] lg:last:after:hidden"
        >
          <span className="relative z-10 mx-auto flex size-12 items-center justify-center rounded-full border border-[var(--color-line)] bg-white font-heading text-sm font-bold tracking-[0.06em] text-blue shadow-[var(--shadow-card)] transition-colors duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:border-[rgb(0_80_240_/_0.4)] group-hover:bg-[rgb(0_80_240_/_0.04)]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <p className={cn("mt-4 font-heading font-semibold text-ink", compact ? "text-base sm:text-lg" : "text-lg")}>{step.title}</p>
          {step.body ? (
            <p className="mx-auto mt-2 max-w-[16rem] text-sm leading-relaxed text-muted">{step.body}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
