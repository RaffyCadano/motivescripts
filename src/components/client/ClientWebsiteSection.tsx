import { useEffect, useState } from "react";
import { ClientStatusBadge } from "@/components/client/ClientStatusBadge";
import {
  clientWebsitePhase,
  clientWebsiteStatusLabel,
  type ProjectDevelopment,
} from "@/data/projectDevelopment";
import { websiteHealthStateLabel, type WebsiteHealthState } from "@/data/websiteHealth";
import { fetchClientWebsiteHealth, type ClientWebsiteHealth } from "@/data/websiteHealthRepository";
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
function HealthDot({ state }: { state: WebsiteHealthState | undefined }) {
  if (!state || state === "unknown") return null;
  return (
    <span className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--client-ink)]">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: HEALTH_DOT_COLOR[state] }} aria-hidden="true" />
      {websiteHealthStateLabel(state)}
    </span>
  );
}

function WebsiteLink({ href, label }: { href: string; label: string }) {
  const safe = safeHttpHref(href);
  if (!safe) return null;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex h-10 items-center rounded-[var(--client-radius)] bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white"
    >
      {label}
    </a>
  );
}

function WebsiteField({
  label,
  url,
  emptyLabel,
  actionLabel,
  health,
}: {
  label: string;
  url: string;
  emptyLabel: string;
  actionLabel: string;
  health?: WebsiteHealthState;
}) {
  const safe = safeHttpHref(url);
  return (
    <div>
      <p className="text-[12px] text-[var(--client-muted)]">{label}</p>
      {safe ? (
        <>
          <p className="mt-1 break-all font-heading text-sm font-semibold text-[var(--client-ink)]">
            {displayHttpHost(url)}
          </p>
          <HealthDot state={health} />
          <WebsiteLink href={url} label={actionLabel} />
        </>
      ) : (
        <p className="mt-1 text-sm text-[var(--client-muted)]">{emptyLabel}</p>
      )}
    </div>
  );
}

type ClientWebsiteSectionProps = {
  projectId: string;
  projectName: string;
  development: ProjectDevelopment;
};

export function ClientWebsiteSection({ projectId, projectName, development }: ClientWebsiteSectionProps) {
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
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Your Website</p>
      <h2 className="mt-2 font-heading text-xl font-semibold tracking-tight text-[var(--client-ink)]">{projectName}</h2>
      <div className="mt-4">
        <p className="text-[12px] text-[var(--client-muted)]">Status</p>
        <div className="mt-1.5">
          <ClientStatusBadge
            label={clientWebsiteStatusLabel(phase)}
            tone={phase === "live" ? "done" : phase === "preview" ? "progress" : "neutral"}
          />
        </div>
      </div>

      {phase === "preview" ? (
        <div className="mt-5">
          <p className="text-[12px] text-[var(--client-muted)]">Preview</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--client-ink)]">
            Your website is currently being developed.
          </p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {staging || phase !== "live" ? (
          <WebsiteField
            label="Staging Website"
            url={development.stagingUrl}
            emptyLabel="Not available yet"
            actionLabel="View Staging Website"
            health={health.staging}
          />
        ) : null}
        <WebsiteField
          label="Production Website"
          url={development.productionUrl}
          emptyLabel="Not available yet"
          actionLabel="Visit Website"
          health={health.production}
        />
      </div>
    </section>
  );
}
