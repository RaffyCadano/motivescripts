import { adminGhostBtn } from "@/components/admin/adminActionStyles";
import { AdminStatusChips } from "@/components/admin/list/AdminStatusChips";
import { adminFilterControlState } from "@/components/admin/list/adminListStyles";
import type { AgencyClient } from "@/data/agencyClients";
import {
  projectStatuses,
  projectTypes,
  type AgencyProjectStatus,
  type AgencyProjectType,
} from "@/data/agencyProjects";

type ProjectFiltersProps = {
  query: string;
  status: AgencyProjectStatus | "All";
  clientId: string | "All";
  type: AgencyProjectType | "All";
  clients: AgencyClient[];
  onQueryChange: (value: string) => void;
  onStatusChange: (value: AgencyProjectStatus | "All") => void;
  onClientChange: (value: string | "All") => void;
  onTypeChange: (value: AgencyProjectType | "All") => void;
  onReset: () => void;
};

export function ProjectFilters({
  query,
  status,
  clientId,
  type,
  clients,
  onQueryChange,
  onStatusChange,
  onClientChange,
  onTypeChange,
  onReset,
}: ProjectFiltersProps) {
  const filtersActive = query.trim().length > 0 || status !== "All" || clientId !== "All" || type !== "All";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search projects</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search project or client"
            className={adminFilterControlState(Boolean(query.trim()))}
          />
        </label>
        <label className="lg:w-56">
          <span className="sr-only">Client</span>
          <select
            value={clientId}
            onChange={(event) => onClientChange(event.target.value)}
            className={adminFilterControlState(clientId !== "All")}
          >
            <option value="All">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.businessName}
              </option>
            ))}
          </select>
        </label>
        <label className="lg:w-52">
          <span className="sr-only">Project type</span>
          <select
            value={type}
            onChange={(event) => onTypeChange(event.target.value as AgencyProjectType | "All")}
            className={adminFilterControlState(type !== "All")}
          >
            <option value="All">All types</option>
            {projectTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {filtersActive ? (
          <button type="button" className={`${adminGhostBtn} shrink-0 justify-center`} onClick={onReset}>
            Clear filters
          </button>
        ) : null}
      </div>
      <AdminStatusChips
        items={["All", ...projectStatuses]}
        value={status}
        onChange={onStatusChange}
        label="Project status"
      />
    </div>
  );
}
