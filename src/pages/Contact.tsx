import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimateIn } from "@/components/AnimateIn";
import { Button } from "@/components/Button";
import { PageHero } from "@/components/PageHero";
import { leadIndustries, referralSources } from "@/data/leads";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { inquiryMailtoHref, submitPublicLead, type PublicLeadDraft } from "@/data/publicLead";
import { site } from "@/data/site";
import { cn } from "@/lib/cn";
import { usePageMeta } from "@/lib/usePageMeta";

const nextSteps = [
  "Tell us about your project",
  "We review your requirements",
  "We define the project scope",
  "We move into the project process",
];

function draftFromForm(form: HTMLFormElement): PublicLeadDraft {
  const data = new FormData(form);
  return {
    name: String(data.get("name") ?? ""),
    business: String(data.get("business") ?? ""),
    email: String(data.get("email") ?? ""),
    phone: String(data.get("phone") ?? ""),
    industry: String(data.get("industry") ?? ""),
    goal: String(data.get("goal") ?? ""),
    referralSource: String(data.get("referralSource") ?? ""),
    referralSourceOther: String(data.get("referralSourceOther") ?? ""),
    website: String(data.get("website") ?? ""),
  };
}

export function ContactPage() {
  usePageMeta(
    "Start a Project — MotiveScripts",
    "Tell us about the website you want to build. Share a few details about your business and project and we'll follow up with next steps.",
    "/start-a-project",
  );
  const { reload } = useLeads();
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mailtoHref, setMailtoHref] = useState<string | null>(null);
  const [referralSource, setReferralSource] = useState("");

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
        title="Let's build a website that works for your business."
        description="Tell us a little about your business, your goals, and what you're looking to build. We'll use that information to understand your project and determine the right next step."
      />

      {submitted ? null : (
        <div className="container-wide pb-2 pt-10 md:pt-14">
          <AnimateIn>
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">What happens next?</p>
            <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {nextSteps.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="font-heading text-xs font-bold text-cyan">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-sm text-muted-strong">{step}</span>
                </li>
              ))}
            </ol>
          </AnimateIn>
        </div>
      )}

      <div className="container-wide grid gap-12 py-10 md:grid-cols-[1fr_18rem] md:py-16 lg:grid-cols-[1fr_22rem]">
        <AnimateIn>
        {submitted ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] p-8 md:p-10">
            <p className="eyebrow">Received</p>
            <h2 className="mt-4 text-2xl">Project inquiry submitted.</h2>
            <p className="mt-4 max-w-lg text-muted">
              Thanks for telling us about your project. We'll review what you shared and follow up with next
              steps.
            </p>
            <p className="mt-4 max-w-lg text-muted">
              If you'd rather send details directly, email{" "}
              <a className="text-cyan underline-offset-2 hover:underline" href={`mailto:${site.email}`}>
                {site.email}
              </a>
              .
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink transition-colors hover:text-blue"
            >
              Back to homepage
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <form className="rounded-[var(--radius-lg)] border border-[var(--color-line)] p-6 md:p-8" onSubmit={onSubmit}>
            <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <FormSection label="About you">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Name" name="name" autoComplete="name" required placeholder="Your name" />
                <Field label="Email" name="email" type="email" autoComplete="email" required placeholder="you@email.com" />
              </div>
            </FormSection>

            <FormSection label="About your business">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Business name" name="business" autoComplete="organization" required placeholder="Your business" />
                <Field label="Phone" name="phone" type="tel" autoComplete="tel" placeholder="Phone number" />
                <div className="sm:col-span-2">
                  <label className="block font-heading text-sm font-semibold text-ink" htmlFor="industry">
                    Industry
                    <span className="ml-2 font-normal text-faint">Required</span>
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
              </div>
            </FormSection>

            <FormSection label="Your project" last>
              <div className="grid gap-5">
                <div>
                  <label className="block font-heading text-sm font-semibold text-ink" htmlFor="goal">
                    What are you looking to build?
                    <span className="ml-2 font-normal text-faint">Required</span>
                  </label>
                  <p className="mt-1 text-xs text-faint">
                    Tell us about your business, what you need from your website, and anything you'd like us to
                    know.
                  </p>
                  <textarea
                    id="goal"
                    name="goal"
                    required
                    minLength={8}
                    rows={5}
                    className={cn(inputClass, "mt-2")}
                    placeholder="Describe the website you want to build."
                    onInvalid={(event) => event.currentTarget.setCustomValidity("Tell us what you need.")}
                    onInput={(event) => event.currentTarget.setCustomValidity("")}
                  />
                </div>
                <div>
                  <label className="block font-heading text-sm font-semibold text-ink" htmlFor="referralSource">
                    How did you hear about us?
                    <span className="ml-2 font-normal text-faint">Optional</span>
                  </label>
                  <select
                    id="referralSource"
                    name="referralSource"
                    className={cn(inputClass, "mt-2")}
                    value={referralSource}
                    onChange={(event) => setReferralSource(event.target.value)}
                  >
                    <option value="">Prefer not to say</option>
                    {referralSources.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                </div>
                {referralSource === "Other" ? (
                  <div>
                    <label className="block font-heading text-sm font-semibold text-ink" htmlFor="referralSourceOther">
                      Tell us where
                      <span className="ml-2 font-normal text-faint">Optional</span>
                    </label>
                    <input
                      id="referralSourceOther"
                      name="referralSourceOther"
                      className={cn(inputClass, "mt-2")}
                      placeholder="e.g. a podcast, a friend, a search engine"
                    />
                  </div>
                ) : null}
              </div>
            </FormSection>

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
                {sending ? "Sending…" : "Start Your Project"}
                {sending ? null : <span aria-hidden="true">→</span>}
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

function FormSection({ label, children, last = false }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={cn("border-b border-[var(--color-line)] pb-6", last ? "border-b-0 pb-0" : "mb-6")}>
      <h2 className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">{label}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

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
        <span className="ml-2 font-normal text-faint">{required ? "Required" : "Optional"}</span>
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
