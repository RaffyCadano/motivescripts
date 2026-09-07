import { AnimateIn } from "@/components/AnimateIn";

const trustPoints = ["Mobile-first", "Fast performance", "Responsive design", "SEO-ready", "Ongoing support"];

export function TrustSection() {
  return (
    <section className="border-t border-[var(--color-line)] py-10 md:py-14">
      <div className="container-wide">
        <AnimateIn>
          <div className="flex flex-col items-center gap-6 text-center">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">
              Built for growing businesses
            </p>
            <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-center gap-2 text-sm font-semibold text-muted-strong">
                  <span className="size-1.5 shrink-0 rounded-full bg-cyan" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
