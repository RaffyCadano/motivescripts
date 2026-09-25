import { CircleCheck, TriangleAlert } from "lucide-react";
import { AdminProgressPill, AdminStepTrack, type AdminStep } from "@/components/admin/projects/AdminStepTrack";
import type { AgencyDeliverable } from "@/data/files";
import type { AgencyProject } from "@/data/agencyProjects";
import { productionPhaseSummary, type ProductionPhase } from "@/data/productionWorkflow";

const PHASES: { id: ProductionPhase; label: string }[] = [
  { id: "design", label: "Design Approval" },
  { id: "development", label: "Development" },
  { id: "qa", label: "QA" },
  { id: "client_review", label: "Client Review" },
  { id: "final_approval", label: "Final Approval" },
  { id: "launch_ready", label: "Launch" },
  { id: "handoff", label: "Handoff" },
];

/**
 * Admin/PM-facing compact summary of the delivery workflow (Design Approval
 * -> ... -> Launch), sitting alongside the commercial-progress panel and
 * drawn with the same step track. Read-only: every gate here is enforced
 * server-side (see 20260930090000_production_workflow_gates.sql); this never
 * allows or blocks an action on its own.
 */
export function ProjectDeliveryProgress({
  project,
  deliverables,
  invoiceStatuses,
}: {
  project: Pick<AgencyProject, "milestones" | "tasks" | "development" | "status">;
  deliverables: AgencyDeliverable[];
  invoiceStatuses: string[];
}) {
  const summary = productionPhaseSummary(project, deliverables, invoiceStatuses);
  const completed = summary.phase === "completed";
  const currentIndex = completed ? PHASES.length : PHASES.findIndex((item) => item.id === summary.phase);
  const steps: AdminStep[] = PHASES.map((item, index) => ({
    id: item.id,
    label: item.label,
    state: completed || index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
  }));
  const doneCount = steps.filter((step) => step.state === "done").length;

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Delivery progress</h2>
        <AdminProgressPill done={doneCount} total={PHASES.length} />
      </div>
      <div className="mt-4">
        <AdminStepTrack steps={steps} />
      </div>
      <div
        className={
          completed
            ? "mt-4 flex items-start gap-2.5 rounded-lg border border-[rgb(16_185_129_/_0.25)] bg-[rgb(16_185_129_/_0.06)] px-3.5 py-3"
            : "mt-4 flex items-start gap-2.5 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3.5 py-3"
        }
      >
        {completed ? (
          <CircleCheck size={18} strokeWidth={2.2} className="mt-0.5 shrink-0 text-[#0f7a56]" aria-hidden="true" />
        ) : summary.blocking ? (
          <TriangleAlert size={18} strokeWidth={2.2} className="mt-0.5 shrink-0 text-[#b45309]" aria-hidden="true" />
        ) : null}
        <div className="min-w-0">
          <p className={`font-heading text-sm font-semibold ${completed ? "text-[#0f7a56]" : "text-[var(--admin-ink)]"}`}>{summary.phaseLabel}</p>
          {summary.blocking ? <p className="mt-0.5 text-[13px] text-[#b45309]">{summary.blocking}</p> : null}
          <p className="mt-0.5 text-[13px] text-[var(--admin-muted)]">Next: {summary.nextAction}</p>
        </div>
      </div>
    </section>
  );
}
