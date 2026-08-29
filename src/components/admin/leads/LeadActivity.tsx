import { formatLeadDate, formatLeadTimestamp, type Lead } from "@/data/leads";

type LeadActivityProps = {
  lead: Lead;
};

export function LeadActivity({ lead }: LeadActivityProps) {
  return (
    <section className="h-auto self-start rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Activity</h2>
      {lead.activity.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">No activity yet.</p>
      ) : (
        <ol className="mt-5 space-y-0">
          {lead.activity.map((item, index) => (
            <li key={item.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="mt-1 size-2.5 rounded-full bg-[var(--admin-blue)]" aria-hidden="true" />
                {index < lead.activity.length - 1 ? (
                  <span className="w-px flex-1 bg-[var(--admin-line)]" aria-hidden="true" />
                ) : null}
              </div>
              <div className="pb-5">
                <p className="text-sm text-[var(--admin-ink)]">{item.description}</p>
                <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                  {formatLeadDate(item.createdAt)} · {formatLeadTimestamp(item.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
