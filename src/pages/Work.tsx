import { PageHero } from "@/components/PageHero";
import { ProjectCard } from "@/components/ProjectCard";
import { AnimateIn } from "@/components/AnimateIn";
import { CTA } from "@/components/CTA";
import { projects } from "@/data/projects";
import { usePageMeta } from "@/lib/usePageMeta";

export function WorkPage() {
  usePageMeta(
    "Work — MotiveScripts",
    "Selected website concepts for small businesses, showing how MotiveScripts structures websites for local service companies.",
    "/work",
  );

  const [featured, ...rest] = projects;

  return (
    <main id="main">
      <PageHero
        eyebrow="Work"
        title="Websites designed to make small businesses stand out."
        description="Explore a selection of website concepts built around clear messaging, modern design, and conversion-focused user experiences."
      />

      <div className="container-wide py-16 md:py-24">
        <AnimateIn>
          <div className="max-w-2xl">
            <p className="font-heading text-sm font-semibold text-ink">
              Selected concepts for local businesses and growing companies.
            </p>
            <p className="mt-2 text-sm text-faint">
              These projects are design concepts created to demonstrate how MotiveScripts approaches
              strategy, design, and development across different industries.
            </p>
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
