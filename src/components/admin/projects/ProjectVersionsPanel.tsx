import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { adminBlueBtn, adminGhostBtn } from "@/components/admin/adminActionStyles";
import { formatWebsiteVersion, sortWebsiteVersions, type WebsiteVersion } from "@/data/websiteVersions";
import { listWebsiteVersions, recordWebsiteVersion } from "@/data/websiteVersionsRepository";
import type { AgencyProject } from "@/data/agencyProjects";
import { AgencyDbError } from "@/lib/dbErrors";

function formatVersionDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Whole-site version history for this project (v1.0, v1.1, v2.0, ...) -- distinct from the
 * per-deliverable Files tab. v1.0 auto-seeds on launch; every later entry is a deliberate staff
 * call, minor for included Website Care work, major for a redesign/new-feature project.
 */
export function ProjectVersionsPanel({ project }: { project: AgencyProject }) {
  const { profile } = useAuth();
  const canManage = hasPermission(profile, "projects.manage");
  const [versions, setVersions] = useState<WebsiteVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [isMajor, setIsMajor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setVersions(await listWebsiteVersions(project.id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to load version history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function onAdd() {
    setFormError(null);
    if (!summary.trim()) {
      setFormError("Describe what changed.");
      return;
    }
    setSaving(true);
    try {
      await recordWebsiteVersion({ projectId: project.id, summary: summary.trim(), isMajor });
      setSummary("");
      setIsMajor(false);
      setFormOpen(false);
      await reload();
    } catch (caught) {
      setFormError(caught instanceof AgencyDbError ? caught.message : "Unable to record this version.");
    } finally {
      setSaving(false);
    }
  }

  const sorted = sortWebsiteVersions(versions);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Website versions</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
            v1.0 was recorded automatically at launch. Add an entry whenever a change ships -- minor for Website Care
            work, major for a redesign.
          </p>
        </div>
        {canManage ? (
          <button type="button" className={`${adminBlueBtn} justify-center`} onClick={() => setFormOpen((open) => !open)}>
            {formOpen ? "Cancel" : "+ Add version"}
          </button>
        ) : null}
      </div>

      {formOpen ? (
        <div className="mt-4 space-y-3 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4">
          <label className="block text-[12px] font-semibold text-[var(--admin-muted)]">
            What changed?
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={2}
              placeholder="e.g. Updated contact page hours and added a new testimonials section"
              className="mt-1 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            />
          </label>
          <label className="flex items-center gap-2 text-[12px] font-semibold text-[var(--admin-muted)]">
            <input type="checkbox" checked={isMajor} onChange={(event) => setIsMajor(event.target.checked)} />
            This is a major change (bumps to the next whole version, e.g. v2.0)
          </label>
          {formError ? <p className="text-[12px] text-[#b45309]">{formError}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              className="h-9 rounded-lg bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white disabled:opacity-50"
              onClick={() => void onAdd()}
            >
              Save version
            </button>
            <button type="button" className={adminGhostBtn} onClick={() => setFormOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
      ) : error ? (
        <p className="mt-4 text-sm text-[#b45309]">{error}</p>
      ) : sorted.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">No versions recorded yet -- this project hasn't launched.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sorted.map((version) => (
            <li key={version.id} className="flex items-start gap-3 rounded-lg border border-[var(--admin-line)] p-3">
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                  version.isMajor ? "bg-[rgb(0_80_240_/_0.1)] text-[var(--admin-blue)]" : "bg-[var(--admin-bg)] text-[var(--admin-muted)]"
                }`}
              >
                {formatWebsiteVersion(version)}
              </span>
              <div className="min-w-0">
                {version.summary ? <p className="text-sm text-[var(--admin-ink)]">{version.summary}</p> : null}
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{formatVersionDate(version.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
