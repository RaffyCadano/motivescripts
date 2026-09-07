import { Link } from "react-router-dom";
import { AnimateIn } from "@/components/AnimateIn";
import { ProcessStep } from "@/components/ProcessStep";
import { SectionHeader } from "@/components/SectionHeader";

/** Condensed four-stage summary for the homepage. The full six-step breakdown lives on /process. */
const homeProcessSteps = [
  {
    number: "01",
    title: "Discover",
    body: "We learn about your business, customers, goals, and requirements.",
  },
  {
    number: "02",
    title: "Design",
    body: "We create the structure and visual direction for your website.",
  },
  {
    number: "03",
    title: "Build",
    body: "We develop the website and make sure everything works across devices.",
  },
  {
    number: "04",
    title: "Launch",
    body: "We test, finalize, connect the domain, and launch your website.",
  },
] as const;

export function ProcessSection() {
  return (
    <section id="process" className="border-t border-[var(--color-line)] py-20 md:py-28">
      <div className="container-wide">
        <AnimateIn>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
            <SectionHeader eyebrow="How it works" title="A clear process from idea to launch." />
            <Link
              to="/process"
              className="mt-1 inline-flex shrink-0 items-center gap-2 font-heading text-sm font-semibold text-ink transition-colors hover:text-blue sm:mt-11"
            >
              See the full process
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </AnimateIn>

        <ol className="mt-10 grid gap-4 sm:mt-14 sm:gap-5 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {homeProcessSteps.map((step, index) => (
            <li key={step.number} className="min-w-0">
              <AnimateIn className="flex h-full min-w-0 w-full" delay={index * 70}>
                <div className="flex h-full w-full min-w-0 flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] p-5 transition-colors duration-[var(--duration-base)] hover:border-[rgb(0_200_255_/_0.25)] md:p-6">
                  <ProcessStep
                    className="flex-1"
                    number={step.number}
                    title={step.title}
                    body={step.body}
                  />
                </div>
              </AnimateIn>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
