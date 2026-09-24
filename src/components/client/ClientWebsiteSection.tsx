import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { ClientStatusBadge } from "@/components/client/ClientStatusBadge";
import {
  clientWebsitePhase,
  clientWebsiteStatusLabel,
  type ProjectDevelopment,
} from "@/data/projectDevelopment";
import { websiteHealthStateLabel, type WebsiteHealthState } from "@/data/websiteHealth";
import { fetchClientWebsiteHealth, type ClientWebsiteHealth } from "@/data/websiteHealthRepository";
import { cn } from "@/lib/cn";
import { displayHttpHost, safeHttpHref } from "@/lib/safeUrl";

const HEALTH_DOT_COLOR: Record<WebsiteHealthState, string> = {
  healthy: "#0f7a56",
  degraded: "#eda100",
  down: "#b42318",
  unknown: "var(--client-muted)",
};

/** Only rendered once a check has actually completed -- most projects without an active
 * monitoring-enabled Care plan will never have a row, and "Unknown" next to every URL would
 * just be noise. */
function HealthPill({ state }: { state: WebsiteHealthState | undefined }) {
  if (!state || state === "unknown") return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--client-line)] bg-white px-2.5 py-1 text-[12px] font-medium text-[var(--client-ink)]">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: HEALTH_DOT_COLOR[state] }} aria-hidden="true" />
      {websiteHealthStateLabel(state)}
    </span>
  );
}

/** One environment (staging or the live site): its address, whether it's up, and a way to open it. */
function WebsiteTile({
  label,
  url,
  emptyLabel,
  actionLabel,
  health,
  primary,
}: {
  label: string;
  url: string;
  emptyLabel: string;
  actionLabel: string;
  health?: WebsiteHealthState;
  primary?: boolean;
}) {
  const safe = safeHttpHref(url);
  return (
    <div className="flex flex-col rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-bg)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--client-muted)]">{label}</p>
        {safe ? <HealthPill state={health} /> : null}
      </div>
      {safe ? (
        <>
          <p className="mt-2 break-all font-heading text-base font-semibold text-[var(--client-ink)]">{displayHttpHost(url)}</p>
          <a
            href={safe}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "mt-4 inline-flex h-10 items-center justify-center gap-2 self-start rounded-[var(--client-radius)] px-4 font-heading text-sm font-semibold transition-colors",
              primary
                ? "bg-[var(--client-blue)] text-white hover:bg-[var(--client-bright)]"
                : "border border-[var(--client-line)] bg-white text-[var(--client-ink)] hover:border-[rgb(0_80_240_/_0.35)] hover:bg-[var(--client-hover)]",
            )}
          >
            {actionLabel}
            <ExternalLink size={15} strokeWidth={2.2} aria-hidden="true" />
          </a>
        </>
      ) : (
        <p className="mt-2 text-sm text-[var(--client-muted)]">{emptyLabel}</p>
      )}
    </div>
  );
}

type ClientWebsiteSectionProps = {
  projectId: string;
  projectName: string;
  development: ProjectDevelopment;
  /** The free period ended with no Care plan and the site is paused. */
  paused?: boolean;
};

export function ClientWebsiteSection({ projectId, projectName, development, paused = false }: ClientWebsiteSectionProps) {
  const phase = clientWebsitePhase(development);
  const staging = safeHttpHref(development.stagingUrl);
  const [health, setHealth] = useState<ClientWebsiteHealth>({});

  useEffect(() => {
    let active = true;
    void fetchClientWebsiteHealth(projectId).then((result) => {
      if (active) setHealth(result);
    });
    return () => {
      active = false;
    };
  }, [projectId]);

  return (
    <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Your Website</p>
          <h2 className="mt-2 font-heading text-xl font-semibold tracking-tight text-[var(--client-ink)]">{projectName}</h2>
        </div>
        {paused ? (
          <ClientStatusBadge label="Paused" tone="changes" />
        ) : (
          <ClientStatusBadge
            label={clientWebsiteStatusLabel(phase)}
            tone={phase === "live" ? "done" : phase === "preview" ? "progress" : "neutral"}
          />
        )}
      </div>

      {phase === "preview" ? (
        <p className="mt-3 text-sm leading-relaxed text-[var(--client-muted)]">Your website is currently being developed.</p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <WebsiteTile
          label="Live website"
          url={development.productionUrl}
          emptyLabel="Not available yet"
          actionLabel="Visit website"
          health={health.production}
          primary
        />
        {staging || phase !== "live" ? (
          <WebsiteTile
            label="Preview (staging)"
            url={development.stagingUrl}
            emptyLabel="Not available yet"
            actionLabel="View preview"
            health={health.staging}
          />
        ) : null}
      </div>
    </section>
  );
}
