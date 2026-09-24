import { Link } from "react-router-dom";
import { CodeXml, PenTool, Rocket, Search } from "lucide-react";
import { AnimateIn } from "@/components/AnimateIn";
import { SectionHeader } from "@/components/SectionHeader";

/** Condensed four-stage summary for the homepage. The full six-step breakdown lives on /process. */
const homeProcessSteps = [
  {
    number: "01",
    title: "Discover",
    body: "We learn about your business, customers, goals, and requirements.",
    Icon: Search,
  },
  {
    number: "02",
    title: "Design",
    body: "We create the structure and visual direction for your website.",
    Icon: PenTool,
  },
  {
    number: "03",
    title: "Build",
    body: "We develop the website and make sure everything works across devices.",
    Icon: CodeXml,
  },
  {
    number: "04",
    title: "Launch",
    body: "We test, finalize, connect the domain, and launch your website.",
    Icon: Rocket,
  },
] as const;

export function ProcessSection() {
  return (
    <section id="process" className="border-t border-[var(--color-line)] py-20 md:py-28">
      <div className="container-wide">
        <AnimateIn>
          <SectionHeader align="center" eyebrow="How it works" title="A clear process from idea to launch." />
          <div className="mt-5 text-center">
            <Link
              viewTransition
              to="/process"
              className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink transition-colors hover:text-blue"
            >
              See the full process
              <span aria-hidden="true" className="icon-arrow">→</span>
            </Link>
          </div>
        </AnimateIn>

        {/* One panel, four cells: the 1px gap over the line-colored background draws the dividers, so they
            stay right whether the cells sit in one, two, or four columns. */}
        <AnimateIn delay={80}>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-line)] shadow-[var(--shadow-card)] sm:mt-14 md:grid-cols-2 lg:grid-cols-4">
            {homeProcessSteps.map(({ number, title, body, Icon }) => (
              <li
                key={number}
                className="group relative flex min-w-0 gap-4 bg-[var(--ms-white)] p-6 transition-colors duration-[var(--duration-base)] ease-[var(--ease-out)] hover:bg-[var(--ms-bg-card)] md:p-8 lg:flex-col lg:gap-0"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[rgb(0_80_240_/_0.08)] text-blue transition-colors duration-[var(--duration-base)] group-hover:bg-blue group-hover:text-white">
                  <Icon size={22} strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0 lg:mt-6">
                  <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">Step {number}</p>
                  <h3 className="mt-1.5 text-xl">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </AnimateIn>
      </div>
    </section>
  );
}
