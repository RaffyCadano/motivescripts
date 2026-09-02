import { Link } from "react-router-dom";
import type { PmNextActionItem } from "@/data/pmOverview";

export function PmNextActions({ items }: { items: PmNextActionItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-[var(--admin-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[rgb(0_80_240_/_0.04)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Next Actions</h2>
      <ol className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li key={item.id} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--admin-card)] text-[11px] font-semibold text-[var(--admin-blue)]">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <Link to={item.href} className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]">
                {item.label}
              </Link>
              <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{item.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
