import { AnimateIn } from "@/components/AnimateIn";
import { ProcessStep } from "@/components/ProcessStep";
import { SectionHeader } from "@/components/SectionHeader";
import { processSteps } from "@/data/process";

export function ProcessSection() {
  return (
    <section id="process" className="border-t border-[var(--color-line)] py-20 md:py-28">
      <div className="container-wide">
        <AnimateIn>
          <SectionHeader eyebrow="Our process" title="A clear process from idea to launch." />
        </AnimateIn>

        <ol className="mt-10 grid gap-4 sm:mt-14 sm:gap-5 md:grid-cols-2 md:gap-8 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-14">
          {processSteps.map((step, index) => (
            <li key={step.number} className="min-w-0">
              <AnimateIn className="flex h-full min-w-0 w-full" delay={index * 60}>
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
