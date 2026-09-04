import { Link } from "react-router-dom";
import type { AgencyProject } from "@/data/agencyProjects";
import { cn } from "@/lib/cn";

type ClientProjectSwitcherProps = {
  projects: AgencyProject[];
  activeId: string | null;
};

export function ClientProjectSwitcher({ projects, activeId }: ClientProjectSwitcherProps) {
  if (projects.length < 2) return null;

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Your projects">
      {projects.map((project) => {
        const active = project.id === activeId;
        return (
          <Link
            key={project.id}
            to={`/client/project/${project.id}`}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-heading text-[13px] font-semibold transition-colors",
              active
                ? "border-[var(--client-navy)] bg-[var(--client-navy)] text-white"
                : "border-[var(--client-line)] bg-[var(--client-card)] text-[var(--client-ink)] hover:bg-[var(--client-bg)]",
            )}
          >
            {project.name}
            {project.archived ? (
              <span className={cn("text-[11px] font-medium", active ? "text-white/70" : "text-[var(--client-muted)]")}>
                Archived
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
