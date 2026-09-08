import { Link } from "react-router-dom";
import { AnimateIn } from "@/components/AnimateIn";
import { Button } from "@/components/Button";
import { CTA } from "@/components/CTA";
import { PageHero } from "@/components/PageHero";
import { clientTypes, pipeline, whyPoints } from "@/data/site";
import { usePageMeta } from "@/lib/usePageMeta";

const websiteJobs = [
  {
    title: "Explain the work",
    body: "Visitors should know what you do, who you serve, and where you work — without calling first.",
  },
  {
    title: "Show why you’re trusted",
    body: "Services, photos, and plain-language proof beat a generic “welcome to our website” homepage.",
  },
  {
    title: "Make the next step obvious",
    body: "Call, book, or request a quote should be easy to find on a phone, not buried in a footer.",
  },
];

export function AboutPage() {
  usePageMeta(
    "About — MotiveScripts",
    "MotiveScripts designs and develops websites for local and service businesses, from strategy through launch and ongoing care.",
    "/about",
  );
  return (
    <main id="main">
      <PageHero
        eyebrow="About MotiveScripts"
        title="Websites built around your business."
        description="MotiveScripts helps small businesses build a stronger presence online through thoughtful strategy, modern design, and reliable development."
      />

      <div className="container-wide space-y-20 py-16 md:space-y-24 md:py-24">
        <AnimateIn>
        <section className="max-w-3xl">
          <h2 className="text-2xl md:text-3xl">Built for businesses that need more than a template.</h2>
          <p className="mt-4 text-[var(--text-md)] text-muted">
            Your website is often the first place potential customers experience your business.
            MotiveScripts focuses on building websites that communicate clearly, look professional, and
            make it easier for customers to take the next step.
          </p>
        </section>
        </AnimateIn>

        <AnimateIn>
        <section>
          <h2 className="text-2xl md:text-3xl">What the website has to do</h2>
          <p className="mt-4 max-w-2xl text-muted">
            A small-business site is not a brochure. It has a job: help the right people understand
            the company and take action.
          </p>
          <ul className="mt-8 grid gap-3 md:grid-cols-3">
            {websiteJobs.map((item) => (
              <li
                key={item.title}
                className="rounded-[var(--radius-lg)] border border-[var(--color-line)] px-5 py-6"
              >
                <h3 className="text-lg">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
        </AnimateIn>

        <AnimateIn>
        <section>
          <h2 className="text-2xl md:text-3xl">Who we work with</h2>
          <p className="mt-4 max-w-2xl text-muted">
            Local and service businesses that need a clear website — not a freelancer portfolio.
            If customers find you on their phone and need to decide quickly, we know that shape of
            site.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {clientTypes.map((item) => (
              <li
                key={item}
                className="rounded-[var(--radius-lg)] border border-[var(--color-line)] px-4 py-4 text-sm font-medium text-ink"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
        </AnimateIn>

        <AnimateIn>
        <section>
          <h2 className="text-2xl md:text-3xl">How we work with you</h2>
          <p className="mt-4 max-w-2xl text-muted">
            We keep the project practical. You should always know what stage you’re in, what we need
            from you, and what happens next.
          </p>
          <ul className="mt-8 grid gap-3 md:grid-cols-2">
            {whyPoints.map((point, index) => (
              <li
                key={point.title}
                className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] p-6"
              >
                <span
                  className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(180deg,#0038C8,#00C8FF)]"
                  aria-hidden="true"
                />
                <p className="font-heading text-xs font-bold tracking-[0.16em] text-faint">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-xl">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{point.body}</p>
              </li>
            ))}
          </ul>
        </section>
        </AnimateIn>

        <AnimateIn>
        <section>
          <h2 className="text-2xl md:text-3xl">Thoughtful from strategy to launch.</h2>
          <p className="mt-4 max-w-2xl text-muted">
            We don’t treat strategy, design, and development as separate pieces — each stage builds on
            the last so the finished website works as one experience. Every engagement follows the same
            sequence so you are never guessing. The longer version lives on our{" "}
            <Link className="font-medium text-ink underline-offset-2 hover:underline" to="/process">
              process page
            </Link>
            .
          </p>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {pipeline.map((stage, index) => (
              <li
                key={stage.title}
                className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] px-4 py-5"
              >
                <span className="font-heading text-xs font-bold tracking-[0.16em] text-cyan">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="mt-3 font-heading text-base font-semibold text-ink">{stage.title}</span>
                <p className="mt-2 text-sm leading-relaxed text-muted">{stage.body}</p>
              </li>
            ))}
          </ol>
        </section>
        </AnimateIn>

        <AnimateIn>
        <section className="flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-3xl">See the approach in practice.</h2>
            <p className="mt-4 text-muted">
              Explore website concepts that demonstrate how we approach structure, design, and user
              experience for different types of businesses.
            </p>
            <p className="mt-6 text-sm text-muted">Want to know what working with MotiveScripts looks like?</p>
            <Link
              to="/process"
              className="mt-1 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink transition-colors hover:text-blue"
            >
              See Our Process
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <Button to="/work" variant="secondary" className="shrink-0">
            View Our Work
            <span aria-hidden="true">→</span>
          </Button>
        </section>
        </AnimateIn>
      </div>

      <CTA
        title="Ready to build something better?"
        description="Tell us about your business and what you're looking to build."
      />
    </main>
  );
}
