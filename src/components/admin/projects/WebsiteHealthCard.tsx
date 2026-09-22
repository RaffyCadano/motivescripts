import { useEffect, useState } from "react";
import { adminGhostBtn } from "@/components/admin/adminActionStyles";
import { ResponseTimeChart } from "@/components/admin/monitoring/ResponseTimeChart";
import { UptimeTimeline } from "@/components/admin/monitoring/UptimeTimeline";
import {
  currentHealthState,
  formatCheckIssue,
  formatHealthRelativeTime,
  lastSuccessfulCheck,
  websiteHealthEnvironmentLabel,
  websiteHealthStateLabel,
  type WebsiteHealthCheck,
  type WebsiteHealthEnvironment,
  type WebsiteHealthState,
} from "@/data/websiteHealth";
import { checkWebsiteHealthNow, fetchWebsiteHealthHistory, fetchWebsiteHealthTimeline } from "@/data/websiteHealthRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { displayHttpHost, safeHttpHref } from "@/lib/safeUrl";
import { cn } from "@/lib/cn";

const rangeOptions = [
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 24 * 7 },
] as const;

const stateTone: Record<WebsiteHealthState, string> = {
  healthy: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  degraded: "bg-[rgb(245_158_11_/_0.12)] text-[#92610a]",
  down: "bg-[rgb(220_38_38_/_0.08)] text-[#b42318]",
  unknown: "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
};

export function HealthStateBadge({ state }: { state: WebsiteHealthState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-heading text-[12px] font-semibold tracking-tight",
        stateTone[state],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {websiteHealthStateLabel(state)}
    </span>
  );
}

function Row({ label, value, href }: { label: string; value: string; href?: string | null }) {
  return (
    <div>
      <dt className="text-[12px] text-[var(--admin-muted)]">{label}</dt>
      <dd className="mt-1 break-all font-heading text-sm font-semibold text-[var(--admin-ink)]">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--admin-blue)] hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

const historyDotTone: Record<WebsiteHealthCheck["status"], string> = {
  healthy: "bg-[#0f7a56]",
  degraded: "bg-[#92610a]",
  down: "bg-[#b42318]",
};

function HistoryRow({ check }: { check: WebsiteHealthCheck }) {
  const label =
    check.status === "healthy"
      ? `HTTP ${check.httpStatus ?? "—"}`
      : formatCheckIssue(check);
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", historyDotTone[check.status])} aria-hidden="true" />
        <span className="truncate text-[var(--admin-ink)]">{label}</span>
        {check.responseTimeMs !== null ? (
          <span className="shrink-0 text-[var(--admin-muted)]">{check.responseTimeMs} ms</span>
        ) : null}
      </span>
      <span className="shrink-0 text-[12px] text-[var(--admin-muted)]">{formatHealthRelativeTime(check.checkedAt)}</span>
    </li>
  );
}

type WebsiteHealthCardProps = {
  projectId: string;
  productionUrl: string;
  stagingUrl?: string;
  canCheckNow: boolean;
  /** Pin the card to one environment: hides the Production/Staging toggle and titles the card after it. */
  fixedEnvironment?: WebsiteHealthEnvironment;
  /** Called with the latest known state whenever the loaded checks change (including after Check Now). */
  onStateChange?: (environment: WebsiteHealthEnvironment, state: WebsiteHealthState) => void;
};

