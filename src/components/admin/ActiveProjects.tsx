import { Link } from "react-router-dom";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { adminProjects } from "@/data/adminMockData";

export function ActiveProjects() {
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

      <ul className="divide-y divide-[var(--admin-line)]">
        {adminProjects.map((project) => (
          <li key={project.id} className="px-5 py-4 transition-colors hover:bg-[var(--admin-bg)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{project.name}</p>
                <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Client: {project.client}</p>
              </div>
              <div className="flex items-center gap-3 sm:shrink-0">
                <StatusBadge status={project.stage} />
                <span className="text-[12px] text-[var(--admin-muted)]">Due {project.deadline}</span>
              </div>
            </div>
            <div className="mt-3 max-w-md">
              <ProgressBar value={project.progress} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
