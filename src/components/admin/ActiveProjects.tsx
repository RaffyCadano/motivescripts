import { Link } from "react-router-dom";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { formatLeadDate } from "@/data/leads";
import type { AgencyProject } from "@/data/agencyProjects";

function projectProgress(project: AgencyProject): number {
  if (project.milestones.length === 0) return 0;
  const done = project.milestones.filter((item) => item.status === "Completed").length;
  return Math.round((done / project.milestones.length) * 100);
}

export function ActiveProjects() {
  const { projects, clients } = useLeads();
  const rows = projects
    .filter((item) => !item.archived && item.status !== "Completed")
    .slice(0, 4);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Active Projects</h2>
        <Link
          className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline"
          to="/admin/projects"
        >
          View all
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-[var(--admin-muted)]">No active projects yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--admin-line)]">
          {rows.map((project) => {
            const client = clients.find((item) => item.id === project.clientId);
            return (
              <li key={project.id} className="px-5 py-4 transition-colors hover:bg-[var(--admin-bg)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                      to={`/admin/projects/${project.id}`}
                    >
                      {project.name}
                    </Link>
                    <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                      Client: {client?.businessName ?? "Unknown"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:shrink-0">
                    <ProjectStatusBadge status={project.status} />
                    <span className="text-[12px] text-[var(--admin-muted)]">
                      {project.targetLaunchDate ? `Due ${formatLeadDate(project.targetLaunchDate)}` : "No due date"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 max-w-md">
                  <ProgressBar value={projectProgress(project)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
