import { BellRing, CircleCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { OverviewEmpty } from "@/components/admin/overview/kit";
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

/** "Needs my attention": one prioritised list merging the existing attention signals (see buildPmAttentionQueue). */
export function PmAttentionQueue({ items }: { items: PmAttentionItem[] }) {
  return (
    <section
      id="needs-attention"
      aria-label="Needs my attention"
      className={cn(
        "scroll-mt-20 rounded-[var(--admin-radius)] border bg-[var(--admin-card)] p-5 shadow-[0_1px_2px_rgb(7_17_31_/_0.04)]",
        items.length > 0 ? "border-[rgb(245_158_11_/_0.35)]" : "border-[var(--admin-line)]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(245_158_11_/_0.14)] text-[#b45309]">
          <BellRing size={16} strokeWidth={2} aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-heading text-[15px] font-semibold tracking-tight text-[var(--admin-ink)]">Needs my attention</h2>
          <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">The most urgent things across your projects, in order.</p>
        </div>
        {items.length > 0 ? (
          <span className="ml-auto rounded-full bg-[rgb(245_158_11_/_0.14)] px-2 py-0.5 text-xs font-semibold text-[#b45309]">{items.length}</span>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="mt-3">
          <OverviewEmpty compact icon={CircleCheck} title="You’re all caught up" body="Nothing needs your attention right now." />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--admin-line)]">
          {items.map((item) => (
            <li key={item.id} className="py-3 first:pt-0 last:pb-0">
              <Link to={item.href} className="group flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em]", kindTone[item.kind])}>
                      {kindLabel[item.kind]}
                    </span>
                    <span className="font-heading text-sm font-semibold text-[var(--admin-ink)] group-hover:text-[var(--admin-blue)]">{item.label}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{item.body}</p>
                </div>
                <span className="shrink-0 font-heading text-[12px] font-semibold text-[var(--admin-blue)] opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">Open</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
