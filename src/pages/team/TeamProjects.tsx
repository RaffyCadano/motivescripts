import { Link } from "react-router-dom";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { useTeamWork } from "@/components/team/useTeamWork";
import { formatProjectDay } from "@/data/agencyProjects";
import { projectWorkload } from "@/data/teamWorkspace";

export function TeamProjects() {
  const { clientsById, myProjects, assignmentError } = useTeamWork();
  const { data } = useTeamDirectory();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">My Projects</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Projects you’re assigned to.</p>
      </div>

      {assignmentError ? <p className="text-sm text-[#b45309]">{assignmentError}</p> : null}

      {myProjects.length === 0 ? (
        <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No projects yet</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">You haven’t been assigned to any projects.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {myProjects.map((project) => {
            const work = projectWorkload(project);
            const teammates =
              data?.members.filter((member) =>
                member.projectAssignments.some((item) => item.entityId === project.id),
              ) ?? [];
            return (
              <article
                key={project.id}
                className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5"
              >
                <p className="text-[12px] text-[var(--admin-muted)]">
                  {clientsById.get(project.clientId)?.businessName ?? "Client"}
                </p>
                <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-heading text-base font-semibold text-[var(--admin-ink)]">{project.name}</h2>
                  <ProjectStatusBadge status={project.status} />
                </div>
                <div className="mt-4">
                  <ProgressBar value={work.progress} label="Complete" />
                </div>
                <p className="mt-3 text-sm text-[var(--admin-ink)]">
                  {work.total} tasks · {work.completed} completed · {work.remaining} remaining
                </p>
                <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Due {formatProjectDay(project.targetLaunchDate)}</p>
                {teammates.length > 0 ? (
                  <p className="mt-3 text-[12px] text-[var(--admin-muted)]">
                    {teammates.map((member) => member.fullName || member.email).join(", ")}
                  </p>
                ) : null}
                <Link
                  to={`/admin/projects/${project.id}`}
                  className="mt-4 inline-flex font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                >
                  View Project →
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
