import { useEffect, useState } from "react";
import { formatWebsiteVersion, type WebsiteVersion } from "@/data/websiteVersions";
import { listWebsiteVersions } from "@/data/websiteVersionsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

function formatVersionDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** A clear history of what's changed on the live site -- v1.0 at launch, then a bump for every change that ships. */
export function ClientWebsiteVersions({ projectId }: { projectId: string }) {
  const [versions, setVersions] = useState<WebsiteVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void listWebsiteVersions(projectId)
      .then((rows) => {
        if (active) setVersions(rows);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof AgencyDbError ? caught.message : "Unable to load your version history.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  if (loading || error || versions.length === 0) {
    if (loading) return <div className="h-20 animate-pulse rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)]" />;
    if (error) return null;
    return null;
  }

  return (
    <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
      <h2 className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">Website version history</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
        Every change that's shipped to your live site.
      </p>
      <ul className="mt-4 space-y-3">
        {versions.map((version) => (
          <li key={version.id} className="flex items-start gap-3 rounded-lg border border-[var(--client-line)] p-3">
            <span
              className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                version.isMajor
                  ? "bg-[rgb(0_80_240_/_0.1)] text-[var(--client-blue)]"
                  : "bg-[var(--client-bg)] text-[var(--client-muted)]"
              }`}
            >
              {formatWebsiteVersion(version)}
            </span>
            <div className="min-w-0">
              {version.summary ? <p className="text-sm text-[var(--client-ink)]">{version.summary}</p> : null}
              <p className="mt-0.5 text-[12px] text-[var(--client-muted)]">{formatVersionDate(version.createdAt)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
