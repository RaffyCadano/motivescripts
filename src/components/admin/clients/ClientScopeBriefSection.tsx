import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useClientProjects } from "@/components/admin/leads/LeadsProvider";
import type { AgencyClient } from "@/data/agencyClients";
import { formatClientDate } from "@/data/agencyClients";
import { fetchClientScopeBrief } from "@/data/scopeBriefsRepository";
import type { ClientScopeBrief } from "@/data/scopeBriefs";

export function ClientScopeBriefSection({ client }: { client: AgencyClient }) {
  const projects = useClientProjects(client.id);
  const [brief, setBrief] = useState<ClientScopeBrief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchClientScopeBrief(client.id)
      .then((row) => {
        if (active) setBrief(row);
      })
      .catch(() => {
        if (active) setBrief(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client.id]);

  const hasProject = projects.length > 0;

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Scope form</h2>
      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
      ) : brief ? (
        <>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
            Submitted {formatClientDate(brief.submittedAt)}
            {brief.updatedAt !== brief.submittedAt ? ` · Updated ${formatClientDate(brief.updatedAt)}` : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {brief.selectedPages.map((page) => (
              <span
                key={page}
                className="inline-flex min-h-8 items-center rounded-full border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)]"
              >
                {page}
              </span>
            ))}
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[var(--admin-ink)]">{brief.goal}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!hasProject ? (
              <Link
                to={`/admin/projects/new?client=${client.id}`}
                className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
              >
                Create project
              </Link>
            ) : (
              <Link
                to={`/admin/proposals/new?client=${client.id}`}
                className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
              >
                Create proposal
              </Link>
            )}
            {hasProject ? (
              <Link
                to={`/admin/projects/new?client=${client.id}`}
                className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
              >
                Another project
              </Link>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">
          Waiting for this client to submit the scope form in the portal. You can still create a project if you already
          know the brief.
        </p>
      )}
    </section>
  );
}
