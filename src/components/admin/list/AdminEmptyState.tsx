import type { ReactNode } from "react";

export function AdminEmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-9">
      <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{title}</p>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--admin-muted)]">{body}</p>
      {action ? <div className="mt-4 flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}
