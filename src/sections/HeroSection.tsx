import { Button } from "@/components/Button";
import { AnimateIn } from "@/components/AnimateIn";
import { HeroVisual } from "@/components/HeroVisual";

/** The short trust points under the hero buttons; the dots are the brand blues. */
const heroPoints = [
  { label: "Custom-built", dot: "bg-[#0050F0]" },
  { label: "2–4 week typical launch", dot: "bg-[#00C8FF]" },
  { label: "Winston-Salem, NC", dot: "bg-[#0b1b3a]" },
] as const;

export function HeroSection() {
  return (
    <section className="relative pb-16 pt-8 sm:pb-20 sm:pt-12 md:pb-32 md:pt-20 lg:pb-32 lg:pt-20">
      <div className="hero-grid pointer-events-none absolute inset-0" />

      <div className="container-wide relative grid items-center gap-8 md:gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-8 xl:gap-10">
        <div>
          <AnimateIn>
            <h1 className="max-w-[15ch] text-[2.35rem] sm:text-[3.15rem] lg:text-[4.05rem]">
              Websites that <span className="gradient-text">turn visitors into customers.</span>
            </h1>
          </AnimateIn>
          <AnimateIn delay={90}>
            <p className="mt-6 max-w-xl text-base text-muted md:text-lg">
              We design and build fast, modern websites for small businesses that want more calls,
              bookings, and customers.
            </p>
          </AnimateIn>
          <AnimateIn delay={180}>
            <div className="mt-8 flex flex-row items-center gap-3">
              <Button to="/start-a-project" size="lg" className="whitespace-nowrap max-sm:flex-auto max-sm:px-3! max-sm:text-sm! max-[380px]:px-2! max-[380px]:text-[13px]!">
                Start Your Project
              </Button>
              <Button to="/work" variant="secondary" size="lg" className="whitespace-nowrap max-sm:flex-auto max-sm:px-3! max-sm:text-sm! max-[380px]:px-2! max-[380px]:text-[13px]!">
                View Our Work
              </Button>
            </div>
          </AnimateIn>
          <AnimateIn delay={260}>
            <ul className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-sm text-muted">
              {heroPoints.map((point) => (
                <li key={point.label} className="flex items-center gap-2">
                  <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${point.dot}`} />
                  {point.label}
                </li>
              ))}
            </ul>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-faint">
              <span className="font-medium text-muted-strong">Custom web design in Winston-Salem, North Carolina</span>, for
              small businesses that want more calls, bookings, and customers.
            </p>
          </AnimateIn>
        </div>
        <AnimateIn delay={220} variant="scale">
          <HeroVisual />
        </AnimateIn>
      </div>
    </section>
  );
}
