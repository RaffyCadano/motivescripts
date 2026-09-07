import { AnimateIn } from "@/components/AnimateIn";
import { Button } from "@/components/Button";
import { CTA } from "@/components/CTA";
import { PageHero } from "@/components/PageHero";
import { pricingTiers } from "@/data/pricing";
import { usePageMeta } from "@/lib/usePageMeta";
import { cn } from "@/lib/cn";

export function PricingPage() {
  usePageMeta(
    "Pricing — MotiveScripts",
    "Engagement options for small-business websites, from a focused starter site to a custom build. Every project is scoped and quoted individually.",
  );
  return (
    <main id="main">
      <PageHero
        eyebrow="Pricing"
        title="Engagement options for every stage of growth."
        description="Every project is scoped and quoted individually based on your goals, pages, and features — these tiers are a starting point for the conversation."
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
      <CTA />
    </main>
  );
}
