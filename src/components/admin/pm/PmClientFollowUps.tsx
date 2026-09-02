import { Link } from "react-router-dom";
import { adminSoftBtn } from "@/components/admin/adminActionStyles";
import type { PmFollowUpItem } from "@/data/pmOverview";

export function PmClientFollowUps({ items }: { items: PmFollowUpItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-4">
      <div>
        <h2 className="font-heading text-sm font-semibold tracking-tight">Client Follow-ups</h2>
        <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
          Clients and projects that need coordination from you.
        </p>
      </div>
      <ul className="mt-3 divide-y divide-[var(--admin-line)]">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{item.name}</p>
              <p className="mt-0.5 text-sm text-[var(--admin-muted)]">{item.body}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">{item.stage}</p>
            </div>
            <Link to={item.href} className={`${adminSoftBtn} h-9 shrink-0 justify-center px-3 text-[12px]`}>
              {item.actionLabel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
