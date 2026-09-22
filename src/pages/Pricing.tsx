import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimateIn } from "@/components/AnimateIn";
import { Button } from "@/components/Button";
import { CTA } from "@/components/CTA";
import { FaqItem } from "@/components/FaqItem";
import { PageHero } from "@/components/PageHero";
import { TierPrice } from "@/components/TierPrice";
import {
  careStartingPrice,
  commonAddOns,
  hostingStartingPrice,
  ongoingServices,
  ongoingServicesTerms,
  pricingTiers,
  seoRetainerStartingPrice,
  websiteStartingPrice,
} from "@/data/pricing";
import type { MaintenancePlanTemplate } from "@/data/maintenancePlanTemplates";
import { fetchPublishedMaintenancePlanTemplates } from "@/data/maintenancePlanTemplatesRepository";
import { formatUsdWhole } from "@/data/money";
import { site } from "@/data/site";
import { usePageMeta } from "@/lib/usePageMeta";
import { seoPage } from "@/data/seoPages";
import { cn } from "@/lib/cn";

const hostingAndSeoServices = ongoingServices.filter((service) => service.planType !== "care");
const fallbackCareService = ongoingServices.find((service) => service.planType === "care")!;

const priceFactors = [
  "Number of pages",
  "Design complexity and custom layouts",
  "Custom functionality, like booking or e-commerce",
  "Integrations with other tools",
  "Amount of content to design around",
  "Hosting setup, domain, or business email, if you need them",
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
    question: "How much does a website cost?",
    answer: `Websites start at ${websiteStartingPrice}. That's a starting price, not a fixed one — your final quote reflects the pages, functionality, and integrations your project needs.`,
  },
  {
    question: "Why does pricing vary?",
    answer:
      "Every website is scoped around your goals, content, functionality, and integrations. A simple site and one with booking, payments, or custom features are different amounts of work, so they're quoted differently.",
  },
  {
    question: "Do you offer custom projects?",
    answer:
      "Yes. If you need something beyond a standard website — like e-commerce, customer login, or complex integrations — we'll scope it around your requirements and quote it individually.",
  },
  {
    question: "Are hosting and domain costs included?",
    answer:
      `Not automatically. Hosting setup, domain registration, and business email are quoted as separate line items when your project needs them, so you can see exactly what each one costs in your proposal. Ongoing monthly hosting is a separate optional service, starting at ${hostingStartingPrice}/month.`,
  },
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
    answer: `Not automatically. These optional monthly services are separate from your website project: Website Care (updates, maintenance, and technical support) starts at ${careStartingPrice}/month, hosting at ${hostingStartingPrice}/month, and an SEO retainer at ${seoRetainerStartingPrice}/month. ${ongoingServicesTerms}`,
  },
];

