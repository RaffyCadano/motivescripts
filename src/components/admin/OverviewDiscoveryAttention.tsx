import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { formatProjectTimestamp } from "@/data/agencyProjects";
import { buildDiscoveryAttentionItems, type DiscoveryAttentionItem } from "@/data/discoveryIntake";
import { fetchDiscoveryIntakes } from "@/data/discoveryIntakeRepository";
import { cn } from "@/lib/cn";

type OverviewDiscoveryAttentionProps = {
  projectIds?: Set<string>;
  limit?: number;
  title?: string;
};

export function OverviewDiscoveryAttention({
  projectIds,
  limit = 6,
  title = "Discovery requiring attention",
}: OverviewDiscoveryAttentionProps) {
  const { projects, clients } = useLeads();
  const [intakes, setIntakes] = useState<Awaited<ReturnType<typeof fetchDiscoveryIntakes>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchDiscoveryIntakes()
      .then((rows) => {
        if (active) setIntakes(rows);
      })
      .catch(() => {
        if (active) setIntakes([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projects.length]);

  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);

  const items = useMemo(() => {
    const rows = buildDiscoveryAttentionItems({
      intakes,
      projects,
      clientsById,
    });
    const scoped = projectIds ? rows.filter((item) => projectIds.has(item.projectId)) : rows;
    return scoped.slice(0, limit);
  }, [clientsById, intakes, limit, projectIds, projects]);

  if (loading) {
    return (
      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">{title}</h2>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Loading…</p>
      </section>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">{title}</h2>
      <ul className="mt-4 divide-y divide-[var(--admin-line)]">
        {items.map((item) => (
          <DiscoveryAttentionRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function DiscoveryAttentionRow({ item }: { item: DiscoveryAttentionItem }) {
  const warn = item.status === "submitted" || item.status === "more_information_needed";
  const waiting = item.waitingSince ? formatProjectTimestamp(item.waitingSince) : null;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className={cn("font-heading text-sm font-semibold", warn && "text-[var(--admin-ink)]")}>{item.projectName}</p>
        <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
          {item.label} · {item.clientName}
          {waiting ? ` · ${waiting}` : ""}
        </p>
      </div>
      <Link
        to={item.href}
        className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
      >
        {item.actionLabel}
      </Link>
    </li>
  );
}
