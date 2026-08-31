import { adminFunnelCurrentId, projectWorkspaceStepLabel, type AdminFunnelItem } from "@/data/preProject";
import { cn } from "@/lib/cn";

export function ProjectWorkflow({ items }: { items: AdminFunnelItem[] | null }) {
  if (!items) {
    return <div className="h-16 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />;
  }

  const currentId = adminFunnelCurrentId(items);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Project Workflow</h2>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">From live records — steps do not advance automatically.</p>
      <ol className="mt-4 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-2">
        {items.map((item) => {
          const current = item.id === currentId && !item.done;
          return (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm sm:px-2.5",
                current && "bg-[rgb(0_80_240_/_0.06)] ring-1 ring-[rgb(0_80_240_/_0.16)]",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center font-heading text-[12px] font-semibold",
                  item.done
                    ? "text-[#0f7a56]"
                    : current
                      ? "text-[var(--admin-blue)]"
                      : "text-[var(--admin-muted)]",
                )}
                aria-hidden="true"
              >
                {item.done ? "✓" : current ? "●" : "○"}
              </span>
              <span
                className={
                  item.done
                    ? "text-[var(--admin-ink)]"
                    : current
                      ? "font-heading font-semibold text-[var(--admin-ink)]"
                      : "text-[var(--admin-muted)]"
                }
              >
                {projectWorkspaceStepLabel(item)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
