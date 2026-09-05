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
  );
  return (
    <main id="main">
      <PageHero
        eyebrow="Work"
        title="Selected website concepts for small businesses."
        description="These are demonstration projects. They show how we structure websites for local service companies — and they are clearly labeled as concepts."
      />
      <div className="container-wide space-y-20 py-16 md:py-24">
        {projects.map((project, index) => (
          <AnimateIn key={project.slug}>
            <ProjectCard
              project={project}
              featured
              reverse={index % 2 === 1}
            />
          </AnimateIn>
        ))}
      </div>
      <CTA />
    </main>
  );
}
