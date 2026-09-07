import { useEffect, useState } from "react";
import { AnimateIn } from "@/components/AnimateIn";
import { SectionHeader } from "@/components/SectionHeader";
import { fetchPublishedTestimonials } from "@/data/testimonialsRepository";
import type { Testimonial } from "@/data/testimonials";

export function TestimonialsSection() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  useEffect(() => {
    let active = true;
    void fetchPublishedTestimonials().then((rows) => {
      if (active) setTestimonials(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  if (testimonials.length === 0) return null;

  return (
    <section className="border-t border-[var(--color-line)] py-20 md:py-28">
      <div className="container-wide">
        <AnimateIn>
          <SectionHeader eyebrow="Client feedback" title="What clients say." />
        </AnimateIn>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <AnimateIn key={testimonial.id} delay={index * 80}>
              <figure className="h-full rounded-[var(--radius-lg)] border border-[var(--color-line)] p-6">
                <blockquote className="text-[var(--text-md)] text-ink">“{testimonial.quote}”</blockquote>
                <figcaption className="mt-5">
                  <p className="font-heading text-sm font-semibold text-ink">{testimonial.clientName}</p>
                  {testimonial.roleTitle ? <p className="mt-0.5 text-sm text-muted">{testimonial.roleTitle}</p> : null}
                </figcaption>
              </figure>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
