import { Link } from "react-router-dom";
import { ArrowDown, Check } from "lucide-react";
import { CTA } from "@/components/CTA";
import { AnimateIn } from "@/components/AnimateIn";
import { PageHero } from "@/components/PageHero";
import { StepList } from "@/components/StepList";
import { processSteps } from "@/data/process";
import { cn } from "@/lib/cn";
import { usePageMeta } from "@/lib/usePageMeta";
import { seoPage } from "@/data/seoPages";

const expectations = [
  "Clear communication throughout the project",
  "A defined project scope from the start",
  "Scheduled review points before launch",
  "A responsive, mobile-first website",
  "A site that's tested before it goes live",
];

/** A labelled checklist: what we do in a step, or what we need from the client. */
function ChecklistPanel({ title, items, tone = "us" }: { title: string; items: readonly string[]; tone?: "us" | "you" }) {
  return (
    <div className={cn("p-6 md:px-8 md:py-6", tone === "us" ? "bg-[var(--ms-bg-card)]" : "bg-[rgb(0_80_240_/_0.04)]")}>
      <h3
        className={cn(
          "font-heading text-xs font-bold uppercase tracking-[0.16em]",
          tone === "us" ? "text-faint" : "text-blue",
        )}
      >
        {title}
      </h3>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm text-ink">
            <span
              className={cn(
                "mt-px flex size-5 shrink-0 items-center justify-center rounded-full",
                tone === "us" ? "bg-[rgb(0_80_240_/_0.1)] text-blue" : "bg-blue text-white",
              )}
              aria-hidden="true"
            >
              <Check size={12} strokeWidth={3} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

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
          <StepList steps={processSteps} columns={6} />
        </AnimateIn>
      </div>

      <ol className="container-wide pb-12 pt-6 md:pb-20 md:pt-10">
        {processSteps.map((step, index) => {
          const isLast = index === processSteps.length - 1;
          return (
            <li key={step.number} className="relative pb-8 pl-14 md:pb-10 md:pl-24 [&:last-child]:pb-0">
              {isLast ? null : (
                <span
                  aria-hidden="true"
                  className="absolute bottom-2 left-[1.1875rem] top-[3.25rem] w-0.5 rounded-full bg-[var(--color-line-strong)] md:left-[1.9375rem] md:top-[5rem]"
                />
              )}
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 flex size-10 items-center justify-center rounded-full bg-blue font-heading text-sm font-bold text-white shadow-[var(--shadow-button)] md:size-16 md:text-xl"
              >
                {step.number}
              </span>

              <AnimateIn>
                <article className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--ms-white)] shadow-[var(--shadow-card)]">
                  <div className="p-6 md:p-8">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <h2 className="text-2xl md:text-3xl">{step.title}</h2>
                      {step.checkpoint ? (
                        <span className="rounded-full border border-[var(--color-line)] bg-[var(--ms-bg-card)] px-2.5 py-1 font-heading text-xs font-semibold uppercase tracking-[0.1em] text-cyan">
                          {step.checkpoint}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 max-w-2xl text-[var(--text-md)] font-medium text-ink">{step.body}</p>
                    <p className="mt-3 max-w-2xl text-muted">{step.detail}</p>
                  </div>

                  <div
                    className={cn(
                      "grid border-t border-[var(--color-line)]",
                      step.yourPart.length > 0 && "md:grid-cols-2 md:divide-x md:divide-[var(--color-line)]",
                    )}
                  >
                    <ChecklistPanel title="MotiveScripts handles" items={step.includes} />
                    {step.yourPart.length > 0 ? (
                      <ChecklistPanel title="Your part" items={step.yourPart} tone="you" />
                    ) : null}
                  </div>

                  {step.next ? (
                    <p className="flex items-center gap-2.5 border-t border-[var(--color-line)] px-6 py-4 font-heading text-sm font-semibold text-ink md:px-8">
                      <ArrowDown size={16} strokeWidth={2.4} className="shrink-0 text-blue" aria-hidden="true" />
                      {step.next}
                    </p>
                  ) : null}
                </article>
              </AnimateIn>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-[var(--color-line)]">
        <div className="container-wide py-16 md:py-24">
          <AnimateIn>
            <section className="mx-auto max-w-3xl text-center">
              <h2 className="text-2xl md:text-3xl">What you can expect from MotiveScripts.</h2>
              <ul className="mt-8 flex flex-wrap justify-center gap-3">
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
