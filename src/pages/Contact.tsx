import { useState, type FormEvent, type ReactNode } from "react";
import { Building2, Mail, MessageSquareText, UserRound, type LucideIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimateIn } from "@/components/AnimateIn";
import { Button } from "@/components/Button";
import { PageHero } from "@/components/PageHero";
import { StepList } from "@/components/StepList";
import { leadIndustries, referralSources } from "@/data/leads";
import { announceLeadsChanged } from "@/lib/leadsEvents";
import { inquiryMailtoHref, submitPublicLead, type PublicLeadDraft } from "@/data/publicLead";
import { pricingTiers } from "@/data/pricing";
import { site } from "@/data/site";
import { cn } from "@/lib/cn";
import { usePageMeta } from "@/lib/usePageMeta";
import { seoPage } from "@/data/seoPages";

/** Starter sentence for the goal textarea when arriving from a pricing tier's "Start a Project"
 * button (?tier=website|growth|custom) -- saves re-typing which package they want, while leaving
 * the rest of the field free to fill in. Only ever sets the textarea's initial value (defaultValue,
 * uncontrolled), so the visitor can freely edit or delete it. */
function tierIntro(tier: (typeof pricingTiers)[number]): string {
  const intro = tier.price.startsWith("$")
    ? `I'm interested in the ${tier.name} package, starting at ${tier.price}.`
    : `I'm interested in a ${tier.name.toLowerCase()} project.`;
  return `${intro}\n\n`;
}

const nextSteps = [
  { title: "Tell us about your project" },
  { title: "We review your requirements" },
  { title: "We define the project scope" },
  { title: "We move into the project process" },
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
  const meta = seoPage("/start-a-project");
  usePageMeta(meta.title, meta.description, meta.path);

  const [searchParams] = useSearchParams();
  const selectedTier = pricingTiers.find((tier) => tier.id === searchParams.get("tier"));
  const initialGoal = selectedTier ? tierIntro(selectedTier) : "";

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
      announceLeadsChanged();
      return;
    }
    setMailtoHref(fallback);
    setError("We couldn’t save that just now. Please email us instead, or try again.");
  }

  return (
    <main id="main">
      <PageHero
        centered
        plainEyebrow
        eyebrow="Start a project"
        title="Let's build a website that works for your business."
        description="Tell us a little about your business, your goals, and what you're looking to build. We'll use that information to understand your project and determine the right next step."
      />

      {submitted ? null : (
        <div className="container-wide pb-2 pt-10 md:pt-14">
          <AnimateIn>
            <p className="text-center font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">What happens next?</p>
            <StepList className="mt-8" steps={nextSteps} columns={4} compact />
          </AnimateIn>
        </div>
      )}

      <div className="container-wide grid gap-12 py-10 md:grid-cols-[1fr_18rem] md:py-16 lg:grid-cols-[1fr_22rem]">
        <AnimateIn>
        {submitted ? (
          <div className="fade-up-in rounded-[var(--radius-lg)] border border-[var(--color-line)] p-8 md:p-10">
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
              viewTransition
              to="/"
              className="mt-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink transition-colors hover:text-blue"
            >
              Back to homepage
              <span aria-hidden="true" className="icon-arrow">→</span>
            </Link>
          </div>
        ) : (
          <form
            className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--ms-white)] p-6 shadow-[var(--shadow-card)] md:p-8"
            onSubmit={onSubmit}
          >
            <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <FormSection step={1} icon={UserRound} label="About you" description="So we know who to reply to.">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Name" name="name" autoComplete="name" required placeholder="Your name" />
                <Field label="Email" name="email" type="email" autoComplete="email" required placeholder="you@email.com" />
              </div>
            </FormSection>

            <FormSection step={2} icon={Building2} label="About your business" description="A little context on the business the website is for.">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Business name" name="business" autoComplete="organization" required placeholder="Your business" />
                <Field label="Phone" name="phone" type="tel" autoComplete="tel" placeholder="Phone number" />
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="industry" label="Industry" required />
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

            <FormSection step={3} icon={MessageSquareText} label="Your project" description="What you want to build. A few sentences is plenty." last>
              <div className="grid gap-5">
                <div>
                  <FieldLabel htmlFor="goal" label="What are you looking to build?" required />
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    Tell us about your business, what you need from your website, and anything you'd like us to
                    know.
                  </p>
                  <textarea
                    id="goal"
                    name="goal"
                    required
                    minLength={8}
                    rows={5}
                    defaultValue={initialGoal}
                    className={cn(inputClass, "mt-2")}
                    placeholder="Describe the website you want to build."
                    onInvalid={(event) => event.currentTarget.setCustomValidity("Tell us what you need.")}
                    onInput={(event) => event.currentTarget.setCustomValidity("")}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="referralSource" label="How did you hear about us?" />
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
                    <FieldLabel htmlFor="referralSourceOther" label="Tell us where" />
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
            <div className="mt-8 flex flex-col gap-3 border-t border-[var(--color-line)] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xs text-xs leading-relaxed text-faint">
                This is only an inquiry. Nothing is due before we start, and we&rsquo;ll follow up with next steps.
              </p>
              <Button type="submit" size="lg" disabled={sending} className="w-full sm:w-auto">
                {sending ? "Sending…" : "Start Your Project"}
                {sending ? null : <span aria-hidden="true" className="icon-arrow">→</span>}
              </Button>
            </div>
          </form>
        )}
        </AnimateIn>

        <AnimateIn delay={80}>
        <aside className="h-fit rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--ms-bg-card)] p-6 md:sticky md:top-28">
          <span className="flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-[rgb(0_80_240_/_0.08)] text-blue">
            <Mail size={22} strokeWidth={2} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg">Prefer email?</h2>
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
  "mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-white px-3.5 py-3 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] placeholder:text-faint hover:border-[rgb(0_80_240_/_0.35)] focus:border-[rgb(0_80_240_/_0.55)] focus:shadow-[0_0_0_3px_rgb(0_80_240_/_0.1)]";

/** A form section: a numbered icon tile, its title, a line of help, then the fields. */
function FormSection({
  step,
  icon: Icon,
  label,
  description,
  children,
  last = false,
}: {
  step: number;
  icon: LucideIcon;
  label: string;
  description: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <section className={cn("border-b border-[var(--color-line)] pb-8", last ? "border-b-0 pb-0" : "mb-8")}>
      <div className="flex items-center gap-3.5">
        <span className="relative flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[rgb(0_80_240_/_0.08)] text-blue">
          <Icon size={20} strokeWidth={2} aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-blue font-heading text-[11px] font-bold text-white"
          >
            {step}
          </span>
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold tracking-tight text-ink">{label}</h2>
          <p className="text-[13px] text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** The field's name, with "Required" as a small blue tag or "Optional" as a quiet one. */
function FieldLabel({ htmlFor, label, required = false }: { htmlFor: string; label: string; required?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 font-heading text-sm font-semibold text-ink" htmlFor={htmlFor}>
      {label}
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
          required ? "bg-[rgb(0_80_240_/_0.08)] text-blue" : "bg-[var(--ms-bg-card)] text-faint",
        )}
      >
        {required ? "Required" : "Optional"}
      </span>
    </label>
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
      <FieldLabel htmlFor={name} label={label} required={required} />
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
