import { useEffect, useState } from "react";
import { adminGhostBtn } from "@/components/admin/adminActionStyles";
import {
  currentHealthState,
  formatCheckIssue,
  formatHealthRelativeTime,
  lastSuccessfulCheck,
  websiteHealthStateLabel,
  type WebsiteHealthCheck,
  type WebsiteHealthState,
} from "@/data/websiteHealth";
import { checkWebsiteHealthNow, fetchWebsiteHealthHistory } from "@/data/websiteHealthRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { displayHttpHost, safeHttpHref } from "@/lib/safeUrl";
import { cn } from "@/lib/cn";

const stateTone: Record<WebsiteHealthState, string> = {
  healthy: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  degraded: "bg-[rgb(245_158_11_/_0.12)] text-[#92610a]",
  down: "bg-[rgb(220_38_38_/_0.08)] text-[#b42318]",
  unknown: "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
};

function HealthStateBadge({ state }: { state: WebsiteHealthState }) {
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-[var(--admin-muted)]">{label}</dt>
      <dd className="mt-1 font-heading text-sm font-semibold text-[var(--admin-ink)]">{value}</dd>
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
  canCheckNow: boolean;
};

export function WebsiteHealthCard({ projectId, productionUrl, canCheckNow }: WebsiteHealthCardProps) {
  const productionHref = safeHttpHref(productionUrl);
  const [checks, setChecks] = useState<WebsiteHealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!productionHref) {
      setLoading(false);
      setChecks([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    fetchWebsiteHealthHistory(projectId)
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
  }, [projectId, productionHref]);

  async function handleCheckNow() {
    setChecking(true);
    setCheckError(null);
    try {
      const result = await checkWebsiteHealthNow(projectId);
      setChecks((prev) => [result, ...prev].slice(0, 8));
    } catch (error) {
      setCheckError(error instanceof AgencyDbError ? error.message : "Unable to check the website right now.");
    } finally {
      setChecking(false);
    }
  }

  const state = currentHealthState(checks);
  const latest = checks[0] ?? null;
  const lastSuccess = lastSuccessfulCheck(checks);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Website Health</h2>
        {canCheckNow && productionHref ? (
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

      {!productionHref ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">
          No production URL is configured for this project yet.
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
            <Row label="Production" value={displayHttpHost(productionHref)} />
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
