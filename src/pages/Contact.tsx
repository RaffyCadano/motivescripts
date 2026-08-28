import { useState, type FormEvent } from "react";
import { AnimateIn } from "@/components/AnimateIn";
import { Button } from "@/components/Button";
import { PageHero } from "@/components/PageHero";
import { site } from "@/data/site";
import { cn } from "@/lib/cn";

const industries = [
  "Home services",
  "Contractor",
  "Landscaping",
  "Tree service",
  "Cleaning",
  "Restaurant",
  "Salon / barber",
  "Auto",
  "Professional services",
  "Other",
];

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = [
      `Name: ${data.get("name") ?? ""}`,
      `Business: ${data.get("business") ?? ""}`,
      `Email: ${data.get("email") ?? ""}`,
      `Phone: ${data.get("phone") || "—"}`,
      `Industry: ${data.get("industry") ?? ""}`,
      "",
      String(data.get("goal") ?? ""),
    ].join("\n");
    const href = `mailto:${site.email}?subject=${encodeURIComponent(`Project inquiry — ${data.get("business") ?? "New project"}`)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setSubmitted(true);
  }

  return (
    <main id="main">
      <PageHero
        eyebrow="Start a project"
        title="Tell us about the website you want to build."
        description="Share a few details about the business and the project. We’ll review them and follow up with next steps."
      />

      <div className="container-wide grid gap-12 py-16 md:grid-cols-[1fr_18rem] md:py-24 lg:grid-cols-[1fr_22rem]">
        <AnimateIn>
        {submitted ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] p-8 md:p-10">
            <p className="eyebrow">Received</p>
            <h2 className="mt-4 text-2xl">Thanks — we’ll review your project.</h2>
            <p className="mt-4 max-w-lg text-muted">
              If you’d rather send details directly, email{" "}
              <a className="text-cyan underline-offset-2 hover:underline" href={`mailto:${site.email}`}>
                {site.email}
              </a>
              .
            </p>
          </div>
        ) : (
          <form className="rounded-[var(--radius-lg)] border border-[var(--color-line)] p-6 md:p-8" onSubmit={onSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Name" name="name" autoComplete="name" required placeholder="Alex Rivera" />
              <Field label="Business name" name="business" autoComplete="organization" required placeholder="Ridge Landscaping" />
              <Field label="Email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
              <Field label="Phone" name="phone" type="tel" autoComplete="tel" placeholder="(555) 000-1234" />
              <div className="sm:col-span-2">
                <label className="block font-heading text-sm font-semibold text-ink" htmlFor="industry">
                  Industry
                </label>
                <select
                  id="industry"
                  name="industry"
                  required
                  className={inputClass}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select one
                  </option>
                  {industries.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-heading text-sm font-semibold text-ink" htmlFor="goal">
                  What do you need?
                </label>
                <textarea
                  id="goal"
                  name="goal"
                  required
                  rows={5}
                  className={inputClass}
                  placeholder="A new website, a rebuild, ongoing care…"
                />
              </div>
            </div>
            <div className="mt-7">
              <Button type="submit" size="lg">
                Start a Project
              </Button>
            </div>
          </form>
        )}
        </AnimateIn>

        <AnimateIn delay={80}>
        <aside className="h-fit rounded-[var(--radius-lg)] border border-[var(--color-line)] p-6">
          <h2 className="text-lg">Prefer email?</h2>
          <p className="mt-3 text-sm text-muted">
            Send a note to{" "}
            <a className="text-cyan" href={`mailto:${site.email}`}>
              {site.email}
            </a>
            . Include the business name, the type of work, and what you want the website to do.
          </p>
        </aside>
        </AnimateIn>
      </div>
    </main>
  );
}

const inputClass =
  "mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-[rgb(0_80_240_/_0.55)]";

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block font-heading text-sm font-semibold text-ink" htmlFor={name}>
        {label}
        {required ? "" : <span className="ml-2 font-normal text-faint">Optional</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        className={cn(inputClass)}
      />
    </div>
  );
}
