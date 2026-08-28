import { Link } from "react-router-dom";
import { SitePreview } from "@/components/SitePreview";
import type { Project } from "@/data/projects";
import { cn } from "@/lib/cn";

type ProjectCardProps = {
  project: Project;
  featured?: boolean;
  reverse?: boolean;
};

export function ProjectCard({ project, featured = false, reverse = false }: ProjectCardProps) {
  const split = featured || reverse;

  return (
    <article className={cn("group", split && "lg:grid lg:grid-cols-2 lg:items-center lg:gap-12")}>
      <Link
        to={`/work/${project.slug}`}
        className={cn("block", reverse && "lg:order-2")}
        aria-label={`View ${project.name} case study`}
      >
        <div className="origin-center transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.015]">
          <SitePreview project={project} />
        </div>
      </Link>

      <div className={cn("mt-6", split && "lg:mt-0", reverse && "lg:order-1")}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-heading font-semibold uppercase tracking-[0.14em]">
          <span className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-cyan">
            Concept project
          </span>
          <span className="text-faint">{project.industry}</span>
        </div>
        <h3 className={cn("mt-3 font-bold", split ? "text-2xl md:text-3xl" : "text-xl md:text-2xl")}>
          {project.name}
        </h3>
        <p className="mt-1 text-sm text-muted-strong">{project.services}</p>
        <p className={cn("mt-3 max-w-lg text-muted", split ? "text-base" : "text-sm")}>{project.summary}</p>
        <Link
          to={`/work/${project.slug}`}
          className="mt-5 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink transition-colors hover:text-blue"
        >
          View Case Study
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
