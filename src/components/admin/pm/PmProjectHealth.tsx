import { Link } from "react-router-dom";
import type { PmProjectHealthItem, PmProjectHealthStatus } from "@/data/pmOverview";
import { cn } from "@/lib/cn";

export function PmProjectHealth({ items }: { items: PmProjectHealthItem[] }) {
  const attention = items.filter((item) => item.status !== "healthy");
  if (attention.length === 0) return null;

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Project Health</h2>
      <ul className="mt-4 divide-y divide-[var(--admin-line)]">
        {attention.map((item) => (
          <li key={item.projectId} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{item.projectName}</p>
                <HealthBadge status={item.status} />
              </div>
              <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{item.clientName}</p>
              <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{item.reasons[0]}</p>
            </div>
            <Link to={item.href} className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
              Open Project
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HealthBadge({ status }: { status: PmProjectHealthStatus }) {
  const label = status === "blocked" ? "Blocked" : status === "attention" ? "Needs Attention" : "Healthy";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
        status === "blocked" && "bg-[#fef3c7] text-[#92400e]",
        status === "attention" && "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
        status === "healthy" && "bg-[#ecfdf5] text-[#047857]",
      )}
    >
      {label}
    </span>
  );
}
