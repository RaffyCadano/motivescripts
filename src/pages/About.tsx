import { Link } from "react-router-dom";
import { AnimateIn } from "@/components/AnimateIn";
import { CTA } from "@/components/CTA";
import { PageHero } from "@/components/PageHero";
import { pipeline, whyPoints } from "@/data/site";

const clients = [
  "Home service businesses",
  "Contractors",
  "Landscaping and tree services",
  "Cleaning companies",
  "Restaurants and salons",
  "Auto shops",
  "Professional services",
  "Other local businesses",
];

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
  return (
    <main id="main">
      <PageHero
        eyebrow="About"
        title="A web agency for small businesses that need a professional site."
        description="MotiveScripts designs and develops websites for local and service businesses. We are set up to take a project from strategy through launch — and to stay available after the site is live."
      />

      <div className="container-wide space-y-20 py-16 md:space-y-24 md:py-24">
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
            {clients.map((item) => (
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
          <h2 className="text-2xl md:text-3xl">How a project runs</h2>
          <p className="mt-4 max-w-2xl text-muted">
            Every engagement follows the same sequence so you are never guessing. The longer version
            lives on our{" "}
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
        <section className="max-w-3xl">
          <h2 className="text-2xl md:text-3xl">After the site is live</h2>
          <p className="mt-5 text-[var(--text-md)] text-muted">
            Launch is not the end of the relationship unless you want it to be. We can keep the site
            updated, fix issues, and make small changes as the business evolves — hours, services,
            photos, and seasonal offers.
          </p>
          <p className="mt-4 text-[var(--text-md)] text-muted">
            If you want to see how we structure real service-business websites, the{" "}
            <Link className="font-medium text-ink underline-offset-2 hover:underline" to="/work">
              work page
            </Link>{" "}
            has labeled concept projects. When you’re ready to talk about yours,{" "}
            <Link className="font-medium text-ink underline-offset-2 hover:underline" to="/start-a-project">
              start a project
            </Link>
            .
          </p>
        </section>
        </AnimateIn>
      </div>
      <CTA />
    </main>
  );
}
