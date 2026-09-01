import type { OverviewPipelineCounts } from "@/data/adminOverview";

const stages: { id: keyof OverviewPipelineCounts; label: string }[] = [
  { id: "lead", label: "Lead" },
  { id: "client", label: "Client" },
  { id: "scope", label: "Scope" },
  { id: "project", label: "Projects" },
  { id: "proposal", label: "Proposals" },
  { id: "contract", label: "Contracts" },
  { id: "invoice", label: "Invoices" },
  { id: "paid", label: "Paid" },
];

export function OverviewWorkflow({ counts }: { counts: OverviewPipelineCounts }) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-4">
      <div>
        <h2 className="font-heading text-sm font-semibold tracking-tight">Workflow</h2>
        <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
          Lead → Client → Scope → Project → Proposal → Contract → Invoice → Paid
        </p>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {stages.map((stage) => (
          <li key={stage.id} className="rounded-xl bg-[var(--admin-bg)] px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">{stage.label}</p>
            <p className="mt-1 font-heading text-xl font-semibold tracking-tight text-[var(--admin-ink)]">{counts[stage.id]}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
