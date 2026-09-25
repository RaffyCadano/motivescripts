import { Link } from "react-router-dom";
import { ArrowRight, Check, FolderKanban } from "lucide-react";
import { ClientStatusBadge } from "@/components/client/ClientStatusBadge";
import type { OnboardingStep } from "@/data/preProject";
import { cn } from "@/lib/cn";

type ClientPreProjectDashboardProps = {
  firstName: string;
  phaseLabel: string;
  phaseTone: "progress" | "review" | "done" | "neutral";
  steps: OnboardingStep[];
  projectName: string | null;
  hasProject: boolean;
};

/** The step's status text without the trailing check the data adds ("Submitted ✓"); the dot already shows it. */
function stepStatus(step: OnboardingStep, number: number): string {
  if (step.statusLabel) return step.statusLabel.replace(/\s*✓\s*$/, "");
  return step.state === "done" ? "Done" : `Step ${number}`;
}

export function ClientPreProjectDashboard({
  firstName,
  phaseLabel,
  phaseTone,
  steps,
  projectName,
  hasProject,
}: ClientPreProjectDashboardProps) {
  const doneCount = steps.filter((step) => step.state === "done").length;
  const percent = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0;

  return (
    <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--client-blue)]">
            Let’s get your website project started
          </p>
          <h2 className="mt-2 font-heading text-xl font-semibold tracking-tight text-[var(--client-ink)] md:text-2xl">
            Welcome, {firstName}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--client-muted)]">
            Complete the steps below so we can prepare everything. This is not a hire yet — a proposal and contract come
            next.
          </p>
        </div>
        <ClientStatusBadge label={phaseLabel} tone={phaseTone} />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium text-[var(--client-ink)]">
            {doneCount} of {steps.length} steps done
          </span>
          <span className="font-heading font-semibold text-[var(--client-ink)]">{percent}%</span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--client-line)]"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Onboarding progress"
        >
          <div className="h-full rounded-full bg-[var(--client-blue)] transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <ol className="mt-6">
        {steps.map((step, index) => {
          const done = step.state === "done";
          const current = step.state === "current";
          const last = index === steps.length - 1;
          return (
            <li key={step.id} className="flex gap-3.5 sm:gap-4">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 font-heading text-[12px] font-semibold",
                    done && "border-[#0f7a56] bg-[#0f7a56] text-white",
                    current && "border-[var(--client-blue)] bg-white text-[var(--client-blue)] shadow-[0_0_0_4px_rgb(0_80_240_/_0.1)]",
                    !done && !current && "border-[var(--client-line)] bg-[var(--client-hover)] text-[var(--client-muted)]",
                  )}
                >
                  {done ? <Check size={15} strokeWidth={3} /> : index + 1}
                </span>
                {!last ? (
                  <span aria-hidden="true" className={cn("w-0.5 flex-1", done ? "bg-[#0f7a56]/40" : "bg-[var(--client-line)]")} />
                ) : null}
              </div>
              <div
                className={cn(
                  "min-w-0 flex-1 rounded-xl border px-4 py-3.5",
                  current
                    ? "border-[rgb(0_80_240_/_0.28)] bg-[rgb(0_80_240_/_0.03)]"
                    : done
                      ? "border-[var(--client-line)] bg-[var(--client-hover)]/50"
                      : "border-[var(--client-line)]",
                  !last && "mb-3",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold",
                        done && "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
                        current && "bg-[rgb(0_80_240_/_0.08)] text-[var(--client-blue)]",
                        !done && !current && "bg-[var(--client-hover)] text-[var(--client-muted)]",
                      )}
                    >
                      {stepStatus(step, index + 1)}
                    </span>
                    <p className="mt-1.5 font-heading text-sm font-semibold text-[var(--client-ink)]">{step.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-[var(--client-muted)]">{step.body}</p>
                  </div>
                  {step.href && step.actionLabel ? (
                    <Link
                      to={step.href}
                      className={cn(
                        "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-4 font-heading text-sm font-semibold",
                        current
                          ? "bg-[var(--client-blue)] text-white hover:bg-[var(--client-bright)]"
                          : "border border-[var(--client-line)] bg-white text-[var(--client-ink)] hover:bg-[var(--client-hover)]",
                      )}
                    >
                      {step.actionLabel}
                      {current ? <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" /> : null}
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div
        className={cn(
          "mt-5 flex items-start gap-3.5 rounded-xl border px-4 py-4",
          hasProject ? "border-[var(--client-line)]" : "border-dashed border-[var(--client-line)] bg-[var(--client-hover)]/50",
        )}
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            hasProject ? "bg-[rgb(0_80_240_/_0.08)] text-[var(--client-blue)]" : "bg-[var(--client-line)] text-[var(--client-muted)]",
          )}
        >
          <FolderKanban size={18} strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Project</p>
          <p className="mt-1 font-heading text-sm font-semibold text-[var(--client-ink)]">
            {hasProject ? (projectName ?? "Your project") : "Not started yet"}
          </p>
          <p className="mt-0.5 text-sm text-[var(--client-muted)]">
            {hasProject
              ? "MotiveScripts will share files and reviews here once production begins."
              : "A project record is created after we review your scope."}
          </p>
        </div>
      </div>
    </section>
  );
}
