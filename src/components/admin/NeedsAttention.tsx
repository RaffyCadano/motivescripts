import { useState } from "react";
import { ClipboardList, Eye, FileSignature, FileText, FolderKanban, Inbox, MessageCircle, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import { adminSoftBtn } from "@/components/admin/adminActionStyles";
import type { OverviewAttentionItem } from "@/data/adminOverview";

const stageIcons: Record<string, typeof Inbox> = {
  Lead: Inbox,
  Scope: ClipboardList,
  Project: FolderKanban,
  Proposal: FileText,
  Contract: FileSignature,
  Invoice: Receipt,
  Review: Eye,
  Messages: MessageCircle,
};

const VISIBLE_LIMIT = 5;

type NeedsAttentionProps = {
  items: OverviewAttentionItem[];
};

export function NeedsAttention({ items }: NeedsAttentionProps) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, VISIBLE_LIMIT);
  const hasMore = items.length > VISIBLE_LIMIT;

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-4">
      <div>
        <h2 className="font-heading text-sm font-semibold tracking-tight">Needs Your Attention</h2>
        <p className="mt-1 text-[11px] text-[var(--admin-muted)]">Actionable items from live records. Nothing here is created automatically.</p>
      </div>
      <ul className="mt-3 divide-y divide-[var(--admin-line)]">
        {visible.map((item) => {
          const Icon = stageIcons[item.stage] ?? Inbox;
          return (
            <li key={item.id} className="flex flex-col gap-2.5 py-3 first:pt-0 last:pb-0 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-hover)] text-[var(--admin-blue)]">
                  <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <p className="text-[13px] font-heading font-semibold text-[var(--admin-ink)]">{item.name}</p>
                    <span className="rounded-full bg-[var(--admin-bg)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-muted)]">
                      {item.stage}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--admin-muted)]">{item.body}</p>
                </div>
              </div>
              <Link to={item.href} className={`${adminSoftBtn} h-8 shrink-0 justify-center px-2.5 text-[11px]`}>
                {item.actionLabel}
              </Link>
            </li>
          );
        })}
      </ul>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-3 w-full rounded-lg border border-[var(--admin-line)] py-2 text-center font-heading text-[11px] font-semibold text-[var(--admin-blue)] hover:bg-[var(--admin-bg)]"
        >
          {expanded ? "Show less" : `View all (${items.length})`}
        </button>
      ) : null}
    </section>
  );
}
