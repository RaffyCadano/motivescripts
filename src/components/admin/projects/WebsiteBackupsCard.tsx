import { useEffect, useState } from "react";
import { adminGhostBtn } from "@/components/admin/adminActionStyles";
import { formatBackupRelativeTime, formatBackupSize, lastSuccessfulBackup, type WebsiteBackup } from "@/data/websiteBackups";
import {
  backupWebsiteNow,
  downloadWebsiteBackup,
  fetchProjectHasActiveCarePlan,
  fetchWebsiteBackupHistory,
} from "@/data/websiteBackupsRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

const HISTORY_VISIBLE = 5;

type WebsiteBackupsCardProps = {
  projectId: string;
  canBackUpNow: boolean;
};

/**
 * Website Care's "Automated backups" bullet, made real: a daily snapshot of the project's live
 * production HTML, retained and downloadable. Shown only for projects with an active/past-due
 * Care plan (any tier -- unlike Advanced monitoring, backups are on every tier), so this card is
 * absent for projects without one rather than showing an empty, confusing state.
 */
export function WebsiteBackupsCard({ projectId, canBackUpNow }: WebsiteBackupsCardProps) {
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [backups, setBackups] = useState<WebsiteBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runningNow, setRunningNow] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchProjectHasActiveCarePlan(projectId).then((value) => {
      if (!cancelled) setEligible(value);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (eligible !== true) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchWebsiteBackupHistory(projectId)
      .then((data) => {
        if (!cancelled) setBackups(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof AgencyDbError ? error.message : "Unable to load backup history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, eligible, refreshTick]);

  async function handleBackupNow() {
    setRunningNow(true);
    setRunError(null);
    try {
      await backupWebsiteNow(projectId);
      setRefreshTick((tick) => tick + 1);
    } catch (error) {
      setRunError(error instanceof AgencyDbError ? error.message : "Unable to back up the website right now.");
    } finally {
      setRunningNow(false);
    }
  }

  async function handleDownload(backup: WebsiteBackup) {
    setDownloadingId(backup.id);
    try {
      await downloadWebsiteBackup(backup);
    } catch {
      // Signed-URL/download failures are rare and self-evident (nothing happens); no need for a
      // persistent error banner over a single failed download attempt.
    } finally {
      setDownloadingId(null);
    }
  }

  if (eligible !== true) return null;

  const lastGood = lastSuccessfulBackup(backups);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Website Backups</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
            Automatic daily snapshot of the live production page, retained for recovery.
          </p>
        </div>
        {canBackUpNow ? (
          <button
            type="button"
            className={cn(adminGhostBtn, "h-8 px-3 text-[12px]")}
            onClick={() => void handleBackupNow()}
            disabled={runningNow}
          >
            {runningNow ? "Backing up…" : "Back up now"}
          </button>
        ) : null}
      </div>

      {runError ? <p className="mt-3 text-sm text-[#b42318]">{runError}</p> : null}

      {loading ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">Loading…</p>
      ) : loadError ? (
        <p className="mt-4 text-sm text-[#b42318]">{loadError}</p>
      ) : (
        <>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Last successful backup</dt>
              <dd className="mt-1 font-heading text-sm font-semibold text-[var(--admin-ink)]">
                {lastGood ? formatBackupRelativeTime(lastGood.createdAt) : "None yet"}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Size</dt>
              <dd className="mt-1 font-heading text-sm font-semibold text-[var(--admin-ink)]">
                {lastGood ? formatBackupSize(lastGood.byteSize) : "—"}
              </dd>
            </div>
          </dl>

          {backups.length > 0 ? (
            <div className="mt-5 border-t border-[var(--admin-line)] pt-3">
              <p className="text-[12px] font-semibold text-[var(--admin-muted)]">Recent backups</p>
              <ul className="mt-1 divide-y divide-[var(--admin-line)]">
                {backups.slice(0, HISTORY_VISIBLE).map((backup) => (
                  <li key={backup.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          backup.status === "ok" ? "bg-[#0f7a56]" : "bg-[#b42318]",
                        )}
                        aria-hidden="true"
                      />
                      <span className="truncate text-[var(--admin-ink)]">
                        {backup.status === "ok" ? formatBackupSize(backup.byteSize) : backup.errorMessage || "Backup failed"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-[12px] text-[var(--admin-muted)]">{formatBackupRelativeTime(backup.createdAt)}</span>
                      {backup.status === "ok" ? (
                        <button
                          type="button"
                          className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline disabled:opacity-50"
                          disabled={downloadingId === backup.id}
                          onClick={() => void handleDownload(backup)}
                        >
                          {downloadingId === backup.id ? "…" : "Download"}
                        </button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--admin-muted)]">No backups yet -- the first automatic backup runs within a day.</p>
          )}
        </>
      )}
    </section>
  );
}
