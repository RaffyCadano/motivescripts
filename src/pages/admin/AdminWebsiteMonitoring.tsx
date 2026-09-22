import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { HealthStateBadge } from "@/components/admin/projects/WebsiteHealthCard";
import { ResponseTimeChart } from "@/components/admin/monitoring/ResponseTimeChart";
import { UptimeTimeline } from "@/components/admin/monitoring/UptimeTimeline";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { developerDeploymentRows } from "@/data/developerOverview";
import { currentHealthState, type WebsiteHealthCheck, type WebsiteHealthState } from "@/data/websiteHealth";
import {
  fetchLatestWebsiteHealthByProject,
  fetchProjectHasFastMonitoring,
  fetchWebsiteHealthTimeline,
} from "@/data/websiteHealthRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

const stateRank: Record<WebsiteHealthState, number> = { down: 0, degraded: 1, unknown: 2, healthy: 3 };

const rangeOptions = [
  { label: "Last 24 hours", hours: 24 },
  { label: "Last 7 days", hours: 24 * 7 },
] as const;

function formatMs(ms: number | null): string {
  return ms === null ? "—" : `${ms} ms`;
}

export function AdminWebsiteMonitoring() {
  const { clients, projects } = useLeads();
  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c.businessName])), [clients]);

  const launched = useMemo(
    () =>
      developerDeploymentRows(projects).filter(
        (row) => row.development.deploymentStatus === "Production" && row.development.productionUrl.trim(),
      ),
    [projects],
  );

  const [latest, setLatest] = useState<Map<string, WebsiteHealthCheck>>(new Map());
  const [fastMonitoring, setFastMonitoring] = useState<Set<string>>(new Set());
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const projectIdsKey = launched.map((row) => row.projectId).join(",");

  useEffect(() => {
    let cancelled = false;
    const ids = projectIdsKey ? projectIdsKey.split(",") : [];
    if (ids.length === 0) {
      setLatest(new Map());
      setFastMonitoring(new Set());
      setListLoading(false);
      return;
    }
    setListLoading(true);
    void Promise.all([
      fetchLatestWebsiteHealthByProject(ids, "production"),
      Promise.all(ids.map((id) => fetchProjectHasFastMonitoring(id).then((fast) => [id, fast] as const))),
    ])
      .then(([latestByProject, fastRows]) => {
        if (cancelled) return;
        setLatest(latestByProject);
        setFastMonitoring(new Set(fastRows.filter(([, fast]) => fast).map(([id]) => id)));
        setListError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setListError(error instanceof AgencyDbError ? error.message : "Unable to load website health.");
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectIdsKey]);

  const rows = useMemo(
    () =>
      [...launched].sort((a, b) => {
        const stateA = currentHealthState(latest.has(a.projectId) ? [latest.get(a.projectId)!] : []);
        const stateB = currentHealthState(latest.has(b.projectId) ? [latest.get(b.projectId)!] : []);
        const rankDiff = stateRank[stateA] - stateRank[stateB];
        if (rankDiff !== 0) return rankDiff;
        return a.projectName.localeCompare(b.projectName);
      }),
    [launched, latest],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && rows.length > 0) setSelectedId(rows[0].projectId);
  }, [rows, selectedId]);
  const selected = rows.find((row) => row.projectId === selectedId) ?? null;

  const [rangeHours, setRangeHours] = useState<number>(rangeOptions[0].hours);
  const [timeline, setTimeline] = useState<WebsiteHealthCheck[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setTimeline([]);
      return;
    }
    let cancelled = false;
    setTimelineLoading(true);
    void fetchWebsiteHealthTimeline(selectedId, "production", rangeHours)
      .then((rows) => {
        if (!cancelled) setTimeline(rows);
      })
      .catch(() => {
        if (!cancelled) setTimeline([]);
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, rangeHours]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Website monitoring"
        description="Uptime and response time for every launched website, checked automatically (every 5 minutes for Advanced-monitoring plans, ~15 otherwise)."
      />

      {listError ? <p className="text-sm text-red-700">{listError}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-3">
          {listLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
          ) : rows.length === 0 ? (
            <p className="p-3 text-sm text-[var(--admin-muted)]">No launched projects with a production URL yet.</p>
          ) : (
            <ul className="space-y-1">
              {rows.map((row) => {
                const check = latest.get(row.projectId);
                const state = currentHealthState(check ? [check] : []);
                const active = row.projectId === selectedId;
                return (
                  <li key={row.projectId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.projectId)}
                      className={cn(
                        "flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                        active ? "bg-[var(--admin-hover)]" : "hover:bg-[var(--admin-bg)]",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--admin-ink)]">{row.projectName}</p>
                        <p className="truncate text-[11px] text-[var(--admin-muted)]">
                          {clientsById.get(row.project.clientId) ?? "Client"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <HealthStateBadge state={state} />
                        <p className="mt-1 text-[11px] text-[var(--admin-muted)]">{formatMs(check?.responseTimeMs ?? null)}</p>
                        {fastMonitoring.has(row.projectId) ? (
                          <p className="mt-0.5 text-[10px] font-semibold text-[var(--admin-blue)]">Advanced</p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="min-w-0 space-y-4">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4">
                <div className="min-w-0">
                  <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{selected.projectName}</p>
                  <p className="text-[12px] text-[var(--admin-muted)]">
                    {clientsById.get(selected.project.clientId) ?? "Client"} ·{" "}
                    <Link to={`/admin/projects/${selected.projectId}`} className="text-[var(--admin-blue)] hover:underline">
                      View project
                    </Link>
                  </p>
                </div>
                {/* Filters scope everything below them -- one row, date range first. */}
                <div className="inline-flex rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-0.5">
                  {rangeOptions.map((option) => (
                    <button
                      key={option.hours}
                      type="button"
                      onClick={() => setRangeHours(option.hours)}
                      className={cn(
                        "rounded-md px-3 py-1.5 font-heading text-[12px] font-semibold transition-colors",
                        rangeHours === option.hours ? "bg-white text-[var(--admin-ink)] shadow-sm" : "text-[var(--admin-muted)]",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4">
                <h2 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Response time</h2>
                {timelineLoading ? (
                  <div className="mt-3 h-[220px] animate-pulse rounded-lg bg-[var(--admin-bg)]" />
                ) : (
                  <div className="mt-3">
                    <ResponseTimeChart checks={timeline} />
                  </div>
                )}
              </div>

              <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4">
                <h2 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Uptime</h2>
                {timelineLoading ? (
                  <div className="mt-3 h-16 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
                ) : (
                  <div className="mt-3">
                    <UptimeTimeline checks={timeline} hoursBack={rangeHours} />
                  </div>
                )}
              </div>

              <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4">
                <button
                  type="button"
                  onClick={() => setShowTable((current) => !current)}
                  className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                >
                  {showTable ? "Hide" : "View"} as table
                </button>
                {showTable ? (
                  <div className="mt-3 max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-[var(--admin-line)] text-[var(--admin-muted)]">
                          <th className="py-1.5 pr-3 font-semibold">Checked at</th>
                          <th className="py-1.5 pr-3 font-semibold">Status</th>
                          <th className="py-1.5 font-semibold">Response time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...timeline].reverse().map((check) => (
                          <tr key={check.id} className="border-b border-[var(--admin-line)] last:border-0">
                            <td className="py-1.5 pr-3 text-[var(--admin-ink)]">
                              {new Date(check.checkedAt).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-1.5 pr-3 text-[var(--admin-ink)]">
                              {check.status === "healthy" ? "Healthy" : check.status === "degraded" ? "Degraded" : "Down"}
                            </td>
                            <td className="py-1.5 text-[var(--admin-ink)]">{formatMs(check.responseTimeMs)}</td>
                          </tr>
                        ))}
                        {timeline.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-3 text-[var(--admin-muted)]">
                              No checks in this window yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </>
          ) : !listLoading ? (
            <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] p-8 text-center text-sm text-[var(--admin-muted)]">
              Select a project to see its monitoring detail.
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
