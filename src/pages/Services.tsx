import { Check, Code2, Search, Wrench, PenTool, type LucideIcon } from "lucide-react";
import { Button } from "@/components/Button";
import { CTA } from "@/components/CTA";
import { AnimateIn } from "@/components/AnimateIn";
import { PageHero } from "@/components/PageHero";
import { StepList } from "@/components/StepList";
import { pipeline } from "@/data/site";
import { services } from "@/data/services";
import { usePageMeta } from "@/lib/usePageMeta";
import { seoPage } from "@/data/seoPages";

const serviceIcons: Record<(typeof services)[number]["id"], LucideIcon> = {
  design: PenTool,
  development: Code2,
  care: Wrench,
  seo: Search,
};

const included = [
  "Responsive, mobile-first design",
  "Custom page layouts",
  "Contact forms",
  "Basic SEO setup",
  "Performance optimization",
  "Accessibility basics",
  "Domain connection",
  "Launch support",
];

export function ServicesPage() {
  const meta = seoPage("/services");
  usePageMeta(meta.title, meta.description, meta.path);

  return (
    <main id="main">
      <PageHero
        centered
        plainEyebrow
        eyebrow="Services"
        title="Everything your business needs for a better website."
        description="From strategy and design to development and launch, we handle the website from first idea to finished product."
      />

      <div className="container-wide space-y-20 py-16 md:space-y-24 md:py-24">
        <div>
          <AnimateIn className="text-center">
            <p className="eyebrow eyebrow--plain">What we do</p>
          </AnimateIn>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {services.map((service, index) => {
              const Icon = serviceIcons[service.id];
              return (
                <AnimateIn key={service.id} className="flex h-full" delay={index * 80}>
                  <article
                    id={service.id}
                    className="group relative flex h-full w-full scroll-mt-28 flex-col items-center rounded-[var(--radius-lg)] border border-[var(--color-line)] p-7 text-center transition-[transform,box-shadow,border-color] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:-translate-y-1 hover:border-[rgb(0_200_255_/_0.28)] hover:shadow-[var(--shadow-card)] md:p-9"
                  >
                    <span className="absolute left-6 top-6 font-heading text-xs font-bold tracking-[0.16em] text-cyan">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-[rgb(0_80_240_/_0.06)] text-blue transition-colors duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:bg-[rgb(0_80_240_/_0.1)]">
                      <Icon size={26} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <h2 className="mt-5 text-2xl">{service.title}</h2>
                    <p className="mt-3 max-w-md font-medium text-muted-strong">{service.body}</p>
                    <p className="mt-5 w-full max-w-md border-t border-[var(--color-line)] pt-5 text-sm leading-relaxed text-muted">
                      {service.detail}
                    </p>
                  </article>
                </AnimateIn>
              );
            })}
          </div>
        </div>

        <AnimateIn>
          <section>
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow eyebrow--plain">How it fits together</p>
              <h2 className="mx-auto mt-4 max-w-[24ch] text-2xl md:text-3xl">One website process, from idea to launch.</h2>
              <p className="mt-4 text-muted">
                Each project brings strategy, design, development, and launch together so your website works as
                one cohesive experience.
              </p>
            </div>
            <StepList className="mt-12" steps={pipeline.slice(0, 4)} columns={4} />
          </section>
        </AnimateIn>

        <AnimateIn>
          <section>
            <h2 className="text-center text-2xl md:text-3xl">What's included in your website project</h2>
            <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {included.map((item) => (
                <li
                  key={item}
                  className="group flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] px-4 py-6 text-center transition-[transform,box-shadow,border-color] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[rgb(0_200_255_/_0.28)] hover:shadow-[var(--shadow-card)]"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-[rgb(0_80_240_/_0.06)] text-blue transition-colors duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:bg-[rgb(0_80_240_/_0.1)]">
                    <Check size={18} strokeWidth={2.4} aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold leading-snug text-ink">{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </AnimateIn>

        <AnimateIn>
          <section className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl md:text-3xl">Built around your business.</h2>
            <p className="mt-4 text-[var(--text-md)] text-muted">
              Every business has different goals, customers, and priorities. We scope each website around what
              your business actually needs — from the pages and messaging to the features and functionality.
            </p>
          </section>
        </AnimateIn>

        <AnimateIn>
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[linear-gradient(135deg,rgb(0_80_240_/_0.04),rgb(0_200_255_/_0.05))] px-6 py-12 text-center md:px-12 md:py-14">
            <h2 className="text-2xl md:text-3xl">See the work in action.</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted">
              Explore website concepts that show how we approach structure, design, and user experience for
              different types of businesses.
            </p>
            <Button to="/work" variant="secondary" className="mt-8">
              View Our Work
              <span aria-hidden="true" className="icon-arrow">→</span>
            </Button>
          </section>
        </AnimateIn>
      </div>

      <CTA
        title="Ready to build a better website?"
        description="Tell us about your business and we'll help determine what your website actually needs."
      />
    </main>
  );
}
