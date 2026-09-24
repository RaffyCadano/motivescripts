import { Check } from "lucide-react";
import type { ProjectStage, ProjectStageStatus } from "@/data/clientPortal";
import { cn } from "@/lib/cn";

type ClientTimelineProps = {
  stages: ProjectStage[];
  title?: string;
};

const statusText: Record<ProjectStageStatus, string> = {
  complete: "Completed",
  current: "In progress",
  upcoming: "Upcoming",
};

/**
 * A row of stages with a progress bar segment on top of each one on wide screens (the bar is what shows
 * how far along the project is), and a plain list of cards on narrow ones. The header says how many are
 * done. Used for both the project's phases and the "what do you need from us" checklist.
 */
export function ClientTimeline({ stages, title = "Project timeline" }: ClientTimelineProps) {
  const done = stages.filter((stage) => stage.status === "complete").length;
  const allDone = stages.length > 0 && done === stages.length;

  return (
    <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">{title}</h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-heading text-xs font-semibold",
            allDone ? "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]" : "bg-[rgb(0_80_240_/_0.08)] text-[var(--client-blue)]",
          )}
        >
          {allDone ? <Check size={13} strokeWidth={2.8} aria-hidden="true" /> : null}
          {allDone ? "All complete" : `${done} of ${stages.length} complete`}
        </span>
      </div>

      <ol className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr lg:gap-3">
        {stages.map((stage, index) => {
          const complete = stage.status === "complete";
          const current = stage.status === "current";

          return (
            <li
              key={stage.id}
              className={cn(
                "min-w-0 rounded-[var(--client-radius)] border p-3.5 lg:border-0 lg:bg-transparent lg:p-0",
                current
                  ? "border-[rgb(0_80_240_/_0.3)] bg-[rgb(0_80_240_/_0.04)]"
                  : "border-[var(--client-line)] bg-[var(--client-bg)]",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mb-3 hidden h-1.5 rounded-full lg:block",
                  complete && "bg-[var(--client-blue)]",
                  current && "bg-[linear-gradient(90deg,var(--client-blue)_0%,var(--client-blue)_45%,rgb(0_80_240_/_0.18)_45%)]",
                  !complete && !current && "bg-[var(--client-line)]",
                )}
              />
              <div className="flex items-center gap-3 lg:items-start lg:gap-2.5">
                <span
                  className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 font-heading text-[11px] font-semibold",
                    complete && "border-[var(--client-blue)] bg-[var(--client-blue)] text-white",
                    current && "border-[var(--client-blue)] bg-white text-[var(--client-blue)] ring-4 ring-[rgb(0_80_240_/_0.12)]",
                    !complete && !current && "border-[var(--client-line)] bg-white text-[var(--client-muted)]",
                  )}
                  aria-current={current ? "step" : undefined}
                >
                  {complete ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : <span aria-hidden="true">{index + 1}</span>}
                  <span className="sr-only">
                    {stage.label}
                    {complete ? ", completed" : current ? ", current stage" : ", upcoming"}
                  </span>
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "font-heading text-sm font-semibold leading-snug",
                      complete || current ? "text-[var(--client-ink)]" : "text-[var(--client-muted)]",
                    )}
                  >
                    {stage.label}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs font-medium",
                      complete ? "text-[#0f7a56]" : current ? "text-[var(--client-blue)]" : "text-[var(--client-muted)]",
                    )}
                  >
                    {statusText[stage.status]}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
