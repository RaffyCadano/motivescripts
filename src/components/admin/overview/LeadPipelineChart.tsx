import { buildLeadStatusCounts } from "@/data/adminOverview";
import type { Lead, LeadStatus } from "@/data/leads";
import { OverviewBarList } from "@/components/admin/overview/OverviewBarList";

// New/Contacted/Qualified/Proposal are categorical identity (which stage) --
// the same four validated slots as ProjectStatusChart. Won and Lost are
// outcomes, not stages, so they switch encoding: Won gets the reserved
// "good" status green; Lost is intentionally NOT a competing hue -- a solid
// gray here fails the palette's own chroma-floor check (reads as too washed
// out to count as a real categorical color), so it's rendered as a hatched
// fill instead. That's a second, non-color channel (texture), matching the
// skill's guidance for an excluded/neutral category.
const colors: Record<LeadStatus, string> = {
  New: "#2a78d6",
  Contacted: "#eb6834",
  Qualified: "#1baf7a",
  Proposal: "#eda100",
  Won: "#0f7a56",
  Lost: "#667085",
};

/** Every lead by its current status -- the workflow donut only tracks not-yet-converted leads. */
export function LeadPipelineChart({ leads }: { leads: Lead[] }) {
  const items = buildLeadStatusCounts(leads).map(({ status, count }) => ({
    key: status,
    label: status,
    value: count,
    color: colors[status],
    hatched: status === "Lost",
  }));

  return <OverviewBarList items={items} emptyLabel="No leads yet." />;
}
