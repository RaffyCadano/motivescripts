import { CheckCircle2, FileUp, Inbox, Receipt, RefreshCw } from "lucide-react";
import { adminActivity } from "@/data/adminMockData";

const icons = {
  approval: CheckCircle2,
  lead: Inbox,
  invoice: Receipt,
  file: FileUp,
  status: RefreshCw,
} as const;

export function RecentActivity() {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
      <div className="border-b border-[var(--admin-line)] px-5 py-4">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Recent Activity</h2>
      </div>
      <ol className="divide-y divide-[var(--admin-line)]">
        {adminActivity.map((item) => {
          const Icon = icons[item.icon];
          return (
            <li key={item.id} className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--admin-bg)]">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-hover)] text-[var(--admin-blue)]">
                <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[var(--admin-ink)]">{item.description}</p>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                  {item.time}
                  {item.related ? ` · ${item.related}` : null}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
