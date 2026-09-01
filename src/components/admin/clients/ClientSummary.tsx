import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { useLeads } from "@/components/admin/leads/LeadsProvider";

export type ClientSummarySelection = "total" | "active" | "inactive" | "attention" | null;

type ClientSummaryProps = {
  selected: ClientSummarySelection;
  attentionCount: number;
  onSelectTotal: () => void;
  onSelectActive: () => void;
  onSelectInactive: () => void;
  onSelectAttention: () => void;
};

export function ClientSummary({
  selected,
  attentionCount,
  onSelectTotal,
  onSelectActive,
  onSelectInactive,
  onSelectAttention,
}: ClientSummaryProps) {
  const { clients } = useLeads();

  return (
    <section aria-label="Client snapshot">
      <AdminStatGrid columns={4}>
        <AdminStatCard label="Total" value={clients.length} active={selected === "total"} onClick={onSelectTotal} />
        <AdminStatCard
          label="Active"
          value={clients.filter((item) => item.status === "Active").length}
          active={selected === "active"}
          onClick={onSelectActive}
        />
        <AdminStatCard
          label="Inactive"
          value={clients.filter((item) => item.status === "Inactive").length}
          active={selected === "inactive"}
          onClick={onSelectInactive}
        />
        <AdminStatCard
          label="Needs Attention"
          value={attentionCount}
          active={selected === "attention"}
          onClick={onSelectAttention}
        />
      </AdminStatGrid>
    </section>
  );
}
