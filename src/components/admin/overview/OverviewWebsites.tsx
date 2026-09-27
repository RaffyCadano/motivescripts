import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheck } from "lucide-react";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { developerDeploymentRows } from "@/data/developerOverview";
import { upcomingRenewals, websiteOverview, type SiteHealthState, type SiteRow } from "@/data/overviewExtras";
import { listServicePlans } from "@/data/servicePlansRepository";
import type { ServicePlan } from "@/data/servicePlans";
import { adminProjectHref } from "@/data/teamWorkspace";
import { fetchLatestWebsiteHealthByProject } from "@/data/websiteHealthRepository";
import { cn } from "@/lib/cn";

const STATE_STYLES: Record<SiteHealthState, string> = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-400",
  down: "bg-[#dc2626]",
  unknown: "bg-[var(--admin-line)]",
};

function Tile({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="rounded-lg bg-[var(--admin-bg)] px-3 py-2.5">
      <p
        className={cn(
          "font-heading text-xl font-semibold leading-tight",
          tone === "bad" && value > 0 ? "text-[#b42318]" : tone === "warn" && value > 0 ? "text-[#b45309]" : "text-[var(--admin-ink)]",
        )}
      >
        {value}
      </p>
      <p className="text-[12px] text-[var(--admin-muted)]">{label}</p>
    </div>
  );
}

/** Live sites by health, the ones with a problem, and domains or SSL certificates about to expire. */
export function OverviewWebsites() {
  const { projects, clients } = useLeads();
  const [health, setHealth] = useState<Map<string, SiteHealthState>>(new Map());
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loaded, setLoaded] = useState(false);

  const launched = useMemo(
    () =>
      developerDeploymentRows(projects).filter(
        (row) => row.development.deploymentStatus === "Production" && row.development.productionUrl.trim(),
      ),
    [projects],
  );
  const idsKey = launched.map((row) => row.projectId).join(",");

  useEffect(() => {
    let cancelled = false;
    const ids = idsKey ? idsKey.split(",") : [];
    void Promise.all([
      ids.length > 0 ? fetchLatestWebsiteHealthByProject(ids, "production").catch(() => new Map()) : Promise.resolve(new Map()),
      listServicePlans().catch(() => [] as ServicePlan[]),
    ]).then(([checks, planRows]) => {
      if (cancelled) return;
      setHealth(new Map([...checks].map(([projectId, check]) => [projectId, check.status as SiteHealthState])));
      setPlans(planRows);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const clientNames = useMemo(() => new Map(clients.map((client) => [client.id, client.businessName])), [clients]);
  const sites = useMemo<SiteRow[]>(
    () =>
      launched.map((row) => ({
        id: row.projectId,
        name: row.projectName,
        clientName: clientNames.get(row.project.clientId) ?? "",
        paused: Boolean(row.development.pausedAt),
        state: health.get(row.projectId) ?? "unknown",
      })),
    [clientNames, health, launched],
  );
  const overview = useMemo(() => websiteOverview(sites), [sites]);
  const renewals = useMemo(() => upcomingRenewals(plans).slice(0, 4), [plans]);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Websites</h2>
        <Link to="/admin/website-monitoring" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
          Monitoring
        </Link>
      </div>

      {overview.total === 0 ? (
        <p className="mt-3 py-6 text-center text-sm text-[var(--admin-muted)]">No websites are live yet.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Tile label="Healthy" value={overview.healthy} />
            <Tile label="Slow" value={overview.degraded} tone="warn" />
            <Tile label="Down" value={overview.down} tone="bad" />
            <Tile label="Paused" value={overview.paused} />
          </div>

          {overview.issues.length === 0 ? (
            <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-[var(--admin-bg)] px-3.5 py-2.5 text-sm text-[var(--admin-muted)]">
              <CircleCheck size={16} strokeWidth={2} className="text-[#0f7a56]" aria-hidden="true" />
              {loaded ? "No site has a problem right now." : "Checking your sites…"}
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--admin-line)]">
              {overview.issues.slice(0, 4).map((site) => (
                <li key={site.id}>
                  <Link to={adminProjectHref(site.id)} className="flex items-center gap-3 py-2 text-sm hover:text-[var(--admin-blue)]">
                    <span className={cn("size-2.5 shrink-0 rounded-full", STATE_STYLES[site.state])} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--admin-ink)]">{site.name}</span>
                    <span className="shrink-0 text-[12px] font-semibold text-[var(--admin-muted)]">
                      {site.state === "down" ? "Down" : "Slow"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {renewals.length > 0 ? (
        <div className="mt-4 border-t border-[var(--admin-line)] pt-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">Renewing soon</h3>
          <ul className="mt-2 space-y-1.5">
            {renewals.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-[var(--admin-ink)]">
                  {row.domain} <span className="text-[var(--admin-muted)]">· {row.kind}</span>
                </span>
                <span className={cn("shrink-0 text-[12px] font-semibold", row.daysLeft < 0 ? "text-[#b42318]" : row.daysLeft <= 7 ? "text-[#b45309]" : "text-[var(--admin-muted)]")}>
                  {row.daysLeft < 0 ? `expired ${-row.daysLeft}d ago` : row.daysLeft === 0 ? "today" : `${row.daysLeft}d left`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