export function PricingPage() {
  const meta = seoPage("/pricing");
  usePageMeta(meta.title, meta.description, meta.path);

  // Website Care is tiered (Essential/Business/Pro), admin-editable, and fetched live so this page
  // never drifts from what's actually offered. Falls back to the static single-price card (never
  // showing a broken/empty section) until the fetch resolves, or if it fails.
  const [careTiers, setCareTiers] = useState<MaintenancePlanTemplate[]>([]);
  useEffect(() => {
    let active = true;
    void fetchPublishedMaintenancePlanTemplates().then((rows) => {
      if (active) setCareTiers(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main id="main">
      <PageHero
        eyebrow="Pricing"
        title="Simple pricing for websites built around your business."
        description={`Websites start at ${websiteStartingPrice}. Every project is scoped around what your business needs, so you get a clear quote before development begins.`}
      />

      <div className="container-wide py-16 md:py-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pricingTiers.map((tier, index) => (
            <AnimateIn
              key={tier.id}
              className={cn("flex h-full", index === pricingTiers.length - 1 && "sm:col-span-2 lg:col-span-1")}
              delay={index * 80}
            >
              <article
                className={cn(
                  "relative flex h-full w-full flex-col rounded-[var(--radius-lg)] border p-7 transition-[transform,box-shadow,border-color] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:-translate-y-1 md:p-8",
                  tier.highlighted
                    ? "border-[rgb(0_80_240_/_0.35)] bg-[rgb(0_80_240_/_0.03)] shadow-[var(--shadow-card)] hover:shadow-[0_20px_48px_rgb(0_80_240_/_0.16)]"
                    : "border-[var(--color-line)] hover:border-[rgb(0_200_255_/_0.28)] hover:shadow-[var(--shadow-card)]",
                )}
              >
                {tier.badge ? (
                  <span className="absolute -top-3 left-7 rounded-full bg-[linear-gradient(135deg,#0050F0,#00A0FF)] px-3 py-1 font-heading text-xs font-bold uppercase tracking-[0.1em] text-white">
                    {tier.badge}
                  </span>
                ) : null}
                <h2 className="text-2xl font-bold">{tier.name}</h2>
                <p className="mt-3 text-muted sm:min-h-[3.3rem]">{tier.tagline}</p>
                <TierPrice className="mt-6" lead={tier.priceLead} price={tier.price} note={tier.priceNote} />
                <ul className="mt-6 flex-1 space-y-3 border-t border-[var(--color-line)] pt-6">
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
        <div className="container-wide py-16 md:py-24">
          <AnimateIn>
            <section aria-labelledby="add-ons-heading">
              <h2 id="add-ons-heading" className="text-2xl md:text-3xl">
                Common add-ons.
              </h2>
              <p className="mt-4 max-w-2xl text-muted">
                Some projects need more than the base website. These are a few examples of what can be added — they&apos;re
                examples, not a price list. Add-ons are scoped and priced in your proposal.
              </p>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {commonAddOns.map((item) => (
                  <li
                    key={item.name}
                    className="rounded-[var(--radius-lg)] border border-[var(--color-line)] p-5"
                  >
                    <h3 className="text-base font-bold">{item.name}</h3>
                    <p className="mt-2 text-sm text-muted">{item.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          </AnimateIn>
        </div>
      </div>

      <div className="border-t border-[var(--color-line)]">
        <div className="container-wide py-16 md:py-24">
          <AnimateIn>
            <section aria-labelledby="ongoing-heading">
              <h2 id="ongoing-heading" className="text-2xl md:text-3xl">
                Ongoing services.
              </h2>
              <p className="mt-4 max-w-2xl text-muted">
                Optional monthly services for after your website launches. They&apos;re separate from your project and
                are never added automatically.
              </p>
              {careTiers.length > 0 ? (
                <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {careTiers.map((tier) => (
                    <li key={tier.id} className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] p-7">
                      <h3 className="text-xl font-bold">Website Care — {tier.name}</h3>
                      {tier.description ? <p className="mt-3 flex-1 text-sm text-muted">{tier.description}</p> : <div className="flex-1" />}
                      {tier.includedServices.length > 0 ? (
                        <ul className="mt-4 space-y-2 border-t border-[var(--color-line)] pt-4">
                          {tier.includedServices.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-sm text-muted-strong">
                              <span className="mt-2 size-1 shrink-0 rounded-full bg-cyan" aria-hidden="true" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <TierPrice
                        className="mt-6"
                        lead="Starting at"
                        price={`${formatUsdWhole(tier.monthlyPriceCents)}/mo`}
                        note="Billed monthly. Choose it yourself from your client portal once your website has launched."
                      />
                    </li>
                  ))}
                  {hostingAndSeoServices.map((service) => (
                    <li key={service.id} className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] p-7">
                      <h3 className="text-xl font-bold">{service.name}</h3>
                      <p className="mt-3 flex-1 text-sm text-muted">{service.description}</p>
                      <TierPrice
                        className="mt-6"
                        lead="Starting at"
                        price={`${service.price}/mo`}
                        note="Billed monthly. Choose it yourself from your client portal once your website has launched."
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {[fallbackCareService, ...hostingAndSeoServices].map((service, index, all) => (
                    <li
                      key={service.id}
                      className={cn(
                        "flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] p-7",
                        index === all.length - 1 && "sm:col-span-2 lg:col-span-1",
                      )}
                    >
                      <h3 className="text-xl font-bold">{service.name}</h3>
                      <p className="mt-3 flex-1 text-sm text-muted">{service.description}</p>
                      <TierPrice
                        className="mt-6"
                        lead="Starting at"
                        price={`${service.price}/mo`}
                        note="Billed monthly. Choose it yourself from your client portal once your website has launched."
                      />
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-6 max-w-2xl text-sm text-faint">{ongoingServicesTerms}</p>
            </section>
          </AnimateIn>
        </div>
      </div>

      <div className="border-t border-[var(--color-line)]">
        <div className="container-wide grid gap-16 py-16 md:py-24 lg:grid-cols-2 lg:gap-20">
          <AnimateIn>
            <section>
              <h2 className="text-2xl md:text-3xl">What determines the price?</h2>
              <p className="mt-4 text-muted">
                Every website is scoped around your goals, content, functionality, and integrations. Your final
                proposal reflects the specific requirements of your project. A few things shape the scope and price:
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
                viewTransition
                to="/services"
                className="mt-4 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink transition-colors hover:text-blue"
              >
                Explore Services
                <span aria-hidden="true" className="icon-arrow">→</span>
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
                viewTransition
                to="/process"
                className="mt-4 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink transition-colors hover:text-blue"
              >
                See Our Process
                <span aria-hidden="true" className="icon-arrow">→</span>
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
        secondary={
          <>
            Have questions first?{" "}
            <a
              href={`mailto:${site.email}`}
              className="font-semibold text-ink underline-offset-4 transition-colors hover:text-blue hover:underline"
            >
              Email {site.email}
            </a>
          </>
        }
      />
    </main>
  );
}
