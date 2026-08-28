import { Button } from "@/components/Button";
import { AnimateIn } from "@/components/AnimateIn";
import { cn } from "@/lib/cn";

type CTAProps = {
  className?: string;
};

export function CTA({ className }: CTAProps) {
  return (
    <section className={cn("relative py-20 md:py-28", className)} aria-labelledby="cta-heading">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(0_80_240_/_0.1),transparent_70%)]" />
        <div className="absolute -left-24 top-12 size-64 rounded-full bg-[rgb(0_200_255_/_0.08)] blur-3xl" />
        <div className="absolute -right-16 bottom-0 size-72 rounded-full bg-[rgb(0_80_240_/_0.16)] blur-3xl" />
      </div>

      <div className="container-site relative">
        <AnimateIn>
          <div className="relative overflow-hidden rounded-[1.25rem] border border-[var(--color-line-strong)] bg-[linear-gradient(180deg,#f4f8ff,#ffffff)] px-6 py-12 text-center md:px-16 md:py-16">
            <div
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  "linear-gradient(rgb(0 16 48 / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(0 16 48 / 0.05) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
                maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
              }}
            />
            <div className="relative">
              <h2 id="cta-heading" className="text-[1.85rem] md:text-[2.75rem]">
                Ready to build your next website?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[var(--text-md)] text-muted">
                Tell us about your business and what you’re looking to accomplish. We’ll review your
                project and prepare the next steps.
              </p>
              <div className="mt-8 flex justify-center">
                <Button to="/start-a-project" size="lg">
                  Start a Project
                </Button>
              </div>
            </div>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
