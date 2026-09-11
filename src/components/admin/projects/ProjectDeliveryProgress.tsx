import type { AgencyDeliverable } from "@/data/files";
import type { AgencyProject } from "@/data/agencyProjects";
import { productionPhaseSummary, type ProductionPhase } from "@/data/productionWorkflow";
import { cn } from "@/lib/cn";

const PHASES: { id: ProductionPhase; label: string }[] = [
  { id: "design", label: "Design Approval" },
  { id: "development", label: "Development" },
  { id: "qa", label: "QA" },
  { id: "client_review", label: "Client Review" },
  { id: "final_approval", label: "Final Approval" },
  { id: "launch_ready", label: "Launch" },
];

/**
 * Admin/PM-facing compact summary of the delivery workflow (Design Approval
 * -> ... -> Launch), sitting alongside the existing commercial-progress
 * strip. Reuses that component's exact visual pattern. Read-only: every
 * gate here is enforced server-side (see 20260930090000_production_workflow_gates.sql);
 * this never allows or blocks an action on its own.
 */
export function ProjectDeliveryProgress({
  project,
  deliverables,
  invoiceStatuses,
}: {
  project: Pick<AgencyProject, "milestones" | "tasks" | "development">;
  deliverables: AgencyDeliverable[];
  invoiceStatuses: string[];
}) {
  const summary = productionPhaseSummary(project, deliverables, invoiceStatuses);
  const currentIndex = summary.phase === "launched" ? PHASES.length : PHASES.findIndex((item) => item.id === summary.phase);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">Delivery progress</p>
      <ol className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-[13px]">
        {PHASES.map((item, index) => {
          const done = index < currentIndex || summary.phase === "launched";
          const current = index === currentIndex;
          return (
            <li key={item.id} className="flex items-center gap-1">
              {index > 0 ? <span className="text-[var(--admin-muted)]" aria-hidden="true">→</span> : null}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
                  current && "bg-[rgb(0_80_240_/_0.08)] font-heading font-semibold text-[var(--admin-blue)]",
                  done && !current && "text-[var(--admin-ink)]",
                  !done && !current && "text-[var(--admin-muted)]",
                )}
              >
                <span aria-hidden="true">{done ? "✓" : current ? "●" : "○"}</span>
                {item.label}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 border-t border-[var(--admin-line)] pt-3">
        <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{summary.phaseLabel}</p>
        {summary.blocking ? <p className="mt-0.5 text-[13px] text-[#b45309]">{summary.blocking}</p> : null}
        <p className="mt-1 text-[13px] text-[var(--admin-muted)]">Next: {summary.nextAction}</p>
      </div>
    </section>
  );
}
