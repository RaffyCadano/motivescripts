import { Link } from "react-router-dom";

type ClientTaskRequestsCardProps = {
  projectId: string;
  pendingCount: number;
  loading?: boolean;
};

export function ClientTaskRequestsCard({ projectId, pendingCount, loading }: ClientTaskRequestsCardProps) {
  if (loading || pendingCount === 0) return null;

  const href = `/client/project/${projectId}/requests`;

  return (
    <section className="rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[var(--client-card)] p-5 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Action Required</p>
      <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">
        {pendingCount === 1 ? "1 request from your team" : `${pendingCount} requests from your team`}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
        Your project manager needs some information or files from you to keep production moving.
      </p>
      <Link
        to={href}
        className="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
      >
        Review Requests
      </Link>
    </section>
  );
}
