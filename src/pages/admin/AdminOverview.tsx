import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ActiveProjects } from "@/components/admin/ActiveProjects";
import { RecentActivity } from "@/components/admin/RecentActivity";
import { RecentLeads } from "@/components/admin/RecentLeads";
import { StatCard, StatCardGrid } from "@/components/admin/StatCard";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import type { AdminStat } from "@/data/admin";
import { fetchInvoiceSummaries } from "@/data/invoicesRepository";
import { formatMoneyFromCents } from "@/data/money";
import { useMessaging } from "@/providers/MessagingProvider";

function dueThisWeek(dateStr: string): boolean {
  if (!dateStr) return false;
  const due = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return due >= start && due < end;
}

export function AdminOverview() {
  const { leads, clients, projects, deliverables } = useLeads();
  const { unreadMessageCount } = useMessaging();
  const [invoiceTotals, setInvoiceTotals] = useState({ outstanding: 0, overdue: 0, paid: 0 });

  useEffect(() => {
    let active = true;
    void fetchInvoiceSummaries().then((rows) => {
      if (!active) return;
      setInvoiceTotals({
        outstanding: rows
          .filter((row) => row.effectiveStatus !== "cancelled" && row.effectiveStatus !== "draft")
          .reduce((sum, row) => sum + row.amountDueCents, 0),
        overdue: rows.filter((row) => row.effectiveStatus === "overdue").length,
        paid: rows.filter((row) => row.effectiveStatus === "paid").length,
      });
    });
    return () => {
      active = false;
    };
  }, []);
  const activeProjects = projects.filter((item) => !item.archived && item.status !== "Completed");
  const awaitingReview = deliverables.filter((item) => item.status === "In Review").length;
  const newLeads = leads.filter((item) => item.status === "New").length;
  const activeClients = clients.filter((item) => item.status === "Active").length;
  const dueSoon = activeProjects.filter((item) => dueThisWeek(item.targetLaunchDate)).length;

  const stats: AdminStat[] = [
    {
      id: "leads",
      label: "Total Leads",
      value: String(leads.length),
      supporting: `${newLeads} new`,
      tone: newLeads > 0 ? "up" : "neutral",
      icon: "leads",
    },
    {
      id: "clients",
      label: "Active Clients",
      value: String(activeClients),
      supporting: `${clients.length} total`,
      tone: "neutral",
      icon: "clients",
    },
    {
      id: "projects",
      label: "Active Projects",
      value: String(activeProjects.length),
      supporting: dueSoon > 0 ? `${dueSoon} due this week` : "None due this week",
      tone: "neutral",
      icon: "projects",
    },
    {
      id: "review",
      label: "Awaiting Review",
      value: String(awaitingReview),
      supporting: awaitingReview > 0 ? "Client action required" : "None waiting",
      tone: awaitingReview > 0 ? "attention" : "neutral",
      icon: "review",
    },
    {
      id: "messages",
      label: "Unread Messages",
      value: String(unreadMessageCount),
      supporting: unreadMessageCount > 0 ? "Client conversations" : "Inbox is clear",
      tone: unreadMessageCount > 0 ? "attention" : "neutral",
      icon: "messages",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Overview</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Here’s what’s happening with MotiveScripts.</p>
      </div>

      <StatCardGrid>
        {stats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </StatCardGrid>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Invoices</h2>
          <Link to="/admin/invoices" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
            View invoices
          </Link>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Outstanding</dt>
            <dd className="mt-1 font-heading text-xl font-semibold">{formatMoneyFromCents(invoiceTotals.outstanding)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Overdue</dt>
            <dd className="mt-1 font-heading text-xl font-semibold">{invoiceTotals.overdue}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Paid</dt>
            <dd className="mt-1 font-heading text-xl font-semibold">{invoiceTotals.paid}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
        <RecentLeads />
        <RecentActivity />
      </div>

      <ActiveProjects />
    </div>
  );
}
