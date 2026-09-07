import { AnimateIn } from "@/components/AnimateIn";
import { SectionHeader } from "@/components/SectionHeader";
import { ServiceCard } from "@/components/ServiceCard";
import { services } from "@/data/services";

export function ServicesSection() {
  return (
    <section id="services" className="border-t border-[var(--color-line)] py-20 md:py-28">
      <div className="container-wide">
        <AnimateIn>
          <SectionHeader
            eyebrow="What we do"
            title="Everything your business needs online."
          />
        </AnimateIn>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {services.map((service, index) => (
            <AnimateIn key={service.id} className="flex h-full" delay={index * 70}>
              <ServiceCard
                title={service.title}
                body={service.body}
                index={index}
                href={service.href}
              />
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
