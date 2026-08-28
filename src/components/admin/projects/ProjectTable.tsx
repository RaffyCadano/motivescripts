import { Link } from "react-router-dom";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import type { AgencyClient } from "@/data/agencyClients";
import {
  calculateProjectProgress,
  currentMilestone,
  formatProjectDate,
  formatProjectDay,
  formatProjectDayShort,
  type AgencyProject,
} from "@/data/agencyProjects";

type ProjectTableProps = {
  projects: AgencyProject[];
  clientsById: Map<string, AgencyClient>;
};

export function ProjectTable({ projects, clientsById }: ProjectTableProps) {
  if (projects.length === 0) return null;

  return (
    <>
      <div className="hidden overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] md:block">
        <table className="w-full min-w-[60rem] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <th className="px-5 py-3 font-semibold">Project</th>
              <th className="px-5 py-3 font-semibold">Client</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Progress</th>
              <th className="px-5 py-3 font-semibold">Milestone</th>
              <th className="px-5 py-3 font-semibold">Target Launch</th>
              <th className="px-5 py-3 font-semibold">Last Activity</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const client = clientsById.get(project.clientId);
              const milestone = currentMilestone(project);
              return (
                <tr key={project.id} className="border-b border-[var(--admin-line)] last:border-b-0 hover:bg-[var(--admin-bg)]">
                  <td className="px-5 py-3.5 font-medium text-[var(--admin-ink)]">{project.name}</td>
                  <td className="px-5 py-3.5">{client?.businessName ?? "Unknown client"}</td>
                  <td className="px-5 py-3.5">
                    <ProjectStatusBadge status={project.status} />
                  </td>
                  <td className="min-w-[8.5rem] px-5 py-3.5">
                    <ProgressBar value={calculateProjectProgress(project)} />
                  </td>
                  <td className="px-5 py-3.5">{milestone?.name ?? "—"}</td>
                  <td className="px-5 py-3.5 text-[var(--admin-muted)]">
                    {formatProjectDayShort(project.targetLaunchDate)}
                  </td>
                  <td className="px-5 py-3.5 text-[var(--admin-muted)]">{formatProjectDate(project.lastActivityAt)}</td>
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/admin/projects/${project.id}`}
                      className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {projects.map((project) => {
          const client = clientsById.get(project.clientId);
          const milestone = currentMilestone(project);
          return (
            <li
              key={project.id}
              className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{project.name}</p>
                  <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{client?.businessName ?? "Unknown client"}</p>
                </div>
                <ProjectStatusBadge status={project.status} />
              </div>
              <div className="mt-3">
                <ProgressBar value={calculateProjectProgress(project)} label="Progress" />
              </div>
              <p className="mt-3 text-[12px] text-[var(--admin-muted)]">
                Current milestone: <span className="text-[var(--admin-ink)]">{milestone?.name ?? "None"}</span>
              </p>
              <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                Target launch: <span className="text-[var(--admin-ink)]">{formatProjectDay(project.targetLaunchDate)}</span>
              </p>
              <Link
                to={`/admin/projects/${project.id}`}
                className="mt-4 inline-flex h-9 items-center rounded-lg bg-[var(--admin-blue)] px-3 font-heading text-[12px] font-semibold text-white"
              >
                View Project
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