export function WebsiteHealthCard({
  projectId,
  productionUrl,
  stagingUrl = "",
  canCheckNow,
  fixedEnvironment,
  onStateChange,
}: WebsiteHealthCardProps) {
  const productionHref = safeHttpHref(productionUrl);
  const stagingHref = safeHttpHref(stagingUrl);
  const [environment, setEnvironment] = useState<WebsiteHealthEnvironment>(fixedEnvironment ?? "production");
  const activeHref = environment === "staging" ? stagingHref : productionHref;

  const [checks, setChecks] = useState<WebsiteHealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const [rangeHours, setRangeHours] = useState<number>(rangeOptions[0].hours);
  const [timeline, setTimeline] = useState<WebsiteHealthCheck[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!activeHref) {
      setLoading(false);
      setChecks([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    fetchWebsiteHealthHistory(projectId, environment)
      .then((data) => {
        if (!cancelled) setChecks(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof AgencyDbError ? error.message : "Unable to load website health.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, environment, activeHref]);

  function reloadTimeline() {
    if (!activeHref) {
      setTimeline([]);
      setTimelineLoading(false);
      return () => {};
    }
    let cancelled = false;
    setTimelineLoading(true);
    fetchWebsiteHealthTimeline(projectId, environment, rangeHours)
      .then((data) => {
        if (!cancelled) setTimeline(data);
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
  }

  useEffect(() => {
    const cancel = reloadTimeline();
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, environment, activeHref, rangeHours]);

  async function handleCheckNow() {
    setChecking(true);
    setCheckError(null);
    try {
      const result = await checkWebsiteHealthNow(projectId, environment);
      setChecks((prev) => [result, ...prev].slice(0, 8));
      reloadTimeline();
    } catch (error) {
      setCheckError(error instanceof AgencyDbError ? error.message : "Unable to check the website right now.");
    } finally {
      setChecking(false);
    }
  }

  const state = currentHealthState(checks);
  useEffect(() => {
    if (!loading && !loadError) onStateChange?.(environment, state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadError, environment, state]);
  const latest = checks[0] ?? null;
  const lastSuccess = lastSuccessfulCheck(checks);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">
          {fixedEnvironment ? `${websiteHealthEnvironmentLabel(fixedEnvironment)} health` : "Website Health"}
        </h2>
        {canCheckNow && activeHref ? (
          <button
            type="button"
            className={cn(adminGhostBtn, "h-8 px-3 text-[12px]")}
            onClick={() => void handleCheckNow()}
            disabled={checking}
          >
            {checking ? "Checking…" : "Check Now"}
          </button>
        ) : null}
      </div>

      {stagingHref && !fixedEnvironment ? (
        <div className="mt-3 inline-flex rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-0.5">
          {(["production", "staging"] as const).map((env) => (
            <button
              key={env}
              type="button"
              onClick={() => setEnvironment(env)}
              className={cn(
                "rounded-md px-3 py-1 font-heading text-[12px] font-semibold transition-colors",
                environment === env ? "bg-white text-[var(--admin-ink)] shadow-sm" : "text-[var(--admin-muted)]",
              )}
            >
              {env === "staging" ? "Staging" : "Production"}
            </button>
          ))}
        </div>
      ) : null}

      {!activeHref ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">
          {environment === "staging"
            ? "No staging URL is configured for this project yet."
            : "No production URL is configured for this project yet."}
        </p>
      ) : loading ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">Loading…</p>
      ) : loadError ? (
        <p className="mt-4 text-sm text-[#b42318]">{loadError}</p>
      ) : (
        <>
          <div className="mt-3">
            <HealthStateBadge state={state} />
          </div>

          {checkError ? <p className="mt-3 text-sm text-[#b42318]">{checkError}</p> : null}

          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Row label={environment === "staging" ? "Staging" : "Production"} value={displayHttpHost(activeHref)} href={activeHref} />
            {state === "healthy" ? (
              <>
                <Row label="HTTP Status" value={latest?.httpStatus ? String(latest.httpStatus) : "—"} />
                <Row
                  label="Response Time"
                  value={latest?.responseTimeMs !== null && latest?.responseTimeMs !== undefined ? `${latest.responseTimeMs} ms` : "—"}
                />
              </>
            ) : state === "degraded" || state === "down" ? (
              <Row label="Issue" value={latest ? formatCheckIssue(latest) : "—"} />
            ) : (
              <Row label="Checks" value="No checks yet" />
            )}
            {latest ? (
              <Row label={state === "healthy" ? "Last Checked" : "Detected"} value={formatHealthRelativeTime(latest.checkedAt)} />
            ) : null}
            {lastSuccess ? (
              <Row label="Last Successful Check" value={formatHealthRelativeTime(lastSuccess.checkedAt)} />
            ) : null}
          </dl>

          <div className="mt-5 border-t border-[var(--admin-line)] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] font-semibold text-[var(--admin-muted)]">Response time trend</p>
              <div className="inline-flex rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-0.5">
                {rangeOptions.map((option) => (
                  <button
                    key={option.hours}
                    type="button"
                    onClick={() => setRangeHours(option.hours)}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-heading text-[11px] font-semibold transition-colors",
                      rangeHours === option.hours ? "bg-white text-[var(--admin-ink)] shadow-sm" : "text-[var(--admin-muted)]",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {timelineLoading ? (
              <div className="mt-3 h-[180px] animate-pulse rounded-lg bg-[var(--admin-bg)]" />
            ) : (
              <div className="mt-3">
                <ResponseTimeChart checks={timeline} />
              </div>
            )}

            <p className="mt-5 text-[12px] font-semibold text-[var(--admin-muted)]">Uptime</p>
            {timelineLoading ? (
              <div className="mt-3 h-14 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
            ) : (
              <div className="mt-3">
                <UptimeTimeline checks={timeline} hoursBack={rangeHours} />
              </div>
            )}
          </div>

          {checks.length > 0 ? (
            <div className="mt-5 border-t border-[var(--admin-line)] pt-3">
              <p className="text-[12px] font-semibold text-[var(--admin-muted)]">Recent Checks</p>
              <ul className="mt-1 divide-y divide-[var(--admin-line)]">
                {checks.map((check) => (
                  <HistoryRow key={check.id} check={check} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
