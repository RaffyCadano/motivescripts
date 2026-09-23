import { buildProjectStatusCounts } from "@/data/adminOverview";
import type { AgencyProject, AgencyProjectStatus } from "@/data/agencyProjects";
import { OverviewBarList } from "@/components/admin/overview/OverviewBarList";

// Categorical identity (which phase, not good/bad) -- first five slots of the
// app's validated default categorical order (see OverviewWorkflow), with
// Completed swapped to the reserved "good" status green since it's the one
// phase in this set that really is an outcome, not just a stage.
// Validated: worst adjacent pair (Proposal-yellow <-> Client Review-aqua)
// CVD deutan/protan ΔE 9.1, normal-vision ΔE 22.9 -- both clear.
const colors: Record<AgencyProjectStatus, string> = {
  Planning: "#2a78d6",
  "In Development": "#eb6834",
  "Client Review": "#1baf7a",
  "On Hold": "#eda100",
  Completed: "#0f7a56",
};

/** Non-archived projects by status -- a fuller picture than the Active Projects table alone. */
export function ProjectStatusChart({ projects }: { projects: AgencyProject[] }) {
  const items = buildProjectStatusCounts(projects).map(({ status, count }) => ({
    key: status,
    label: status,
    value: count,
    color: colors[status],
  }));

  return <OverviewBarList items={items} emptyLabel="No projects yet." />;
}
