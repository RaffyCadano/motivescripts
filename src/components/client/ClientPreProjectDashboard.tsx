import { Link } from "react-router-dom";
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

export function ClientPreProjectDashboard({
  firstName,
  phaseLabel,
  phaseTone,
  steps,
  projectName,
  hasProject,
}: ClientPreProjectDashboardProps) {
  return (
    <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">
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

      <ol className="mt-6 space-y-3">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={cn(
              "rounded-xl border px-4 py-4",
              step.state === "current"
                ? "border-[rgb(0_80_240_/_0.22)] bg-[rgb(0_80_240_/_0.03)]"
                : "border-[var(--client-line)]",
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">
                  {step.state === "done" ? "Done" : `Step ${index}`}
                </p>
                <p className="mt-1 font-heading text-sm font-semibold text-[var(--client-ink)]">
                  {step.state === "done" ? `✓ ${step.title}` : step.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--client-muted)]">{step.body}</p>
              </div>
              {step.href && step.actionLabel ? (
                <Link
                  to={step.href}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] px-4 font-heading text-sm font-semibold",
                    step.state === "current"
                      ? "bg-[var(--client-blue)] text-white hover:bg-[var(--client-bright)]"
                      : "border border-[var(--client-line)] bg-white text-[var(--client-ink)] hover:bg-[var(--client-hover)]",
                  )}
                >
                  {step.actionLabel}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5 rounded-xl border border-[var(--client-line)] px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Project</p>
        <p className="mt-1 font-heading text-sm font-semibold text-[var(--client-ink)]">
          {hasProject ? (projectName ?? "Your project") : "Not started yet"}
        </p>
        <p className="mt-1 text-sm text-[var(--client-muted)]">
          {hasProject
            ? "MotiveScripts will share files and reviews here once production begins."
            : "A project record is created after we review your scope."}
        </p>
      </div>
    </section>
  );
}
