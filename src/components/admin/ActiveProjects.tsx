import { Link } from "react-router-dom";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { calculateProjectProgress, currentMilestone, formatProjectDay } from "@/data/agencyProjects";
import { displayMilestoneName } from "@/data/projectMilestones";

export function ActiveProjects() {
  const { projects, clients } = useLeads();
  const rows = projects.filter((item) => !item.archived && item.status !== "Completed").slice(0, 4);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Active Projects</h2>
        <Link className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline" to="/admin/projects">
          View all
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-[var(--admin-muted)]">No active projects yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--admin-line)]">
          {rows.map((project) => {
            const client = clients.find((item) => item.id === project.clientId);
            const milestone = currentMilestone(project);
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
                    <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{client?.businessName ?? "Unknown client"}</p>
                    <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                      {milestone ? displayMilestoneName(milestone.name) : "No milestone"} · Target launch — {formatProjectDay(project.targetLaunchDate)}
                    </p>
                  </div>
                  <ProjectStatusBadge status={project.status} />
                </div>
                <div className="mt-3 max-w-md">
                  <ProgressBar value={calculateProjectProgress(project)} label="Progress" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
