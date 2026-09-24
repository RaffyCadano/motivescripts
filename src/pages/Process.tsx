import { Link } from "react-router-dom";
import { CTA } from "@/components/CTA";
import { AnimateIn } from "@/components/AnimateIn";
import { PageHero } from "@/components/PageHero";
import { processSteps } from "@/data/process";
import { usePageMeta } from "@/lib/usePageMeta";
import { seoPage } from "@/data/seoPages";

const expectations = [
  "Clear communication throughout the project",
  "A defined project scope from the start",
  "Scheduled review points before launch",
  "A responsive, mobile-first website",
  "A site that's tested before it goes live",
];

export function ProcessPage() {
  const meta = seoPage("/process");
  usePageMeta(meta.title, meta.description, meta.path);

  return (
    <main id="main">
      <PageHero
        centered
        plainEyebrow
        eyebrow="Process"
        title="From first conversation to launch."
        description="A clear, collaborative process that takes your website from an initial idea to a finished site ready for your customers."
      >
        <Link
          viewTransition
          to="/services"
          className="mt-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink transition-colors hover:text-blue"
        >
          Not sure what you need yet? View Services
          <span aria-hidden="true" className="icon-arrow">→</span>
        </Link>
      </PageHero>

      <div className="container-wide py-10 md:py-14">
        <AnimateIn>
          <ol className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-6">
            {processSteps.map((step) => (
              <li
                key={step.number}
                className="group relative text-center lg:after:absolute lg:after:left-1/2 lg:after:top-6 lg:after:h-px lg:after:w-[calc(100%+1.5rem)] lg:after:bg-[var(--color-line)] lg:last:after:hidden"
              >
                <span className="relative z-10 mx-auto flex size-12 items-center justify-center rounded-full border border-[var(--color-line)] bg-white font-heading text-sm font-bold tracking-[0.06em] text-blue shadow-[var(--shadow-card)] transition-colors duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:border-[rgb(0_80_240_/_0.4)] group-hover:bg-[rgb(0_80_240_/_0.04)]">
                  {step.number}
                </span>
                <p className="mt-4 font-heading text-lg font-semibold text-ink">{step.title}</p>
                <p className="mx-auto mt-2 max-w-[16rem] text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </AnimateIn>
      </div>

      <ol className="container-wide divide-y divide-[var(--color-line)] py-8 md:py-16">
        {processSteps.map((step) => (
          <li key={step.number}>
            <AnimateIn className="process-line-segment">
              <div className="grid gap-6 py-12 md:grid-cols-[7rem_1fr] md:gap-12 md:pl-8 lg:grid-cols-[8rem_1fr_18rem] lg:gap-16">
            <p className="font-heading text-4xl font-extrabold text-blue">{step.number}</p>
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl md:text-3xl">{step.title}</h2>
                {step.checkpoint ? (
                  <span className="rounded-full border border-[var(--color-line)] px-2.5 py-1 font-heading text-xs font-semibold uppercase tracking-[0.1em] text-cyan">
                    {step.checkpoint}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-[var(--text-md)] text-muted-strong">{step.body}</p>
              <p className="mt-4 text-muted">{step.detail}</p>
              {step.next ? (
                <p className="mt-4 font-heading text-sm font-semibold text-ink">{step.next}</p>
              ) : null}
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">
                  MotiveScripts handles
                </h3>
                <ul className="mt-4 space-y-3">
                  {step.includes.map((item) => (
                    <li key={item} className="text-sm text-ink">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              {step.yourPart.length > 0 ? (
                <div>
                  <h3 className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">
                    Your part
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {step.yourPart.map((item) => (
                      <li key={item} className="text-sm text-ink">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
              </div>
            </AnimateIn>
          </li>
        ))}
      </ol>

      <div className="border-t border-[var(--color-line)]">
        <div className="container-wide py-16 md:py-24">
          <AnimateIn>
            <section className="max-w-3xl">
              <h2 className="text-2xl md:text-3xl">What you can expect from MotiveScripts.</h2>
              <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {expectations.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-3 text-sm font-medium text-ink"
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-cyan" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </AnimateIn>
        </div>
      </div>

      <CTA
        title="Ready to get started?"
        description="Tell us about your business and what you're looking to build. We'll take it from there."
      />
    </main>
  );
}
