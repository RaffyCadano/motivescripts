import { Check } from "lucide-react";
import type { ProjectStage } from "@/data/clientPortal";
import { cn } from "@/lib/cn";

type ClientTimelineProps = {
  stages: ProjectStage[];
};

export function ClientTimeline({ stages }: ClientTimelineProps) {
  return (
    <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Project timeline</h2>
      <ol className="mt-6 flex flex-col gap-0 md:flex-row md:items-start">
        {stages.map((stage, index) => {
          const complete = stage.status === "complete";
          const current = stage.status === "current";
          const last = index === stages.length - 1;

          return (
            <li key={stage.id} className="flex min-w-0 flex-1 gap-3 md:flex-col md:items-center md:gap-0">
              <div className="flex flex-col items-center md:w-full md:flex-row">
                <span
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 font-heading text-xs font-semibold",
                    complete && "border-[var(--client-blue)] bg-[var(--client-blue)] text-white",
                    current && "border-[var(--client-blue)] bg-white text-[var(--client-blue)] ring-4 ring-[rgb(0_80_240_/_0.12)]",
                    !complete && !current && "border-[var(--client-line)] bg-white text-[var(--client-muted)]",
                  )}
                  aria-current={current ? "step" : undefined}
                >
                  {complete ? (
                    <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                  ) : current ? (
                    <span className="size-2 rounded-full bg-[var(--client-blue)]" aria-hidden="true" />
                  ) : null}
                  <span className="sr-only">
                    {stage.label}
                    {complete ? ", completed" : current ? ", current stage" : ", upcoming"}
                  </span>
                </span>
                {!last ? (
                  <span
                    className={cn(
                      "w-px flex-1 md:h-px md:w-auto",
                      complete ? "bg-[var(--client-blue)]" : "bg-[var(--client-line)]",
                      "min-h-6 md:min-h-0",
                    )}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <p
                className={cn(
                  "font-heading text-sm font-semibold md:mt-3 md:text-center",
                  !last && "pb-6 md:pb-0",
                  current ? "text-[var(--client-blue)]" : complete ? "text-[var(--client-ink)]" : "text-[var(--client-muted)]",
                )}
              >
                {stage.label}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
