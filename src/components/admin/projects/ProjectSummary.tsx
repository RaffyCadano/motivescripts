import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { projectStatuses, type AgencyProjectStatus } from "@/data/agencyProjects";

type ProjectSummaryProps = {
  selected: AgencyProjectStatus | "All";
  onSelect: (status: AgencyProjectStatus | "All") => void;
};

export function ProjectSummary({ selected, onSelect }: ProjectSummaryProps) {
  const { projects } = useLeads();
  const active = projects.filter((item) => !item.archived);

  return (
    <section aria-label="Project status counts">
      <AdminStatGrid columns={6}>
        <AdminStatCard
          label="Total"
          value={active.length}
          active={selected === "All"}
          onClick={() => onSelect("All")}
        />
        {projectStatuses.map((status) => (
          <AdminStatCard
            key={status}
            label={status}
            value={active.filter((item) => item.status === status).length}
            active={selected === status}
            onClick={() => onSelect(selected === status ? "All" : status)}
          />
        ))}
      </AdminStatGrid>
    </section>
  );
}
