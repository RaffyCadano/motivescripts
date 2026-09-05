import { useState, type FormEvent } from "react";
import { AnimateIn } from "@/components/AnimateIn";
import { Button } from "@/components/Button";
import { PageHero } from "@/components/PageHero";
import { leadIndustries } from "@/data/leads";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { inquiryMailtoHref, submitPublicLead, type PublicLeadDraft } from "@/data/publicLead";
import { site } from "@/data/site";
import { cn } from "@/lib/cn";

function draftFromForm(form: HTMLFormElement): PublicLeadDraft {
  const data = new FormData(form);
  return {
    name: String(data.get("name") ?? ""),
    business: String(data.get("business") ?? ""),
    email: String(data.get("email") ?? ""),
    phone: String(data.get("phone") ?? ""),
    industry: String(data.get("industry") ?? ""),
    goal: String(data.get("goal") ?? ""),
    website: String(data.get("website") ?? ""),
  };
}

export function ContactPage() {
  const { reload } = useLeads();
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mailtoHref, setMailtoHref] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    const draft = draftFromForm(form);
    const fallback = inquiryMailtoHref(draft);
    setError(null);
    setSending(true);
    const result = await submitPublicLead(draft);
    setSending(false);
    if (result.ok) {
      setMailtoHref(null);
      setSubmitted(true);
      void reload();
      return;
    }
    setMailtoHref(fallback);
    setError("We couldn’t save that just now. Please email us instead, or try again.");
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
            <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Name" name="name" autoComplete="name" required placeholder="Your name" />
              <Field label="Business name" name="business" autoComplete="organization" required placeholder="Your business" />
              <Field label="Email" name="email" type="email" autoComplete="email" required placeholder="you@email.com" />
              <Field label="Phone" name="phone" type="tel" autoComplete="tel" placeholder="Phone number" />
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
                  onInvalid={(event) => event.currentTarget.setCustomValidity("Choose an industry.")}
                  onChange={(event) => event.currentTarget.setCustomValidity("")}
                >
                  <option value="" disabled>
                    Choose an industry
                  </option>
                  {leadIndustries.map((industry) => (
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
                  minLength={8}
                  rows={5}
                  className={inputClass}
                  placeholder="Describe the website you want to build."
                  onInvalid={(event) => event.currentTarget.setCustomValidity("Tell us what you need.")}
                  onInput={(event) => event.currentTarget.setCustomValidity("")}
                />
              </div>
            </div>
            {error ? (
              <p className="mt-5 text-sm text-muted" role="alert">
                {error}{" "}
                {mailtoHref ? (
                  <a className="font-medium text-ink underline-offset-2 hover:underline" href={mailtoHref}>
                    Open email
                  </a>
                ) : null}
              </p>
            ) : null}
            <div className="mt-7">
              <Button type="submit" size="lg" disabled={sending}>
                {sending ? "Sending…" : "Start a Project"}
              </Button>
            </div>
          </form>
        )}
        </AnimateIn>

        <AnimateIn delay={80}>
        <aside className="h-fit rounded-[var(--radius-lg)] border border-[var(--color-line)] p-6">
          <h2 className="text-lg">Prefer email?</h2>
          <p className="mt-3 text-sm text-muted">
            Send a note with the business name, the type of work, and what you want the website to do.
          </p>
          <a
            className="mt-4 inline-block whitespace-nowrap text-sm text-cyan"
            href={`mailto:${site.email}`}
          >
            {site.email}
          </a>
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
