import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { adminFilterControlState } from "@/components/admin/list/adminListStyles";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { TeamProjectCard } from "@/components/team/TeamProjectCard";
import { useTeamWork } from "@/components/team/useTeamWork";
import { currentMilestone, formatProjectDay, projectStatuses, type AgencyProject, type AgencyProjectStatus } from "@/data/agencyProjects";
import { displayMilestoneName } from "@/data/projectMilestones";
import { myOpenTaskCount, projectWorkload, teamProjectHref } from "@/data/teamWorkspace";

export function TeamProjects() {
  const { profile, clientsById, myProjects, assignmentError } = useTeamWork();
  const { data } = useTeamDirectory();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AgencyProjectStatus | "All">("All");

  function teammatesFor(project: AgencyProject): string {
    return (
      data?.members
        .filter((member) => member.projectAssignments.some((item) => item.entityId === project.id))
        .map((member) => member.fullName || member.email)
        .join(", ") ?? ""
    );
  }

  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return myProjects.filter((project) => {
      if (status !== "All" && project.status !== status) return false;
      if (!needle) return true;
      const clientName = clientsById.get(project.clientId)?.businessName ?? "";
      return `${project.name} ${clientName}`.toLowerCase().includes(needle);
    });
  }, [myProjects, query, status, clientsById]);

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
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search projects</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search project or client"
                className={adminFilterControlState(Boolean(query.trim()))}
              />
            </label>
            <label className="sm:w-56">
              <span className="sr-only">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as AgencyProjectStatus | "All")}
                className={adminFilterControlState(status !== "All")}
              >
                <option value="All">All statuses</option>
                {projectStatuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10">
              <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No matching projects</p>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">Try a different project, client, or status.</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] md:block">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Progress</th>
                      <th className="px-4 py-3">Milestone</th>
                      <th className="px-4 py-3">Assigned to you</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((project) => {
                      const work = projectWorkload(project);
                      const milestone = currentMilestone(project);
                      return (
                        <tr key={project.id} className="border-t border-[var(--admin-line)]">
                          <td className="px-4 py-3">
                            <Link
                              to={teamProjectHref(project.id)}
                              className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                            >
                              {project.name}
                            </Link>
                            <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                              {clientsById.get(project.clientId)?.businessName ?? "Client"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <ProjectStatusBadge status={project.status} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="w-32">
                              <ProgressBar value={work.progress} />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--admin-muted)]">
                            {milestone ? displayMilestoneName(milestone.name) : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--admin-ink)]">
                            {myOpenTaskCount(project, profile?.id ?? "", profile?.fullName ?? "")}
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--admin-muted)]">
                            {formatProjectDay(project.targetLaunchDate)}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              to={teamProjectHref(project.id)}
                              className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                            >
                              Open project
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 md:hidden">
                {filteredProjects.map((project) => (
                  <TeamProjectCard
                    key={project.id}
                    project={project}
                    clientName={clientsById.get(project.clientId)?.businessName ?? "Client"}
                    assignedTaskCount={myOpenTaskCount(project, profile?.id ?? "", profile?.fullName ?? "")}
                    teammates={teammatesFor(project)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
