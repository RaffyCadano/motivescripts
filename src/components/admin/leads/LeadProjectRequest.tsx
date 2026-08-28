import { formatLeadSubmitted, type Lead } from "@/data/leads";

type LeadProjectRequestProps = {
  lead: Lead;
};

export function LeadProjectRequest({ lead }: LeadProjectRequestProps) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Project Request</h2>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">What do you need?</dt>
          <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{lead.request}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Project details</dt>
          <dd className="mt-1 text-sm leading-relaxed text-[var(--admin-ink)]">{lead.projectDetails}</dd>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Submitted</dt>
            <dd className="mt-1 text-sm text-[var(--admin-ink)]">{formatLeadSubmitted(lead.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Source</dt>
            <dd className="mt-1 text-sm text-[var(--admin-ink)]">{lead.source}</dd>
          </div>
        </div>
      </dl>
    </section>
  );
}
