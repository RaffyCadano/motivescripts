import { useMemo } from "react";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
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

export function AdminCapacity() {
  const { projects } = useLeads();
  const { data } = useTeamDirectory();

  const workloads = useMemo(
    () => collectStaffWorkload(projects, data?.members ?? [], WEEK_COUNT),
    [data?.members, projects],
  );
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
              {workloads.map((workload) => (
                <StaffRow key={workload.staffId} workload={workload} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[12px] text-[var(--admin-muted)]">
        Based on estimated hours entered per task, not actual logged time. A blank cell means no task is due that
        week for that person — it does not mean they have nothing else to do.
      </p>
    </div>
  );
}
