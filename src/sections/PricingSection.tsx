import { Link } from "react-router-dom";
import { AnimateIn } from "@/components/AnimateIn";
import { Button } from "@/components/Button";
import { SectionHeader } from "@/components/SectionHeader";
import { TierPrice } from "@/components/TierPrice";
import { pricingTiers, websiteStartingPrice } from "@/data/pricing";
import { cn } from "@/lib/cn";

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-[var(--color-line)] py-20 md:py-28">
      <div className="container-wide">
        <AnimateIn>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
            <SectionHeader eyebrow="Pricing" title={`Websites start at ${websiteStartingPrice}. Every project is scoped.`} />
            <Link
              to="/pricing"
              className="mt-1 inline-flex shrink-0 items-center gap-2 font-heading text-sm font-semibold text-ink transition-colors hover:text-blue sm:mt-11"
            >
              View Pricing
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </AnimateIn>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {pricingTiers.map((tier, index) => (
            <AnimateIn
              key={tier.id}
              className={cn("flex h-full", index === pricingTiers.length - 1 && "sm:col-span-2 lg:col-span-1")}
              delay={index * 70}
            >
              <article
                className={cn(
                  "relative flex h-full w-full flex-col rounded-[var(--radius-lg)] border p-6 md:p-7",
                  tier.highlighted
                    ? "border-[rgb(0_80_240_/_0.35)] bg-[rgb(0_80_240_/_0.03)] shadow-[var(--shadow-card)]"
                    : "border-[var(--color-line)]",
                )}
              >
                {tier.badge ? (
                  <span className="absolute -top-3 left-6 rounded-full bg-[linear-gradient(135deg,#0050F0,#00A0FF)] px-3 py-1 font-heading text-[11px] font-bold uppercase tracking-[0.1em] text-white">
                    {tier.badge}
                  </span>
                ) : null}
                <h3 className="text-xl font-bold">{tier.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted sm:min-h-[2.9rem]">{tier.tagline}</p>
                <TierPrice className="mt-5" lead={tier.priceLead} price={tier.price} note={tier.priceNote} />
                <ul className="mt-5 flex-1 space-y-2.5 border-t border-[var(--color-line)] pt-5">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted-strong">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-cyan" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button to="/start-a-project" className="mt-7" variant={tier.highlighted ? "primary" : "secondary"}>
                  Start a Project
                </Button>
              </article>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
