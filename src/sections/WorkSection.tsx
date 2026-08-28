import { AnimateIn } from "@/components/AnimateIn";
import { Button } from "@/components/Button";
import { ProjectCard } from "@/components/ProjectCard";
import { SectionHeader } from "@/components/SectionHeader";
import { projects } from "@/data/projects";

export function WorkSection() {
  const [featured, ...rest] = projects;

  return (
    <section id="work" className="border-t border-[var(--color-line)] py-20 md:py-28">
      <div className="container-wide">
        <AnimateIn>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
            <div>
              <SectionHeader eyebrow="Selected work" title="Built for real businesses." />
              <p className="mt-4 max-w-xl text-sm text-faint">
                Concept projects that show how we approach websites for local service businesses. They
                are labeled as concepts — not client work.
              </p>
            </div>
            <Button to="/work" variant="secondary" className="shrink-0 sm:mt-11">
              View Our Work
            </Button>
          </div>
        </AnimateIn>

        <div className="mt-12 space-y-16">
          <AnimateIn>
            <ProjectCard project={featured} featured />
          </AnimateIn>
          {rest.slice(0, 2).map((project, index) => (
            <AnimateIn key={project.slug} delay={index * 80}>
              <ProjectCard project={project} featured reverse={index % 2 === 0} />
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
