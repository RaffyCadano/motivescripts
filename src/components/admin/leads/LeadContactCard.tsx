import type { Lead } from "@/data/leads";

type LeadContactCardProps = {
  lead: Lead;
};

export function LeadContactCard({ lead }: LeadContactCardProps) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Contact</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Item label="Name" value={lead.name} />
        <Item label="Business name" value={lead.businessName} />
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Email</dt>
          <dd className="mt-1">
            <a className="text-sm font-medium text-[var(--admin-blue)] hover:underline" href={`mailto:${lead.email}`}>
              {lead.email}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Phone</dt>
          <dd className="mt-1">
            {lead.phone !== "—" ? (
              <a
                className="text-sm font-medium text-[var(--admin-blue)] hover:underline"
                href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
              >
                {lead.phone}
              </a>
            ) : (
              <span className="text-sm text-[var(--admin-muted)]">—</span>
            )}
          </dd>
        </div>
        <Item label="Industry" value={lead.industry} />
      </dl>
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-[var(--admin-muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{value}</dd>
    </div>
  );
}
