import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CircleAlert, FolderKanban, Inbox, MessageSquare, TrendingUp, Users, Wallet } from "lucide-react";
import type { AdminStat } from "@/data/admin";
import { cn } from "@/lib/cn";

const icons = {
  leads: Inbox,
  projects: FolderKanban,
  review: CircleAlert,
  revenue: Wallet,
  clients: Users,
  messages: MessageSquare,
} as const;

type StatCardProps = {
  stat: AdminStat;
};

export function StatCard({ stat }: StatCardProps) {
  const Icon = icons[stat.icon];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-[var(--admin-muted)]">{stat.label}</p>
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[var(--admin-hover)] text-[var(--admin-blue)]">
          <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 font-heading text-[1.85rem] font-semibold tracking-tight text-[var(--admin-ink)]">
        {stat.value}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--admin-muted)]">
        {stat.tone === "up" ? (
          <TrendingUp size={13} strokeWidth={2} className="text-[var(--admin-blue)]" aria-hidden="true" />
        ) : null}
        {stat.supporting}
      </p>
    </>
  );
  const cardClass =
    "rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 transition-colors duration-[var(--duration-fast)] hover:border-[rgb(0_80_240_/_0.18)]";

  if (stat.href) {
    return (
      <Link
        to={stat.href}
        className={cn(cardClass, "block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-blue)]")}
      >
        {body}
      </Link>
    );
  }

  return <article className={cardClass}>{body}</article>;
}

export function StatCardGrid({ children }: { children: ReactNode }) {
  return <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-5")}>{children}</div>;
}
