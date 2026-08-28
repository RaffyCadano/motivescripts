import type { AgencyClient } from "@/data/agencyClients";
import {
  projectStatuses,
  projectTypes,
  type AgencyProjectStatus,
  type AgencyProjectType,
} from "@/data/agencyProjects";
import { cn } from "@/lib/cn";

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
}: ProjectFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search projects</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search projects..."
            className="h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none placeholder:text-[var(--admin-muted)] focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </label>
        <label className="lg:w-56">
          <span className="sr-only">Client</span>
          <select
            value={clientId}
            onChange={(event) => onClientChange(event.target.value)}
            className="h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
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
            className="h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          >
            <option value="All">All types</option>
            {projectTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Project status">
        {(["All", ...projectStatuses] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onStatusChange(item)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 font-heading text-[12px] font-semibold",
              status === item
                ? "bg-[var(--admin-navy)] text-white"
                : "bg-white text-[var(--admin-ink)] ring-1 ring-[var(--admin-line)] hover:bg-[var(--admin-hover)]",
            )}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
