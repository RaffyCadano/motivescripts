import { Link } from "react-router-dom";
import { AnimateIn } from "@/components/AnimateIn";
import { clientTypes } from "@/data/site";

export function AboutTeaserSection() {
  return (
    <section className="border-t border-[var(--color-line)] py-20 md:py-28">
      <div className="container-wide grid items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
        <AnimateIn>
          <p className="eyebrow">About MotiveScripts</p>
          <h2 className="mt-4 max-w-[16ch] text-[1.85rem] md:text-[2.6rem] lg:text-[2.85rem]">
            We're MotiveScripts.
          </h2>
          <p className="mt-5 max-w-xl text-[var(--text-md)] text-muted">
            We believe small businesses deserve websites that look professional, perform well, and
            help them grow.
          </p>
          <Link
            to="/about"
            className="mt-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink transition-colors hover:text-blue"
          >
            About MotiveScripts
            <span aria-hidden="true">→</span>
          </Link>
        </AnimateIn>

        <AnimateIn delay={100}>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">Who we work with</p>
          <ul className="mt-5 grid grid-cols-2 gap-2.5">
            {clientTypes.map((item) => (
              <li
                key={item}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-3 text-sm font-medium text-ink"
              >
                {item}
              </li>
            ))}
          </ul>
        </AnimateIn>
      </div>
    </section>
  );
}
