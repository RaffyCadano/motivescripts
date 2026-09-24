import { PageHero } from "@/components/PageHero";
import { ProjectCard } from "@/components/ProjectCard";
import { AnimateIn } from "@/components/AnimateIn";
import { CTA } from "@/components/CTA";
import { projects } from "@/data/projects";
import { usePageMeta } from "@/lib/usePageMeta";
import { seoPage } from "@/data/seoPages";

export function WorkPage() {
  const meta = seoPage("/work");
  usePageMeta(meta.title, meta.description, meta.path);


  const [featured, ...rest] = projects;

  return (
    <main id="main">
      <PageHero
        centered
        plainEyebrow
        eyebrow="Work"
        title="Websites designed to make small businesses stand out."
        description="Explore a selection of website concepts built around clear messaging, modern design, and conversion-focused user experiences."
      />

      <div className="container-wide py-16 md:py-24">
        <AnimateIn>
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-heading text-base font-semibold text-ink md:text-lg">
              Real client work and selected concepts for local businesses and growing companies.
            </p>
            <div className="mt-6 grid divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="flex flex-col items-center gap-2.5 px-5 py-5">
                <span className="rounded-full border border-[var(--color-line)] px-2.5 py-1 font-heading text-xs font-semibold uppercase tracking-[0.14em] text-cyan">
                  Client project
                </span>
                <p className="text-sm leading-relaxed text-muted">Real client work, with the live site to visit.</p>
              </div>
              <div className="flex flex-col items-center gap-2.5 px-5 py-5">
                <span className="rounded-full border border-[var(--color-line)] px-2.5 py-1 font-heading text-xs font-semibold uppercase tracking-[0.14em] text-cyan">
                  Concept project
                </span>
                <p className="text-sm leading-relaxed text-muted">
                  A design concept created to demonstrate how MotiveScripts approaches strategy, design, and
                  development.
                </p>
              </div>
            </div>
          </div>
        </AnimateIn>

        <div className="mt-16 space-y-14 md:mt-20 md:space-y-24">
          <AnimateIn>
            <ProjectCard project={featured} large ctaLabel="View Project" />
          </AnimateIn>
          {rest.map((project, index) => (
            <AnimateIn key={project.slug} delay={index * 40}>
              <ProjectCard project={project} featured reverse={index % 2 === 0} ctaLabel="View Project" />
            </AnimateIn>
          ))}
        </div>
      </div>

      <CTA
        title="Have a business that needs a better website?"
        description="Let's build a website that helps your business get noticed, trusted, and chosen."
      />
    </main>
  );
}
