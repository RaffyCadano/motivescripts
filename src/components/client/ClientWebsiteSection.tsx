import { ClientStatusBadge } from "@/components/client/ClientStatusBadge";
import {
  clientWebsitePhase,
  clientWebsiteStatusLabel,
  type ProjectDevelopment,
} from "@/data/projectDevelopment";
import { displayHttpHost, safeHttpHref } from "@/lib/safeUrl";

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
}: {
  label: string;
  url: string;
  emptyLabel: string;
  actionLabel: string;
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
          <WebsiteLink href={url} label={actionLabel} />
        </>
      ) : (
        <p className="mt-1 text-sm text-[var(--client-muted)]">{emptyLabel}</p>
      )}
    </div>
  );
}

type ClientWebsiteSectionProps = {
  projectName: string;
  development: ProjectDevelopment;
};

export function ClientWebsiteSection({ projectName, development }: ClientWebsiteSectionProps) {
  const phase = clientWebsitePhase(development);
  const staging = safeHttpHref(development.stagingUrl);

  return (
    <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Your Website</p>
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
          />
        ) : null}
        <WebsiteField
          label="Production Website"
          url={development.productionUrl}
          emptyLabel="Not available yet"
          actionLabel="Visit Website"
        />
      </div>
    </section>
  );
}
