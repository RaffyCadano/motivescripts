import { Link } from "react-router-dom";
import { formatProjectTimestamp } from "@/data/agencyProjects";
import { discoveryStatusLabel, DISCOVERY_STATUSES, type DiscoveryAttentionItem, type DiscoveryStatus } from "@/data/discoveryIntake";

const COLUMN_ORDER: DiscoveryStatus[] = [
  "not_started",
  "awaiting_client",
  "submitted",
  "more_information_needed",
  "under_review",
  "complete",
];

export function PmDiscoveryActionCenter({ items }: { items: DiscoveryAttentionItem[] }) {
  if (items.length === 0) return null;

  const byStatus = new Map<DiscoveryStatus, DiscoveryAttentionItem[]>();
  for (const status of DISCOVERY_STATUSES) byStatus.set(status, []);
  for (const item of items) byStatus.get(item.status)?.push(item);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Discovery Action Center</h2>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
        Discovery status across every project assigned to you.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {COLUMN_ORDER.map((status) => (
          <DiscoveryColumn key={status} status={status} items={byStatus.get(status) ?? []} />
        ))}
      </div>
    </section>
  );
}

function DiscoveryColumn({ status, items }: { status: DiscoveryStatus; items: DiscoveryAttentionItem[] }) {
  return (
    <div className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
          {discoveryStatusLabel(status)}
        </p>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--admin-card)] px-1.5 text-[11px] font-semibold text-[var(--admin-ink)]">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-[12px] text-[var(--admin-muted)]">None</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-md bg-[var(--admin-card)] p-2">
              <Link to={item.href} className="font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]">
                {item.projectName}
              </Link>
              <p className="mt-0.5 text-[11px] text-[var(--admin-muted)]">
                {item.clientName}
                {item.waitingSince ? ` · ${formatProjectTimestamp(item.waitingSince)}` : ""}
              </p>
              <Link to={item.href} className="mt-1 inline-flex font-heading text-[11px] font-semibold text-[var(--admin-blue)] hover:underline">
                {item.actionLabel} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
