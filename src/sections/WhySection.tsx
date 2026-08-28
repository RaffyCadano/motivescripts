import { AnimateIn } from "@/components/AnimateIn";
import { SectionHeader } from "@/components/SectionHeader";
import { whyPoints } from "@/data/site";

export function WhySection() {
  return (
    <section className="border-t border-[var(--color-line)] py-20 md:py-28">
      <div className="container-wide">
        <AnimateIn>
          <SectionHeader eyebrow="Why MotiveScripts" title="Built around your business. Not a template." />
        </AnimateIn>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {whyPoints.map((point, index) => (
            <AnimateIn key={point.title} delay={index * 70}>
              <article className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] p-7">
                <span
                  className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(180deg,#0038C8,#00C8FF)]"
                  aria-hidden="true"
                />
                <p className="font-heading text-xs font-bold tracking-[0.16em] text-faint">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-2xl">{point.title}</h3>
                <p className="mt-3 max-w-md text-muted">{point.body}</p>
              </article>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
