import { Link } from "react-router-dom";
import { ClientProgress } from "@/components/client/ClientProgress";
import { ClientStatusBadge } from "@/components/client/ClientStatusBadge";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { calculateProjectProgress, currentMilestone, formatProjectDay, type AgencyProject } from "@/data/agencyProjects";
import { clientProjectStatusExplanation, clientProjectStatusTone } from "@/data/clientPortal";
import { cn } from "@/lib/cn";

type ClientProjectCardProps = {
  compact?: boolean;
  project?: AgencyProject | null;
  nextLabel?: string;
};

export function ClientProjectCard({ compact = false, project: projectProp, nextLabel }: ClientProjectCardProps) {
  const { client, project: sessionProject } = usePortalSession();
  const project = projectProp ?? sessionProject;
  if (!project) return null;

  const progress = calculateProjectProgress(project);
  const milestone = currentMilestone(project);
  const statusNote = clientProjectStatusExplanation(project.status);
  const nextStep = nextLabel ?? "We’ll notify you when the next step is ready.";

  return (
    <article
      className={cn(
        "w-full rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)]",
        compact ? "p-5 md:p-6" : "p-6 md:p-8",
      )}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">
            Your project
          </p>
          <h2 className={cn("mt-2 font-heading font-semibold tracking-tight", compact ? "text-xl" : "text-2xl md:text-[1.75rem]")}>
            {project.name}
          </h2>
          <p className="mt-1 text-sm text-[var(--client-muted)]">{client?.businessName ?? "Your business"}</p>
          <div className="mt-4">
            <ClientStatusBadge label={project.status} tone={clientProjectStatusTone(project.status)} />
          </div>
          {statusNote ? <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--client-muted)]">{statusNote}</p> : null}
        </div>
        {!compact ? (
          <p className="font-heading text-4xl font-semibold tracking-tight text-[var(--client-ink)] lg:text-right">
            {progress}
            <span className="text-xl text-[var(--client-muted)]">%</span>
          </p>
        ) : null}
      </div>

      <div className={cn(compact ? "mt-5" : "mt-7")}>
        <ClientProgress value={progress} label="Progress" />
      </div>

      <dl className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <dt className="text-[12px] text-[var(--client-muted)]">Current milestone</dt>
          <dd className="mt-1 font-heading text-sm font-semibold text-[var(--client-ink)]">
            {milestone?.name ?? "None yet"}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] text-[var(--client-muted)]">Next</dt>
          <dd className="mt-1 font-heading text-sm font-semibold text-[var(--client-ink)]">{nextStep}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-[var(--client-muted)]">Project status</dt>
          <dd className="mt-1 font-heading text-sm font-semibold text-[var(--client-ink)]">{project.status}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-[var(--client-muted)]">Estimated completion</dt>
          <dd className="mt-1 font-heading text-sm font-semibold text-[var(--client-ink)]">
            {formatProjectDay(project.targetLaunchDate)}
          </dd>
        </div>
      </dl>

      {compact ? (
        <Link
          to="/client/project"
          className="mt-6 inline-flex font-heading text-sm font-semibold text-[var(--client-blue)] hover:underline"
        >
          View project details
        </Link>
      ) : null}
    </article>
  );
}
