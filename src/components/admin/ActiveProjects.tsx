import { Link } from "react-router-dom";
import { Eye, PencilLine } from "lucide-react";
import { AdminActionsMenu } from "@/components/admin/AdminActionsMenu";
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-[var(--admin-line)] bg-[var(--admin-bg)] text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)]">
              <tr>
                <th className="px-5 py-2.5 font-heading">Project</th>
                <th className="px-3 py-2.5 font-heading">Milestone</th>
                <th className="px-3 py-2.5 font-heading">Target launch</th>
                <th className="px-3 py-2.5 font-heading">Status</th>
                <th className="px-3 py-2.5 font-heading">Progress</th>
                <th className="px-3 py-2.5 font-heading">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-line)]">
              {rows.map((project) => {
                const client = clients.find((item) => item.id === project.clientId);
                const milestone = currentMilestone(project);
                return (
                  <tr key={project.id} className="transition-colors hover:bg-[var(--admin-bg)]">
                    <td className="px-5 py-3 align-middle">
                      <Link
                        className="font-heading font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                        to={`/admin/projects/${project.id}`}
                      >
                        {project.name}
                      </Link>
                      <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{client?.businessName ?? "Unknown client"}</p>
                    </td>
                    <td className="px-3 py-3 align-middle text-[var(--admin-muted)]">
                      {milestone ? displayMilestoneName(milestone.name) : "No milestone"}
                    </td>
                    <td className="px-3 py-3 align-middle text-[var(--admin-muted)]">{formatProjectDay(project.targetLaunchDate)}</td>
                    <td className="px-3 py-3 align-middle">
                      <ProjectStatusBadge status={project.status} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="max-w-[9rem]">
                        <ProgressBar value={calculateProjectProgress(project)} label="Progress" />
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <AdminActionsMenu
                        ariaLabel={`Actions for ${project.name}`}
                        iconOnly
                        items={[
                          { id: "view", label: "View project", icon: Eye, href: `/admin/projects/${project.id}` },
                          {
                            id: "edit",
                            label: "Edit",
                            icon: PencilLine,
                            href: `/admin/projects/${project.id}/edit`,
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
