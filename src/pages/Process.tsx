import { CTA } from "@/components/CTA";
import { AnimateIn } from "@/components/AnimateIn";
import { PageHero } from "@/components/PageHero";
import { processSteps } from "@/data/process";

export function ProcessPage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Process"
        title="A clear process from idea to launch."
        description="You always know what stage the project is in. We move from discovery to launch in six steps, with review built in before the site goes live."
      />

      <ol className="container-wide divide-y divide-[var(--color-line)] py-8 md:py-16">
        {processSteps.map((step) => (
          <li key={step.number}>
            <AnimateIn>
              <div className="grid gap-6 py-12 md:grid-cols-[7rem_1fr] md:gap-12 lg:grid-cols-[8rem_1fr_18rem] lg:gap-16">
            <p className="font-heading text-4xl font-extrabold text-blue">{step.number}</p>
            <div className="max-w-2xl">
              <h2 className="text-2xl md:text-3xl">{step.title}</h2>
              <p className="mt-3 text-[var(--text-md)] text-muted-strong">{step.body}</p>
              <p className="mt-4 text-muted">{step.detail}</p>
            </div>
            <div>
              <h3 className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">
                What this includes
              </h3>
              <ul className="mt-4 space-y-3">
                {step.includes.map((item) => (
                  <li key={item} className="text-sm text-ink">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
              </div>
            </AnimateIn>
          </li>
        ))}
      </ol>

      <CTA />
    </main>
  );
}
