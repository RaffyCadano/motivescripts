import { CheckCircle2, FileUp, Inbox, Receipt, RefreshCw } from "lucide-react";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { formatLeadTimestamp } from "@/data/leads";
import type { AgencyProjectActivity } from "@/data/agencyProjects";

const icons = {
  approval: CheckCircle2,
  lead: Inbox,
  invoice: Receipt,
  file: FileUp,
  status: RefreshCw,
} as const;

function activityIcon(item: AgencyProjectActivity): keyof typeof icons {
  if (item.icon === "file") return "file";
  if (item.icon === "review" && /approv/i.test(item.description)) return "approval";
  if (item.icon === "review") return "status";
  return "status";
}

export function RecentActivity() {
  const { projects, clients } = useLeads();
  const rows = projects
    .flatMap((project) => {
      const client = clients.find((item) => item.id === project.clientId);
      return project.activity.map((item) => ({
        ...item,
        related: client?.businessName ?? project.name,
      }));
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
      <div className="border-b border-[var(--admin-line)] px-5 py-4">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Recent Activity</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-[var(--admin-muted)]">No activity yet.</p>
      ) : (
        <ol className="divide-y divide-[var(--admin-line)]">
          {rows.map((item) => {
            const Icon = icons[activityIcon(item)];
            return (
              <li key={item.id} className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--admin-bg)]">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-hover)] text-[var(--admin-blue)]">
                  <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--admin-ink)]">{item.description}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                    {formatLeadTimestamp(item.createdAt)}
                    {item.related ? ` · ${item.related}` : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
