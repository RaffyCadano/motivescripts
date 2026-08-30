import { Link } from "react-router-dom";

export function NeedClientEmpty({ document }: { document: string }) {
  return (
    <div className="max-w-lg rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-8">
      <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No clients yet</p>
      <p className="mt-1 text-sm text-[var(--admin-muted)]">
        {/^[aeiou]/i.test(document) ? "An" : "A"} {document} needs a client. This workspace has no clients, so the
        form stays empty until you add one.
      </p>
      <Link
        to="/admin/clients/new"
        className="mt-5 inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
      >
        Add client
      </Link>
    </div>
  );
}
