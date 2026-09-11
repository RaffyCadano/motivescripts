/** Shared empty-state card for client-portal list pages (Invoices, Proposals, Contracts, ...). */
export function ClientEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[var(--client-radius)] border border-dashed border-[var(--client-line)] bg-[var(--client-card)] px-5 py-10">
      <p className="font-heading text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[var(--client-muted)]">{body}</p>
    </div>
  );
}
