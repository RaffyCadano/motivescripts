import { adminGhostBtn } from "@/components/admin/adminActionStyles";
import { AdminStatusChips } from "@/components/admin/list/AdminStatusChips";
import { adminFilterControlState } from "@/components/admin/list/adminListStyles";
import { clientStatuses, type AgencyClientStatus } from "@/data/agencyClients";
import { leadIndustries, type LeadIndustry } from "@/data/leads";

type ClientFiltersProps = {
  query: string;
  status: AgencyClientStatus | "All";
  industry: LeadIndustry | "All";
  onQueryChange: (value: string) => void;
  onStatusChange: (value: AgencyClientStatus | "All") => void;
  onIndustryChange: (value: LeadIndustry | "All") => void;
  onClear: () => void;
  filtering: boolean;
};

export function ClientFilters({
  query,
  status,
  industry,
  onQueryChange,
  onStatusChange,
  onIndustryChange,
  onClear,
  filtering,
}: ClientFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search clients</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search business, contact, email, or phone"
            className={adminFilterControlState(Boolean(query.trim()))}
          />
        </label>
        <label className="lg:w-56">
          <span className="sr-only">Industry</span>
          <select
            value={industry}
            onChange={(event) => onIndustryChange(event.target.value as LeadIndustry | "All")}
            className={adminFilterControlState(industry !== "All")}
          >
            <option value="All">All industries</option>
            {leadIndustries.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {filtering ? (
          <button type="button" className={`${adminGhostBtn} shrink-0 justify-center`} onClick={onClear}>
            Clear filters
          </button>
        ) : null}
      </div>
      <AdminStatusChips
        items={["All", ...clientStatuses]}
        value={status}
        onChange={onStatusChange}
        label="Client status"
      />
    </div>
  );
}
