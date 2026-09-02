import { Link } from "react-router-dom";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { formatClientSince } from "@/data/agencyClients";
import { calculateProjectProgress, type AgencyProject } from "@/data/agencyProjects";

export function ClientProjectsTable({ projects }: { projects: AgencyProject[] }) {
  if (projects.length === 0) return null;

  return (
    <>
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[44rem] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <th className="py-3 pr-4 font-semibold">Project</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Progress</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="py-3 pl-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr
                key={project.id}
                className="border-b border-[var(--admin-line)] last:border-b-0 hover:bg-[var(--admin-bg)]"
              >
                <td className="py-3.5 pr-4">
                  <Link
                    to={`/admin/projects/${project.id}`}
                    className="font-heading font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                  >
                    {project.name}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-[var(--admin-ink)]">{project.type}</td>
                <td className="px-4 py-3.5">
                  <ProjectStatusBadge status={project.status} />
                </td>
                <td className="px-4 py-3.5 text-[var(--admin-ink)]">{calculateProjectProgress(project)}%</td>
                <td className="px-4 py-3.5 text-[var(--admin-muted)]">{formatClientSince(project.createdAt)}</td>
                <td className="py-3.5 pl-4 text-right">
                  <Link
                    to={`/admin/projects/${project.id}`}
                    className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 space-y-3 md:hidden">
        {projects.map((project) => (
          <li
            key={project.id}
            className="rounded-xl border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to={`/admin/projects/${project.id}`}
                  className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                >
                  {project.name}
                </Link>
                <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{project.type}</p>
              </div>
              <ProjectStatusBadge status={project.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
              <div>
                <dt className="text-[var(--admin-muted)]">Progress</dt>
                <dd className="mt-0.5 font-medium text-[var(--admin-ink)]">{calculateProjectProgress(project)}%</dd>
              </div>
              <div>
                <dt className="text-[var(--admin-muted)]">Created</dt>
                <dd className="mt-0.5 font-medium text-[var(--admin-ink)]">{formatClientSince(project.createdAt)}</dd>
              </div>
            </dl>
            <Link
              to={`/admin/projects/${project.id}`}
              className="mt-3 inline-flex font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            >
              View →
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
