import { Button } from "@/components/Button";
import { AnimateIn } from "@/components/AnimateIn";
import { HeroVisual } from "@/components/HeroVisual";

export function HeroSection() {
  return (
    <section className="relative pb-16 pt-10 sm:pb-20 sm:pt-14 md:pb-40 md:pt-28 lg:pb-44 lg:pt-36">
      <div className="container-wide relative grid items-center gap-8 md:gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
        <AnimateIn>
          <h1 className="max-w-[15ch] text-[2.35rem] sm:text-[3.15rem] lg:text-[4.05rem]">
            Websites that <span className="gradient-text">turn visitors into customers.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted md:text-lg">
            We design and build fast, modern websites for small businesses that want more calls,
            bookings, and customers.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button to="/start-a-project" size="lg">
              Start Your Project
            </Button>
            <Button to="/work" variant="secondary" size="lg">
              View Our Work
            </Button>
          </div>
        </AnimateIn>
        <AnimateIn delay={140}>
          <HeroVisual />
        </AnimateIn>
      </div>
    </section>
  );
}
