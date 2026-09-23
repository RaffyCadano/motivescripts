import { buildStaffWorkload } from "@/data/adminOverview";
import type { TeamMember } from "@/data/team";
import { OverviewBarList } from "@/components/admin/overview/OverviewBarList";

/** Active staff ranked by open task count -- single series (magnitude), so one hue is enough. */
export function StaffWorkloadChart({ members }: { members: TeamMember[] }) {
  const items = buildStaffWorkload(members).map((row) => ({
    key: row.id,
    label: row.name,
    value: row.activeTaskCount,
    color: "var(--admin-blue)",
  }));

  return <OverviewBarList items={items} emptyLabel="No active staff have open tasks right now." />;
}
