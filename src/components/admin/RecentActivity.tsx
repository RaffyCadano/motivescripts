import { Link } from "react-router-dom";
import { CheckCircle2, FileUp, Inbox, Receipt, RefreshCw, Users } from "lucide-react";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { buildOverviewActivity, type OverviewActivityItem } from "@/data/adminOverview";
import { formatLeadTimestamp } from "@/data/leads";

const icons = {
  approval: CheckCircle2,
  lead: Inbox,
  client: Users,
  invoice: Receipt,
  file: FileUp,
  status: RefreshCw,
} as const;

function ActivityRow({ item }: { item: OverviewActivityItem }) {
  const Icon = icons[item.kind];
  const body = (
    <>
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
    </>
  );

  if (item.href) {
    return (
      <li>
        <Link
          to={item.href}
          className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--admin-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--admin-blue)]"
        >
          {body}
        </Link>
      </li>
    );
  }

  return <li className="flex gap-3 px-5 py-3.5">{body}</li>;
}

export function RecentActivity() {
  const { leads, clients, projects } = useLeads();
  const rows = buildOverviewActivity({ leads, clients, projects });

  return (
    <section className="flex max-h-[22rem] min-h-0 flex-col overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
      <div className="shrink-0 border-b border-[var(--admin-line)] px-5 py-4">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Recent Activity</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-[var(--admin-muted)]">No activity yet.</p>
      ) : (
        <ol className="min-h-0 flex-1 divide-y divide-[var(--admin-line)] overflow-y-auto overscroll-contain">
          {rows.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </ol>
      )}
    </section>
  );
}
