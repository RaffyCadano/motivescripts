import { Link } from "react-router-dom";
import { formatClientDate } from "@/data/agencyClients";
import { discoveryClientStatusLabel, type DiscoveryIntake } from "@/data/discoveryIntake";

type ClientDiscoveryCardProps = {
  projectId: string;
  projectName: string;
  intake: DiscoveryIntake | null;
  loading?: boolean;
};

export function ClientDiscoveryCard({ projectId, projectName, intake, loading }: ClientDiscoveryCardProps) {
  if (loading) {
    return (
      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <p className="text-sm text-[var(--client-muted)]">Loading project discovery…</p>
      </section>
    );
  }

  if (!intake || intake.status === "not_started") {
    return null;
  }

  const status = discoveryClientStatusLabel(intake.status);
  const href = `/client/project/${projectId}/discovery`;

  if (intake.status === "complete") {
    return (
      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Project Discovery</p>
        <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">{projectName}</h2>
        <p className="mt-2 text-sm text-[var(--client-muted)]">Status: Complete ✓</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--client-muted)]">
          Your project discovery has been approved. Production can proceed.
        </p>
        <Link
          to={href}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-hover)]"
        >
          View Submission
        </Link>
      </section>
    );
  }

  if (intake.status === "more_information_needed") {
    return (
      <section className="rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[var(--client-card)] p-5 md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Project Discovery</p>
        <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">{projectName}</h2>
        <p className="mt-2 text-sm font-medium text-[var(--client-ink)]">Status: {status}</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--client-muted)]">
          Your project manager needs a few additional details before production can begin.
        </p>
        {intake.followUp?.message ? (
          <p className="mt-3 rounded-lg border border-[var(--client-line)] bg-white px-3 py-2 text-sm text-[var(--client-muted)]">
            {intake.followUp.message}
          </p>
        ) : null}
        <Link
          to={href}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
        >
          Review & Respond
        </Link>
      </section>
    );
  }

  if (intake.status === "submitted" || intake.status === "under_review") {
    return (
      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Project Discovery</p>
        <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">{projectName}</h2>
        {intake.submittedAt ? (
          <p className="mt-2 text-sm text-[var(--client-muted)]">Submitted {formatClientDate(intake.submittedAt)}</p>
        ) : null}
        <p className="mt-1 text-sm font-medium text-[var(--client-ink)]">Status: {status}</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--client-muted)]">
          Your project manager is reviewing your information.
        </p>
        <Link
          to={href}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-hover)]"
        >
          View Submission
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[var(--client-card)] p-5 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Project Discovery</p>
      <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">{projectName}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
        Help our team collect everything needed to begin production.
      </p>
      <p className="mt-2 text-sm font-medium text-[var(--client-ink)]">Status: {status}</p>
      <Link
        to={href}
        className="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
      >
        Complete Discovery
      </Link>
    </section>
  );
}
