import { Link } from "react-router-dom";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { currentMilestone, formatProjectDay, type AgencyProject } from "@/data/agencyProjects";
import { displayMilestoneName } from "@/data/projectMilestones";
import { projectWorkload, teamProjectHref } from "@/data/teamWorkspace";

type TeamProjectCardProps = {
  project: AgencyProject;
  clientName: string;
  assignedTaskCount: number;
  teammates?: string;
};

export function TeamProjectCard({ project, clientName, assignedTaskCount, teammates }: TeamProjectCardProps) {
  const work = projectWorkload(project);
  const milestone = currentMilestone(project);

  return (
    <article className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <p className="text-[12px] text-[var(--admin-muted)]">{clientName}</p>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-heading text-base font-semibold text-[var(--admin-ink)]">{project.name}</h2>
        <ProjectStatusBadge status={project.status} />
      </div>
      <div className="mt-4">
        <ProgressBar value={work.progress} label="Complete" />
      </div>
      <p className="mt-3 text-sm text-[var(--admin-ink)]">
        {milestone ? `Current: ${displayMilestoneName(milestone.name)}` : "No milestone yet"}
      </p>
      <p className="mt-1 text-sm text-[var(--admin-ink)]">
        {assignedTaskCount} assigned to you · {work.completed}/{work.total} tasks complete
      </p>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Due {formatProjectDay(project.targetLaunchDate)}</p>
      {teammates ? <p className="mt-3 text-[12px] text-[var(--admin-muted)]">{teammates}</p> : null}
      <Link
        to={teamProjectHref(project.id)}
        className="mt-4 inline-flex font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
      >
        Open project →
      </Link>
    </article>
  );
}
