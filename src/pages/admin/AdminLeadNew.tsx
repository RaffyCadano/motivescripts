import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { ArrowLeft, ArrowRight, Building2, ClipboardCheck, MessageSquareText, UserRound } from "lucide-react";
import { adminBlueBtn, adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { AdminFormCard } from "@/components/admin/AdminFormCard";
import { AdminWizardSteps } from "@/components/admin/AdminWizardSteps";
import { LeadStatusBadge } from "@/components/admin/leads/LeadStatusBadge";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { leadIndustries, referralSources, type LeadIndustry, type ReferralSource } from "@/data/leads";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

type FieldKey = "name" | "businessName" | "email" | "request" | "projectDetails";
type FieldErrors = Partial<Record<FieldKey, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WIZARD_STEPS = ["Contact", "Business", "Inquiry", "Review"] as const;
/** The required fields on each step; Business has none and Review is only a summary. */
const STEP_FIELDS: Record<number, FieldKey[]> = {
  0: ["name", "businessName", "email"],
  2: ["request", "projectDetails"],
};

export function AdminLeadNew() {
  const { addLead, notify } = useLeads();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState<LeadIndustry>("Other");
  const [referralSource, setReferralSource] = useState<ReferralSource | "">("");
  const [referralSourceOther, setReferralSourceOther] = useState("");
  const [request, setRequest] = useState("");
  const [projectDetails, setProjectDetails] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);

  function clearError(key: FieldKey) {
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function collectErrors(): FieldErrors {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = "Enter the primary contact name.";
    if (!businessName.trim()) next.businessName = "Enter the business or organization making the inquiry.";
    if (!email.trim()) next.email = "Enter the lead's email.";
    else if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address.";
    if (!request.trim()) next.request = "Enter what this prospect needs.";
    if (!projectDetails.trim()) next.projectDetails = "Enter the project inquiry details.";
    return next;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const nextErrors = collectErrors();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setBusy(true);
    try {
      const lead = await addLead({
        name,
        businessName,
        email,
        phone,
        industry,
        request,
        projectDetails,
        referralSource: referralSource || null,
        referralSourceOther: referralSource === "Other" ? referralSourceOther : "",
      });
      if (!lead) {
        setBusy(false);
        return;
      }
      navigate(`/admin/leads/${lead.id}`);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to create this lead.");
      setBusy(false);
    }
  }

  /** The required fields on each step (steps without any are never blocked). */
  function stepErrors(index: number): FieldErrors {
    const all = collectErrors();
    const next: FieldErrors = {};
    for (const key of STEP_FIELDS[index] ?? []) {
      if (all[key]) next[key] = all[key];
    }
    return next;
  }

  /** The earliest incomplete step before `target`, or null when the person may go there. */
  function blockedStep(target: number): number | null {
    for (let index = 0; index < target; index += 1) {
      if (Object.keys(stepErrors(index)).length > 0) return index;
    }
    return null;
  }

  function goToStep(target: number) {
    const blocked = blockedStep(target);
    if (blocked !== null) {
      setErrors(stepErrors(blocked));
      setStep(blocked);
    } else {
      setStep(target);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onFormSubmit(event: FormEvent) {
    event.preventDefault();
    // Enter inside a field on an earlier step means "next", not "add the lead".
    if (step < WIZARD_STEPS.length - 1) {
      goToStep(step + 1);
      return;
    }
    void onSubmit(event);
  }

  const hasFieldErrors = (STEP_FIELDS[step] ?? []).some((key) => errors[key]);
  const lastStep = step === WIZARD_STEPS.length - 1;
  const reviewRows: { label: string; value: string; go: number; long?: boolean }[] = [
    { label: "Name", value: name.trim(), go: 0 },
    { label: "Business name", value: businessName.trim(), go: 0 },
    { label: "Email", value: email.trim(), go: 0 },
    { label: "Phone", value: phone.trim() || "Not provided", go: 0 },
    { label: "Industry", value: industry, go: 1 },
    {
      label: "Heard about us",
      value: referralSource ? (referralSource === "Other" && referralSourceOther.trim() ? `Other: ${referralSourceOther.trim()}` : referralSource) : "Unknown",
      go: 1,
    },
    { label: "What they need", value: request.trim(), go: 2 },
    { label: "Project details", value: projectDetails.trim(), go: 2, long: true },
  ];

  return (
    <div className="space-y-5">
      <Link to="/admin/leads" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Leads
      </Link>
      <AdminPageHeader
        title="Add Lead"
        description="Create a lead from a new project inquiry or potential client."
      />

      {!hasPermission(profile, "leads.manage") ? (
        <p className="text-sm text-[var(--admin-muted)]">You don’t have permission to add leads.</p>
      ) : (
        <form noValidate className="grid w-full max-w-3xl gap-4" onSubmit={onFormSubmit}>
          <AdminWizardSteps steps={WIZARD_STEPS} current={step} onGo={goToStep} hint="Takes about a minute" />

          {hasFieldErrors ? (
            <p
              role="alert"
              className="rounded-lg border border-[rgb(180_35_24_/_0.22)] bg-[rgb(220_38_38_/_0.06)] px-3 py-2 text-sm font-semibold text-[#b42318]"
            >
              Complete the required fields marked below. Your other entries are still here.
            </p>
          ) : null}

          {step === 0 ? (
            <AdminFormCard icon={UserRound} title="Contact" description="Who made the inquiry and how to reach them.">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="lead-name" label="Name" hint="Primary contact for this inquiry." error={errors.name}>
                  <input
                    id="lead-name"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      clearError("name");
                    }}
                    className={fieldClass(errors.name)}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? "lead-name-error" : "lead-name-hint"}
                  />
                </FormField>
                <FormField
                  id="lead-business-name"
                  label="Business name"
                  hint="The business or organization making the inquiry."
                  error={errors.businessName}
                >
                  <input
                    id="lead-business-name"
                    autoComplete="organization"
                    value={businessName}
                    onChange={(event) => {
                      setBusinessName(event.target.value);
                      clearError("businessName");
                    }}
                    className={fieldClass(errors.businessName)}
                    aria-invalid={Boolean(errors.businessName)}
                    aria-describedby={errors.businessName ? "lead-business-name-error" : "lead-business-name-hint"}
                  />
                </FormField>
                <FormField id="lead-email" label="Email" hint="Primary email for communicating with this lead." error={errors.email}>
                  <input
                    id="lead-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      clearError("email");
                    }}
                    className={fieldClass(errors.email)}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "lead-email-error" : "lead-email-hint"}
                  />
                </FormField>
                <FormField id="lead-phone" label="Phone" optional hint="Optional phone number.">
                  <input
                    id="lead-phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className={fieldClass()}
                    aria-describedby="lead-phone-hint"
                  />
                </FormField>
              </div>
            </AdminFormCard>
          ) : null}

          {step === 1 ? (
            <AdminFormCard icon={Building2} title="Business" description="What the business does and where the inquiry came from.">
              <FormField id="lead-industry" label="Industry" hint="What kind of business is this?">
                <select
                  id="lead-industry"
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value as LeadIndustry)}
                  className={fieldClass()}
                  aria-describedby="lead-industry-hint"
                >
                  {leadIndustries.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id="lead-referral-source" label="How did they hear about us?" optional hint="Marketing attribution for this inquiry.">
                <select
                  id="lead-referral-source"
                  value={referralSource}
                  onChange={(event) => setReferralSource(event.target.value as ReferralSource | "")}
                  className={fieldClass()}
                  aria-describedby="lead-referral-source-hint"
                >
                  <option value="">Unknown</option>
                  {referralSources.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </FormField>
              {referralSource === "Other" ? (
                <FormField id="lead-referral-source-other" label="Referral detail" optional hint="Where specifically did they hear about us?">
                  <input
                    id="lead-referral-source-other"
                    value={referralSourceOther}
                    onChange={(event) => setReferralSourceOther(event.target.value)}
                    className={fieldClass()}
                  />
                </FormField>
              ) : null}
            </AdminFormCard>
          ) : null}

          {step === 2 ? (
            <AdminFormCard icon={MessageSquareText} title="Project inquiry" description="What the prospect is asking for. This is an inquiry, not an approved scope.">
              <FormField id="lead-request" label="What do you need?" hint="A short description of what the prospect wants." error={errors.request}>
                <input
                  id="lead-request"
                  value={request}
                  onChange={(event) => {
                    setRequest(event.target.value);
                    clearError("request");
                  }}
                  className={fieldClass(errors.request)}
                  aria-invalid={Boolean(errors.request)}
                  aria-describedby={errors.request ? "lead-request-error" : "lead-request-hint"}
                />
              </FormField>
              <FormField
                id="lead-project-details"
                label="Project details"
                hint="Tell us what the prospect is looking for, including goals, requested features, services, or other useful requirements. This is an inquiry, not an approved scope."
                error={errors.projectDetails}
              >
                <textarea
                  id="lead-project-details"
                  rows={5}
                  value={projectDetails}
                  onChange={(event) => {
                    setProjectDetails(event.target.value);
                    clearError("projectDetails");
                  }}
                  className={textareaClass(errors.projectDetails)}
                  aria-invalid={Boolean(errors.projectDetails)}
                  aria-describedby={errors.projectDetails ? "lead-project-details-error" : "lead-project-details-hint"}
                />
              </FormField>
            </AdminFormCard>
          ) : null}

          {step === 3 ? (
            <>
              <AdminFormCard icon={ClipboardCheck} title="Review and add" description="Check the details. Use Edit to change anything before the lead is created.">
                <dl className="divide-y divide-[var(--admin-line)] rounded-lg border border-[var(--admin-line)]">
                  {reviewRows.map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <dt className="text-[12px] text-[var(--admin-muted)]">{row.label}</dt>
                        <dd
                          className={
                            row.long
                              ? "mt-0.5 line-clamp-6 whitespace-pre-wrap break-words text-sm text-[var(--admin-ink)]"
                              : "mt-0.5 break-words text-sm font-semibold text-[var(--admin-ink)]"
                          }
                        >
                          {row.value}
                        </dd>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                        onClick={() => goToStep(row.go)}
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </dl>
                <div className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <LeadStatusBadge status="New" />
                    <p className="text-sm text-[var(--admin-ink)]">New leads start with status New.</p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--admin-muted)]">
                    Status is set automatically. You progress the lead later from the lead record.
                  </p>
                </div>
              </AdminFormCard>
              <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6">
                <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">What happens next</h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--admin-muted)]">
                  Leads are the starting point for the MotiveScripts sales workflow. Qualify the inquiry before converting it into a
                  client. Creating a lead does not start production or create later records.
                </p>
              </section>
            </>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            {step > 0 ? (
              <button type="button" disabled={busy} className={adminGhostBtn} onClick={() => goToStep(step - 1)}>
                <ArrowLeft size={15} aria-hidden="true" className="mr-1.5" />
                Back
              </button>
            ) : (
              <Link to="/admin/leads" className={adminGhostBtn}>
                Cancel
              </Link>
            )}
            {lastStep ? (
              <button type="submit" disabled={busy} className={adminPrimaryBtn}>
                {busy ? "Creating…" : "Add Lead"}
              </button>
            ) : (
              <button type="submit" className={adminBlueBtn}>
                Next
                <ArrowRight size={15} aria-hidden="true" className="ml-1.5" />
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function fieldClass(error?: string) {
  return cn(
    "mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm font-normal text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]",
    error ? "border-[rgb(180_35_24_/_0.45)]" : "border-[var(--admin-line)]",
  );
}

function textareaClass(error?: string) {
  return cn(
    "mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]",
    error ? "border-[rgb(180_35_24_/_0.45)]" : "border-[var(--admin-line)]",
  );
}

function FormField({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-[var(--admin-ink)]">
        {label}
        {optional ? <span className="ml-1.5 text-xs font-normal text-[var(--admin-muted)]">Optional</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-[#b42318]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs font-normal text-[var(--admin-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
