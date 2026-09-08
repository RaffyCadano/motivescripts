import { useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { adminFilterControlState } from "@/components/admin/list/adminListStyles";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { formatProjectDayShort } from "@/data/agencyProjects";
import { collectStaffWorkload, type StaffWorkload } from "@/data/teamWorkspace";
import { cn } from "@/lib/cn";

const WEEK_COUNT = 4;
const WEEKLY_CAPACITY_HOURS = 32;

function loadTone(hours: number): string {
  if (hours <= 0) return "text-[var(--admin-muted)]";
  if (hours > WEEKLY_CAPACITY_HOURS) return "bg-[rgb(217_45_32_/_0.08)] text-[#b42318] font-semibold";
  if (hours >= WEEKLY_CAPACITY_HOURS * 0.8) return "bg-[rgb(217_119_6_/_0.08)] text-[#b45309] font-semibold";
  return "text-[var(--admin-ink)]";
}

function WorkloadCell({ hours, taskCount }: { hours: number; taskCount: number }) {
  if (taskCount === 0) {
    return <span className="text-[var(--admin-muted)]">—</span>;
  }
  return (
    <div className={cn("rounded-lg px-2 py-1", loadTone(hours))}>
      <p className="text-sm">{hours}h</p>
      <p className="text-[11px] opacity-80">
        {taskCount} task{taskCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function StaffRow({ workload }: { workload: StaffWorkload }) {
  return (
    <tr className="border-t border-[var(--admin-line)]">
      <td className="px-3 py-2.5 font-heading text-sm font-semibold text-[var(--admin-ink)]">
        {workload.fullName}
      </td>
      <td className="px-3 py-2.5">
        <WorkloadCell hours={workload.overdueHours} taskCount={workload.overdueTaskCount} />
      </td>
      {workload.weeks.map((week) => (
        <td key={week.weekStart} className="px-3 py-2.5">
          <WorkloadCell hours={week.hours} taskCount={week.taskCount} />
        </td>
      ))}
      <td className="px-3 py-2.5">
        <WorkloadCell hours={workload.unscheduledHours} taskCount={workload.unscheduledTaskCount} />
      </td>
    </tr>
  );
}

type LoadFilter = "All" | "over-capacity" | "overdue" | "idle";

export function AdminCapacity() {
  const { projects } = useLeads();
  const { data } = useTeamDirectory();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("All");
  const [loadFilter, setLoadFilter] = useState<LoadFilter>("All");

  const workloads = useMemo(
    () => collectStaffWorkload(projects, data?.members ?? [], WEEK_COUNT),
    [data?.members, projects],
  );
  const roleByStaffId = useMemo(
    () => new Map((data?.members ?? []).map((member) => [member.id, member.templateKey])),
    [data?.members],
  );
  const filteredWorkloads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return workloads.filter((workload) => {
      if (needle && !workload.fullName.toLowerCase().includes(needle)) return false;
      if (role !== "All" && roleByStaffId.get(workload.staffId) !== role) return false;
      if (loadFilter === "over-capacity") {
        return workload.weeks.some((week) => week.hours >= WEEKLY_CAPACITY_HOURS);
      }
      if (loadFilter === "overdue") return workload.overdueHours > 0;
      if (loadFilter === "idle") {
        return (
          workload.overdueHours <= 0 &&
          workload.unscheduledHours <= 0 &&
          workload.weeks.every((week) => week.hours <= 0)
        );
      }
      return true;
    });
  }, [workloads, query, role, loadFilter, roleByStaffId]);
  const weekStarts = workloads[0]?.weeks.map((week) => week.weekStart) ?? [];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Capacity"
        description={`Estimated hours per staff member, by due-date week. Highlighted when a week is at or over ${WEEKLY_CAPACITY_HOURS}h.`}
      />

      {workloads.length === 0 ? (
        <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-9">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No active staff yet</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            Invite team members from Team to see their workload here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search staff</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search staff name"
                className={adminFilterControlState(Boolean(query.trim()))}
              />
            </label>
            <label className="lg:w-56">
              <span className="sr-only">Role</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className={adminFilterControlState(role !== "All")}
              >
                <option value="All">All roles</option>
                {(data?.catalog.templates ?? []).map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="lg:w-52">
              <span className="sr-only">Load</span>
              <select
                value={loadFilter}
                onChange={(event) => setLoadFilter(event.target.value as LoadFilter)}
                className={adminFilterControlState(loadFilter !== "All")}
              >
                <option value="All">All workloads</option>
                <option value="over-capacity">At or over {WEEKLY_CAPACITY_HOURS}h a week</option>
                <option value="overdue">Has overdue hours</option>
                <option value="idle">No tasks assigned</option>
              </select>
            </label>
          </div>

          {filteredWorkloads.length === 0 ? (
            <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-9">
              <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No matching staff</p>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">Try a different name.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    <th className="px-3 py-2.5">Staff</th>
                    <th className="px-3 py-2.5">Overdue</th>
                    {weekStarts.map((weekStart) => (
                      <th key={weekStart} className="px-3 py-2.5">
                        Week of {formatProjectDayShort(weekStart)}
                      </th>
                    ))}
                    <th className="px-3 py-2.5">No due date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkloads.map((workload) => (
                    <StaffRow key={workload.staffId} workload={workload} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="text-[12px] text-[var(--admin-muted)]">
        Based on estimated hours entered per task, not actual logged time. A blank cell means no task is due that
        week for that person — it does not mean they have nothing else to do.
      </p>
    </div>
  );
}
