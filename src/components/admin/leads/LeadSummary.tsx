import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { leadStatuses, type LeadStatus } from "@/data/leads";

type LeadSummaryProps = {
  selected: LeadStatus | "All";
  onSelect: (status: LeadStatus | "All") => void;
};

export function LeadSummary({ selected, onSelect }: LeadSummaryProps) {
  const { leads } = useLeads();

  return (
    <section aria-label="Lead status counts">
      <AdminStatGrid columns={6}>
        {leadStatuses.map((status) => (
          <AdminStatCard
            key={status}
            label={status}
            value={leads.filter((lead) => lead.status === status).length}
            active={selected === status}
            onClick={() => onSelect(selected === status ? "All" : status)}
          />
        ))}
      </AdminStatGrid>
    </section>
  );
}
