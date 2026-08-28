import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { leadStatuses } from "@/data/leads";

export function LeadSummary() {
  const { leads } = useLeads();
  const counts = leadStatuses.map((status) => ({
    status,
    label: status === "New" ? "New Leads" : status,
    value: leads.filter((lead) => lead.status === status).length,
  }));

  return (
    <section aria-label="Lead pipeline snapshot">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {counts.map((item) => (
          <article
            key={item.status}
            className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-3"
          >
            <p className="text-[12px] text-[var(--admin-muted)]">{item.label}</p>
            <p className="mt-1 font-heading text-2xl font-semibold tracking-tight text-[var(--admin-ink)]">
              {item.value}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
