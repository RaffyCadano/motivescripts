import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/Button";
import { SitePreview } from "@/components/SitePreview";
import { getProject } from "@/data/projects";
import { usePageMeta } from "@/lib/usePageMeta";

export function CaseStudyPage() {
  const { slug } = useParams();
  const project = slug ? getProject(slug) : undefined;

  usePageMeta(
    project ? `${project.name} — MotiveScripts` : "Project not found — MotiveScripts",
    project ? project.summary : "That case study does not exist.",
  );

  if (!project) {
    return (
      <main id="main" className="container-site py-24">
        <h1 className="text-3xl">Project not found</h1>
        <p className="mt-4 text-muted">That case study does not exist.</p>
        <Link className="mt-6 inline-block text-cyan" to="/work">
          Back to work
        </Link>
      </main>
    );
  }

  return (
    <main id="main">
      <header className="border-b border-[var(--color-line)] py-16 md:py-20">
        <div className="container-wide">
          <p className="text-sm text-faint">
            <Link to="/work" className="hover:text-ink">
              Work
            </Link>
            <span aria-hidden="true"> / </span>
            {project.name}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--color-line)] px-2.5 py-1 font-heading text-xs font-semibold uppercase tracking-[0.14em] text-cyan">
              Concept project
            </span>
            <span className="text-sm text-muted">{project.industry}</span>
          </div>
          <h1 className="mt-4 max-w-[18ch] text-[2.15rem] md:text-[3.25rem]">{project.name}</h1>
          <p className="mt-3 text-muted-strong">{project.services}</p>
          <p className="mt-5 max-w-2xl text-lg text-muted">{project.summary}</p>
        </div>
      </header>

      <div className="container-wide py-12 md:py-16">
        <SitePreview project={project} />

        <div className="mt-16 grid gap-12 lg:grid-cols-3 lg:items-start lg:gap-x-24">
          <section>
            <h2 className="text-xl">The brief</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{project.challenge}</p>
          </section>
          <section className="lg:col-span-2 lg:row-span-2">
            <h2 className="text-xl">How we would approach it</h2>
            <ol className="mt-4 space-y-3">
              {project.approach.map((item, index) => (
                <li key={item} className="flex gap-3 text-sm text-muted">
                  <span className="font-heading font-bold text-cyan">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
            <p className="mt-8 max-w-2xl text-sm text-muted">{project.outcome}</p>
          </section>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button to="/start-a-project" size="lg">
              Start a Project
            </Button>
            <Button to="/work" variant="secondary" size="lg">
              All work
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
