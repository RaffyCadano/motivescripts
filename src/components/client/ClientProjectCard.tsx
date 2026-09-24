import { Check, CircleCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { ClientProgressRing } from "@/components/client/ClientProgressRing";
import { ClientStatusBadge } from "@/components/client/ClientStatusBadge";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { calculateProjectProgress, currentMilestone, formatProjectDay, type AgencyProject } from "@/data/agencyProjects";
import { displayMilestoneName } from "@/data/projectMilestones";
import { clientProjectStatusExplanation, clientProjectStatusTone } from "@/data/clientPortal";
import { projectCompletedDate, timelineStagesFromProject } from "@/data/clientProjectProgress";
import { cn } from "@/lib/cn";

type ClientProjectCardProps = {
  compact?: boolean;
  project?: AgencyProject | null;
  nextLabel?: string;
};

function Fact({ label, children }: { label: string; children: string }) {
  return (
    <div className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-bg)] p-3.5">
      <dt className="text-[12px] text-[var(--client-muted)]">{label}</dt>
      <dd className="mt-1 font-heading text-sm font-semibold leading-snug text-[var(--client-ink)]">{children}</dd>
    </div>
  );
}

export function ClientProjectCard({ compact = false, project: projectProp, nextLabel }: ClientProjectCardProps) {
  const { client, project: sessionProject } = usePortalSession();
  const project = projectProp ?? sessionProject;
  if (!project) return null;
  return <ClientProjectCardView compact={compact} project={project} businessName={client?.businessName ?? "Your business"} nextLabel={nextLabel} />;
}

/** The card itself, from plain props (the wrapper above reads the signed-in client's session). */
export function ClientProjectCardView({
  compact = false,
  project,
  businessName,
  nextLabel,
}: {
  compact?: boolean;
  project: AgencyProject;
  businessName: string;
  nextLabel?: string;
}) {
  const progress = calculateProjectProgress(project);
  const milestone = currentMilestone(project);
  const statusNote = clientProjectStatusExplanation(project.status);
  const nextStep = nextLabel ?? "We’ll notify you when the next step is ready.";
  const isCompleted = project.status === "Completed";
  const stages = isCompleted ? timelineStagesFromProject(project) : [];
  const completedDate = isCompleted ? projectCompletedDate(project) : null;

  return (
    <article
      className={cn(
        "w-full rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)]",
        compact ? "p-5 md:p-6" : "p-6 md:p-8",
      )}
    >
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Your project</p>
          <h2 className={cn("mt-2 font-heading font-semibold tracking-tight", compact ? "text-xl" : "text-2xl md:text-[1.75rem]")}>
            {project.name}
          </h2>
          <p className="mt-1 text-sm text-[var(--client-muted)]">{businessName}</p>
          <div className="mt-4">
            <ClientStatusBadge label={project.status} tone={clientProjectStatusTone(project.status)} />
          </div>
        </div>
        <ClientProgressRing value={progress} size={compact ? 72 : 96} complete={isCompleted} />
      </div>

      {statusNote && !isCompleted ? (
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--client-muted)]">{statusNote}</p>
      ) : null}

      {isCompleted ? (
        <div className="mt-6 rounded-[var(--client-radius)] border border-[rgb(16_185_129_/_0.25)] bg-[rgb(16_185_129_/_0.06)] p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="flex items-center gap-2 font-heading text-sm font-semibold text-[#0f7a56]">
              <CircleCheck size={18} strokeWidth={2.2} aria-hidden="true" />
              {statusNote || "Your project is complete."}
            </p>
            {completedDate ? (
              <p className="text-[13px] text-[var(--client-muted)]">
                Completed <span className="font-semibold text-[var(--client-ink)]">{formatProjectDay(completedDate)}</span>
              </p>
            ) : null}
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {stages.map((stage) => (
              <li
                key={stage.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(16_185_129_/_0.25)] bg-white px-3 py-1 text-[13px] font-medium text-[var(--client-ink)]"
              >
                <Check size={13} strokeWidth={2.8} className="text-[#0f7a56]" aria-hidden="true" />
                {stage.label}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Fact label="Current milestone">{milestone ? displayMilestoneName(milestone.name) : "None yet"}</Fact>
          <Fact label="Next">{nextStep}</Fact>
          <Fact label="Project status">{project.status}</Fact>
          <Fact label="Estimated completion">{formatProjectDay(project.targetLaunchDate)}</Fact>
        </dl>
      )}

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
