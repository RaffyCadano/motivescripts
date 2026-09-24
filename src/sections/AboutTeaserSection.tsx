import { Link } from "react-router-dom";
import { AnimateIn } from "@/components/AnimateIn";
import { clientTypeIcons } from "@/data/clientTypeIcons";
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
            viewTransition
            to="/about"
            className="mt-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink transition-colors hover:text-blue"
          >
            About MotiveScripts
            <span aria-hidden="true" className="icon-arrow">→</span>
          </Link>
        </AnimateIn>

        <AnimateIn delay={100}>
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--ms-bg-card)] p-5 sm:p-7">
            <h3 className="font-heading text-lg font-bold text-ink">Who we work with</h3>
            <p className="mt-1.5 text-sm text-muted">Local and service businesses that need a clear, fast website.</p>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {clientTypes.map((item) => {
                const Icon = clientTypeIcons[item];
                return (
                  <li
                    key={item}
                    className="group flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--ms-white)] p-3 transition-[transform,box-shadow,border-color] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[rgb(0_80_240_/_0.3)] hover:shadow-[var(--shadow-card)]"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-blue transition-colors duration-[var(--duration-base)] group-hover:bg-blue group-hover:text-white">
                      <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold leading-snug text-ink">{item}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
