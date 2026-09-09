import type { OverviewPipelineCounts } from "@/data/adminOverview";

// Fixed categorical order (never re-sorted by size) -- pipeline order doubles
// as a secondary identity cue alongside color, since 8 slices can't all be
// pairwise color-distinct for every vision type.
const stages: { id: keyof OverviewPipelineCounts; label: string; color: string }[] = [
  { id: "lead", label: "Lead", color: "#2a78d6" },
  { id: "client", label: "Client", color: "#eb6834" },
  { id: "scope", label: "Scope", color: "#1baf7a" },
  { id: "project", label: "Projects", color: "#eda100" },
  { id: "proposal", label: "Proposals", color: "#e87ba4" },
  { id: "contract", label: "Contracts", color: "#008300" },
  { id: "invoice", label: "Invoices", color: "#4a3aa7" },
  { id: "paid", label: "Paid", color: "#e34948" },
];

export function OverviewWorkflow({ counts }: { counts: OverviewPipelineCounts }) {
  const total = stages.reduce((sum, stage) => sum + counts[stage.id], 0);

  let cumulative = 0;
  const gradient =
    total > 0
      ? `conic-gradient(${stages
          .map((stage) => {
            const start = (cumulative / total) * 100;
            cumulative += counts[stage.id];
            const end = (cumulative / total) * 100;
            return `${stage.color} ${start}% ${end}%`;
          })
          .join(", ")})`
      : "var(--admin-line)";

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-4">
      <div>
        <h2 className="font-heading text-sm font-semibold tracking-tight">Workflow</h2>
        <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
          Lead → Client → Scope → Project → Proposal → Contract → Invoice → Paid
        </p>
      </div>

      {total === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">No workflow data yet.</p>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row">
          <div
            className="relative size-28 shrink-0 rounded-full"
            style={{ background: gradient }}
            role="img"
            aria-label={`Workflow breakdown, ${total} total: ${stages
              .map((stage) => `${stage.label} ${counts[stage.id]}`)
              .join(", ")}`}
          >
            <div className="absolute inset-[20%] flex flex-col items-center justify-center rounded-full bg-[var(--admin-card)]">
              <span className="font-heading text-lg font-semibold leading-none text-[var(--admin-ink)]">{total}</span>
              <span className="mt-0.5 text-[10px] text-[var(--admin-muted)]">total</span>
            </div>
          </div>

          <ul className="w-full min-w-0 space-y-1.5" aria-hidden="true">
            {stages.map((stage) => {
              const value = counts[stage.id];
              const pct = Math.round((value / total) * 100);
              return (
                <li key={stage.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: stage.color }} />
                    <span className="truncate text-[var(--admin-ink)]">{stage.label}</span>
                  </span>
                  <span className="shrink-0 font-heading font-semibold text-[var(--admin-ink)]">
                    {value} <span className="font-normal text-[var(--admin-muted)]">({pct}%)</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
