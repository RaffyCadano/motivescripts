import { Link } from "react-router-dom";
import { useMyTasksSummary } from "@/components/admin/useMyOpenTaskCount";
import { cn } from "@/lib/cn";

export function OverviewMyTasks() {
  const stats = useMyTasksSummary();

  if (stats.totalOpen === 0 && stats.overdue === 0 && stats.dueToday === 0 && stats.upcoming === 0) {
    return (
      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">My Tasks</h2>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">You&apos;re all caught up. No open tasks are assigned to you.</p>
        <Link to="/admin/my-tasks" className="mt-4 inline-flex font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
          View My Tasks →
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">My Tasks</h2>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Stat value={stats.overdue} label="Overdue" warn={stats.overdue > 0} />
        <Stat value={stats.dueToday} label="Due today" />
        <Stat value={stats.upcoming} label="Upcoming" />
      </div>
      <Link to="/admin/my-tasks" className="mt-4 inline-flex font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
        View My Tasks →
      </Link>
    </section>
  );
}

function Stat({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  return (
    <div>
      <p className={cn("font-heading text-2xl font-semibold tracking-tight", warn && "text-[#b45309]")}>{value}</p>
      <p className="mt-1 text-[11px] text-[var(--admin-muted)]">{label}</p>
    </div>
  );
}
