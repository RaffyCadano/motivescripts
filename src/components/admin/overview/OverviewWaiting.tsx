import { Link } from "react-router-dom";
import { CircleCheck, ClipboardList, FileSignature, FileText, ReceiptText, type LucideIcon } from "lucide-react";
import type { WaitingItem, WaitingKind } from "@/data/overviewExtras";
import { cn } from "@/lib/cn";

const ICONS: Record<WaitingKind, LucideIcon> = {
  proposal: FileText,
  contract: FileSignature,
  invoice: ReceiptText,
  scope: ClipboardList,
};

const KIND_LABELS: Record<WaitingKind, [string, string]> = {
  proposal: ["proposal", "proposals"],
  contract: ["contract", "contracts"],
  invoice: ["unpaid invoice", "unpaid invoices"],
  scope: ["scope form", "scope forms"],
};

function waitLabel(days: number): string {
  if (days <= 0) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}

/** What is stuck until a client acts, longest wait first, so nothing sits unnoticed. */
export function OverviewWaiting({ items, counts }: { items: WaitingItem[]; counts: Record<WaitingKind, number> }) {
  const total = counts.proposal + counts.contract + counts.invoice + counts.scope;
  const summary = (Object.keys(KIND_LABELS) as WaitingKind[])
    .filter((kind) => counts[kind] > 0)
    .map((kind) => `${counts[kind]} ${KIND_LABELS[kind][counts[kind] === 1 ? 0 : 1]}`)
    .join(" · ");

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight">Waiting on clients</h2>
      <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{total === 0 ? "Nothing is waiting on a client." : summary}</p>

      {items.length === 0 ? (
        <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-[var(--admin-bg)] px-3.5 py-3 text-sm text-[var(--admin-muted)]">
          <CircleCheck size={16} strokeWidth={2} className="text-[#0f7a56]" aria-hidden="true" />
          You&rsquo;re not waiting on anyone.
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--admin-line)]">
          {items.map((item) => {
            const Icon = ICONS[item.kind];
            const long = item.days >= 7;
            return (
              <li key={item.id}>
                <Link to={item.href} className="group flex items-center gap-3 py-2.5 hover:bg-[var(--admin-bg)] sm:-mx-2 sm:px-2 sm:rounded-lg">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)] group-hover:bg-white">
                    <Icon size={15} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--admin-ink)]">{item.clientName}</span>
                    <span className="block truncate text-[12px] text-[var(--admin-muted)]">{item.label}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                      long ? "bg-[rgb(220_38_38_/_0.08)] text-[#b42318]" : "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
                    )}
                    title="How long this has been waiting"
                  >
                    {waitLabel(item.days)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
