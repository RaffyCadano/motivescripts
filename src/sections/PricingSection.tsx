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
          <SectionHeader
            align="center"
            eyebrow="Pricing"
            title={`Websites start at ${websiteStartingPrice}. Every project is scoped.`}
          />
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
                  "relative flex h-full w-full flex-col rounded-[var(--radius-lg)] border p-6 transition-[transform,box-shadow,border-color] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:-translate-y-1 md:p-7",
                  tier.highlighted
                    ? "border-[rgb(0_80_240_/_0.35)] bg-[rgb(0_80_240_/_0.03)] shadow-[var(--shadow-card)] hover:shadow-[0_20px_48px_rgb(0_80_240_/_0.16)]"
                    : "border-[var(--color-line)] hover:border-[rgb(0_200_255_/_0.28)] hover:shadow-[var(--shadow-card)]",
                )}
              >
                {tier.badge ? (
                  <span className="absolute -top-3 left-6 rounded-full bg-[linear-gradient(135deg,#0050F0,#00A0FF)] px-3 py-1 font-heading text-xs font-bold uppercase tracking-[0.1em] text-white">
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
