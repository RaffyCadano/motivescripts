import { adminFunnelCurrentId, type AdminFunnelItem } from "@/data/preProject";
import { cn } from "@/lib/cn";

export function ProjectCommercialProgress({ items, loading }: { items: AdminFunnelItem[] | null; loading: boolean }) {
  if (loading || !items) {
    return <div className="h-10 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />;
  }

  const currentId = adminFunnelCurrentId(items);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">Commercial progress</p>
      <ol className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-[13px]">
        {items.map((item, index) => {
          const current = item.id === currentId && !item.done;
          return (
            <li key={item.id} className="flex items-center gap-1">
              {index > 0 ? <span className="text-[var(--admin-muted)]" aria-hidden="true">→</span> : null}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
                  current && "bg-[rgb(0_80_240_/_0.08)] font-heading font-semibold text-[var(--admin-blue)]",
                  item.done && !current && "text-[var(--admin-ink)]",
                  !item.done && !current && "text-[var(--admin-muted)]",
                )}
              >
                <span aria-hidden="true">{item.done ? "✓" : current ? "●" : "○"}</span>
                {item.label}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
