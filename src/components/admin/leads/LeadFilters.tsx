import { adminGhostBtn } from "@/components/admin/adminActionStyles";
import { AdminStatusChips } from "@/components/admin/list/AdminStatusChips";
import { adminFilterControlState } from "@/components/admin/list/adminListStyles";
import { leadIndustries, leadStatuses, type LeadIndustry, type LeadStatus } from "@/data/leads";

type LeadFiltersProps = {
  query: string;
  status: LeadStatus | "All";
  industry: LeadIndustry | "All";
  onQueryChange: (value: string) => void;
  onStatusChange: (value: LeadStatus | "All") => void;
  onIndustryChange: (value: LeadIndustry | "All") => void;
  onClear: () => void;
};

export function LeadFilters({
  query,
  status,
  industry,
  onQueryChange,
  onStatusChange,
  onIndustryChange,
  onClear,
}: LeadFiltersProps) {
  const filtering = query.trim().length > 0 || status !== "All" || industry !== "All";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search leads</span>
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
        items={["All", ...leadStatuses]}
        value={status}
        onChange={onStatusChange}
        label="Lead status"
      />
    </div>
  );
}
