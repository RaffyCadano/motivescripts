import { Link } from "react-router-dom";
import type { PmAttentionItem, PmAttentionKind } from "@/data/pmOverview";
import { cn } from "@/lib/cn";

const kindLabel: Record<PmAttentionKind, string> = {
  blocked: "Blocked",
  overdue: "Overdue",
  "needs-changes": "Needs Changes",
  "in-review": "In Review",
  discovery: "Discovery",
  unassigned: "Unassigned",
};

const kindTone: Record<PmAttentionKind, string> = {
  blocked: "bg-[#fef3c7] text-[#92400e]",
  overdue: "bg-[rgb(220_38_38_/_0.1)] text-[#b91c1c]",
  "needs-changes": "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  "in-review": "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  discovery: "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
  unassigned: "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
};

/** "Needs My Attention" -- a single, prioritized triage queue merging existing attention signals (see buildPmAttentionQueue). */
export function PmAttentionQueue({ items }: { items: PmAttentionItem[] }) {
  return (
    <section id="needs-attention" className="scroll-mt-20 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Needs My Attention</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--admin-muted)]">You&apos;re all caught up — nothing needs your attention right now.</p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--admin-line)]">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                      kindTone[item.kind],
                    )}
                  >
                    {kindLabel[item.kind]}
                  </span>
                  <Link to={item.href} className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]">
                    {item.label}
                  </Link>
                </div>
                <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
