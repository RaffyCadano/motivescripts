import { CTA } from "@/components/CTA";
import { AnimateIn } from "@/components/AnimateIn";
import { PageHero } from "@/components/PageHero";
import { services } from "@/data/services";

export function ServicesPage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Services"
        title="Design, development, and support for small-business websites."
        description="MotiveScripts handles the full website process — from the first conversation through launch, with optional care afterward."
      />

      <div className="container-wide py-16 md:py-24">
        <div className="-mx-3 flex flex-col gap-8 px-3 py-3">
          {services.map((service, index) => (
            <AnimateIn key={service.id} delay={index * 80}>
              <article
                id={service.id}
                className="grid gap-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] p-7 md:grid-cols-[8rem_1fr] md:p-10"
              >
              <p className="font-heading text-sm font-bold tracking-[0.16em] text-cyan">
                {String(index + 1).padStart(2, "0")}
              </p>
              <div>
                <h2 className="text-2xl md:text-3xl">{service.title}</h2>
                <p className="mt-3 max-w-2xl text-muted">{service.body}</p>
                <p className="mt-4 max-w-2xl text-muted-strong">{service.detail}</p>
              </div>
              </article>
            </AnimateIn>
          ))}
        </div>
      </div>
      <CTA />
    </main>
  );
}
