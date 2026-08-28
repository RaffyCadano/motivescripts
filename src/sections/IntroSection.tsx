import { Link } from "react-router-dom";
import { AnimateIn } from "@/components/AnimateIn";
import { pipeline } from "@/data/site";

export function IntroSection() {
  return (
    <section className="border-t border-[var(--color-line)] py-20 md:py-28">
      <div className="container-wide grid items-start gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-20">
        <AnimateIn>
          <p className="eyebrow">Why the website matters</p>
          <h2 className="mt-4 max-w-[16ch] text-[1.85rem] md:text-[2.6rem] lg:text-[2.85rem]">
            Your website is more than a homepage.
          </h2>
          <p className="mt-5 max-w-xl text-[var(--text-md)] text-muted">
            It is how customers decide whether to trust you. A strong website explains the
            business, shows the work, and makes the next step obvious — call, book, or request a
            quote.
          </p>
        </AnimateIn>

        <div>
          <AnimateIn delay={80}>
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">
              How a project runs
            </p>
          </AnimateIn>
          <ol className="relative mt-6 border-l border-[var(--color-line)] pl-6">
            {pipeline.map((stage, index) => (
              <li key={stage.title} className="relative pb-6 last:pb-0">
                <AnimateIn delay={index * 90}>
                  <span
                    className="absolute -left-[calc(1.5rem+5px)] top-1.5 size-2.5 rounded-full bg-cyan"
                    aria-hidden="true"
                  />
                  <p className="font-heading text-xs font-bold tracking-[0.16em] text-cyan">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-1 font-heading text-lg font-semibold text-ink">{stage.title}</p>
                </AnimateIn>
              </li>
            ))}
          </ol>
          <AnimateIn delay={pipeline.length * 90}>
            <Link
              to="/process"
              className="mt-8 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink transition-colors hover:text-blue"
            >
              See the full process
              <span aria-hidden="true">→</span>
            </Link>
          </AnimateIn>
        </div>
      </div>
    </section>
  );
}
