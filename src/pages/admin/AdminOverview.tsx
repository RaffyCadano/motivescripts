import { ActiveProjects } from "@/components/admin/ActiveProjects";
import { RecentActivity } from "@/components/admin/RecentActivity";
import { RecentLeads } from "@/components/admin/RecentLeads";
import { StatCard, StatCardGrid } from "@/components/admin/StatCard";
import { adminStats } from "@/data/adminMockData";

export function AdminOverview() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Overview</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Here’s what’s happening with MotiveScripts.</p>
      </div>

      <StatCardGrid>
        {adminStats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </StatCardGrid>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
        <RecentLeads />
        <RecentActivity />
      </div>

      <ActiveProjects />
    </div>
  );
}
