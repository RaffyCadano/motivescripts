import { Button } from "@/components/Button";
import { AnimateIn } from "@/components/AnimateIn";
import { HeroVisual } from "@/components/HeroVisual";

export function HeroSection() {
  return (
    <section className="relative pb-16 pt-10 sm:pb-20 sm:pt-14 md:pb-40 md:pt-28 lg:pb-44 lg:pt-36">
      <div className="container-wide relative grid items-center gap-8 md:gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
        <AnimateIn>
          <h1 className="max-w-[14ch] text-[2.35rem] sm:text-[3.15rem] lg:text-[4.05rem]">
            Websites built for businesses <span className="gradient-text">ready to grow.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted md:text-lg">
            We design and develop modern websites that help small businesses look professional,
            connect with customers, and grow online.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button to="/start-a-project" size="lg">
              Start a Project
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
