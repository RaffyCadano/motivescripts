import { Link } from "react-router-dom";
import { AnimateIn } from "@/components/AnimateIn";
import { Button } from "@/components/Button";
import { CTA } from "@/components/CTA";
import { FaqItem } from "@/components/FaqItem";
import { PageHero } from "@/components/PageHero";
import { pricingTiers } from "@/data/pricing";
import { usePageMeta } from "@/lib/usePageMeta";
import { cn } from "@/lib/cn";

const priceFactors = [
  "Number of pages",
  "Design complexity and custom layouts",
  "Custom functionality, like booking or e-commerce",
  "Integrations with other tools",
  "Amount of content to design around",
];

const quoteSteps = [
  "Tell us about your business.",
  "We review your requirements.",
  "We define the project scope.",
  "You receive a quote.",
  "We move into the project process.",
];

const pricingFaqs = [
  {
    question: "Do I need to know exactly what I need before contacting you?",
    answer:
      "No. Discovery exists to turn a general idea into a clear brief — you don't need a finished list of pages or features before reaching out.",
  },
  {
    question: "What happens after I accept the quote?",
    answer: "We move into the project process — strategy, design, development, review, and launch.",
  },
  {
    question: "Can the website be expanded later?",
    answer: "Yes. Sites are structured so it's straightforward to add pages, services, or features as your business grows.",
  },
  {
    question: "Are ongoing services included?",
    answer:
      "Not automatically. Website Care (updates, maintenance, and technical support) is a separate ongoing service you can add if you want it.",
  },
];

export function PricingPage() {
  usePageMeta(
    "Pricing — MotiveScripts",
    "Engagement options for small-business websites, from a focused starter site to a custom build. Every project is scoped and quoted individually.",
    "/pricing",
  );
  return (
    <main id="main">
      <PageHero
        eyebrow="Pricing"
        title="Simple pricing for websites built around your business."
        description="Every project is scoped around what your business actually needs, so you get a clear quote before development begins."
      />

      <div className="container-wide py-16 md:py-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pricingTiers.map((tier, index) => (
            <AnimateIn key={tier.id} className="flex h-full" delay={index * 80}>
              <article
                className={cn(
                  "relative flex h-full w-full flex-col rounded-[var(--radius-lg)] border p-7 md:p-8",
                  tier.highlighted
                    ? "border-[rgb(0_80_240_/_0.35)] bg-[rgb(0_80_240_/_0.03)] shadow-[var(--shadow-card)]"
                    : "border-[var(--color-line)]",
                )}
              >
                {tier.highlighted ? (
                  <span className="absolute -top-3 left-7 rounded-full bg-[linear-gradient(135deg,#0050F0,#00A0FF)] px-3 py-1 font-heading text-[11px] font-bold uppercase tracking-[0.1em] text-white">
                    Most popular
                  </span>
                ) : null}
                <h2 className="text-2xl font-bold">{tier.name}</h2>
                <p className="mt-3 text-muted">{tier.tagline}</p>
                <p className="mt-6 font-heading text-xl font-semibold text-ink">{tier.price}</p>
                <p className="mt-1 text-xs text-faint">Pricing based on your project's scope and requirements.</p>
                <ul className="mt-6 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted-strong">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-cyan" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button to="/start-a-project" className="mt-8" variant={tier.highlighted ? "primary" : "secondary"}>
                  Start a Project
                </Button>
              </article>
            </AnimateIn>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-faint">
          Not sure which fits? Tell us about your business when you start a project and we'll recommend the right
          scope.
        </p>
      </div>

      <div className="border-t border-[var(--color-line)]">
        <div className="container-wide grid gap-16 py-16 md:py-24 lg:grid-cols-2 lg:gap-20">
          <AnimateIn>
            <section>
              <h2 className="text-2xl md:text-3xl">What determines the price?</h2>
              <p className="mt-4 text-muted">
                Every business is different, so no two websites cost exactly the same. A few things shape the
                scope and price of a project:
              </p>
              <ul className="mt-6 space-y-3">
                {priceFactors.map((factor) => (
                  <li key={factor} className="flex items-start gap-2.5 text-sm text-ink">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan" aria-hidden="true" />
                    {factor}
                  </li>
                ))}
              </ul>
            </section>
          </AnimateIn>

          <AnimateIn delay={80}>
            <section>
              <h2 className="text-2xl md:text-3xl">Your project gets a clear scope and quote.</h2>
              <p className="mt-4 text-muted">
                Before development begins, we define what your website needs and provide a project quote based on
                that scope.
              </p>
              <ol className="mt-6 space-y-3">
                {quoteSteps.map((step, index) => (
                  <li key={step} className="flex items-start gap-3 text-sm text-ink">
                    <span className="font-heading text-xs font-bold text-cyan">{String(index + 1).padStart(2, "0")}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </section>
          </AnimateIn>
        </div>
      </div>

      <div className="border-t border-[var(--color-line)]">
        <div className="container-wide grid gap-10 py-16 md:py-24 sm:grid-cols-2">
          <AnimateIn>
            <div>
              <h2 className="text-xl font-bold">Not sure which option fits your business?</h2>
              <p className="mt-3 text-sm text-muted">
                Explore our services to understand what's involved in building and launching your website.
              </p>
              <Link
                to="/services"
                className="mt-4 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink transition-colors hover:text-blue"
              >
                Explore Services
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </AnimateIn>
          <AnimateIn delay={80}>
            <div>
              <h2 className="text-xl font-bold">Curious how the project runs?</h2>
              <p className="mt-3 text-sm text-muted">
                Your project starts with understanding what you need, then moves through strategy, design,
                development, review, and launch.
              </p>
              <Link
                to="/process"
                className="mt-4 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink transition-colors hover:text-blue"
              >
                See Our Process
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </AnimateIn>
        </div>
      </div>

      <div className="border-t border-[var(--color-line)]">
        <div className="container-site py-16 md:py-24">
          <AnimateIn>
            <h2 className="text-2xl md:text-3xl">Pricing questions.</h2>
            <div className="mt-8">
              {pricingFaqs.map((item) => (
                <FaqItem key={item.question} question={item.question} answer={item.answer} />
              ))}
            </div>
          </AnimateIn>
        </div>
      </div>

      <CTA
        title="Ready to get a clear quote for your website?"
        description="Tell us about your business, your goals, and what you're looking to build."
      />
    </main>
  );
}
