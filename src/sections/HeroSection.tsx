import { Button } from "@/components/Button";
import { AnimateIn } from "@/components/AnimateIn";
import { HeroVisual } from "@/components/HeroVisual";

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
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button to="/start-a-project" size="lg">
                Start Your Project
              </Button>
              <Button to="/work" variant="secondary" size="lg">
                View Our Work
              </Button>
            </div>
          </AnimateIn>
        </div>
        <AnimateIn delay={220} variant="scale">
          <HeroVisual />
        </AnimateIn>
      </div>
    </section>
  );
}
