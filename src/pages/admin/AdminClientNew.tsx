import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { ArrowLeft, ArrowRight, Building2, ClipboardCheck, UserRound } from "lucide-react";
import { adminBlueBtn, adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { AdminFormCard } from "@/components/admin/AdminFormCard";
import { AdminWizardSteps } from "@/components/admin/AdminWizardSteps";
import { ClientStatusBadge } from "@/components/admin/clients/ClientStatusBadge";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { leadIndustries, type LeadIndustry } from "@/data/leads";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

type FieldKey = "contactName" | "businessName" | "email";
type FieldErrors = Partial<Record<FieldKey, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WIZARD_STEPS = ["Contact", "Business", "Review"] as const;
/** The client workflow after the record exists; none of these are created automatically. */
const NEXT_STEPS = ["Portal", "Scope", "Project", "Proposal", "Contract", "Invoice"] as const;

export function AdminClientNew() {
  const { addClient, notify } = useLeads();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState<LeadIndustry>("Other");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
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
    if (!contactName.trim()) next.contactName = "Enter the primary contact name.";
    if (!businessName.trim()) next.businessName = "Enter the client's business or organization name.";
    if (!email.trim()) next.email = "Enter the client's email.";
    else if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address.";
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
      const client = await addClient({
        contactName,
        businessName,
        email,
        phone,
        industry,
        website,
        location,
      });
      if (!client) {
        setBusy(false);
        return;
      }
      navigate(`/admin/clients/${client.id}`);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to create this client.");
      setBusy(false);
    }
  }

  /** The earliest step that is incomplete before `target`, or null when the person may go there. Only Contact has required fields. */
  function blockedStep(target: number): number | null {
    if (target > 0 && Object.keys(collectErrors()).length > 0) return 0;
    return null;
  }

  function goToStep(target: number) {
    const blocked = blockedStep(target);
    if (blocked !== null) {
      setErrors(collectErrors());
      setStep(blocked);
    } else {
      setStep(target);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onFormSubmit(event: FormEvent) {
    event.preventDefault();
    // Enter inside a field on an earlier step means "next", not "add the client".
    if (step < WIZARD_STEPS.length - 1) {
      goToStep(step + 1);
      return;
    }
    void onSubmit(event);
  }

  const hasFieldErrors = Object.keys(errors).length > 0;
  const lastStep = step === WIZARD_STEPS.length - 1;
  const reviewRows: { label: string; value: string; go: number }[] = [
    { label: "Contact name", value: contactName.trim(), go: 0 },
    { label: "Business name", value: businessName.trim(), go: 0 },
    { label: "Email", value: email.trim(), go: 0 },
    { label: "Phone", value: phone.trim() || "Not provided", go: 0 },
    { label: "Industry", value: industry, go: 1 },
    { label: "Website", value: website.trim() || "Not provided", go: 1 },
    { label: "Location", value: location.trim() || "Not provided", go: 1 },
  ];

  return (
    <div className="space-y-5">
      <Link to="/admin/clients" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Clients
      </Link>
      <AdminPageHeader
        title="Add Client"
        description="Create a client record to begin managing their agency relationship."
      />

      {!hasPermission(profile, "clients.manage") ? (
        <p className="text-sm text-[var(--admin-muted)]">You don’t have permission to add clients.</p>
      ) : (
        <form noValidate className="grid w-full gap-4" onSubmit={onFormSubmit}>
          <AdminWizardSteps steps={WIZARD_STEPS} current={step} onGo={goToStep} hint="Takes about a minute" />

          {hasFieldErrors && step === 0 ? (
            <p
              role="alert"
              className="rounded-lg border border-[rgb(180_35_24_/_0.22)] bg-[rgb(220_38_38_/_0.06)] px-3 py-2 text-sm font-semibold text-[#b42318]"
            >
              Complete the required fields marked below. Your other entries are still here.
            </p>
          ) : null}

          {step === 0 ? (
            <AdminFormCard icon={UserRound} title="Contact" description="Who we deal with, and where the portal invitation goes.">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="client-contact-name"
                  label="Contact name"
                  hint="Primary contact for this client."
                  error={errors.contactName}
                >
                  <input
                    id="client-contact-name"
                    autoComplete="name"
                    value={contactName}
                    onChange={(event) => {
                      setContactName(event.target.value);
                      clearError("contactName");
                    }}
                    className={fieldClass(errors.contactName)}
                    aria-invalid={Boolean(errors.contactName)}
                    aria-describedby={errors.contactName ? "client-contact-name-error" : "client-contact-name-hint"}
                  />
                </FormField>
                <FormField
                  id="client-business-name"
                  label="Business name"
                  hint="The client's business or organization name."
                  error={errors.businessName}
                >
                  <input
                    id="client-business-name"
                    autoComplete="organization"
                    value={businessName}
                    onChange={(event) => {
                      setBusinessName(event.target.value);
                      clearError("businessName");
                    }}
                    className={fieldClass(errors.businessName)}
                    aria-invalid={Boolean(errors.businessName)}
                    aria-describedby={errors.businessName ? "client-business-name-error" : "client-business-name-hint"}
                  />
                </FormField>
                <FormField
                  id="client-email"
                  label="Email"
                  hint="Primary email used for client communication and portal access."
                  error={errors.email}
                >
                  <input
                    id="client-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      clearError("email");
                    }}
                    className={fieldClass(errors.email)}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "client-email-error" : "client-email-hint"}
                  />
                </FormField>
                <FormField id="client-phone" label="Phone" optional hint="Optional phone number for the primary contact.">
                  <input
                    id="client-phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className={fieldClass()}
                    aria-describedby="client-phone-hint"
                  />
                </FormField>
              </div>
            </AdminFormCard>
          ) : null}

          {step === 1 ? (
            <AdminFormCard icon={Building2} title="Business" description="What the business does and where to find it. All optional except the industry, which starts as Other.">
              <FormField id="client-industry" label="Industry" hint="What kind of business is this?">
                <select
                  id="client-industry"
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value as LeadIndustry)}
                  className={fieldClass()}
                  aria-describedby="client-industry-hint"
                >
                  {leadIndustries.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="client-website" label="Website" optional hint="Client's existing website, if they have one.">
                  <input
                    id="client-website"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                    className={fieldClass()}
                    aria-describedby="client-website-hint"
                  />
                </FormField>
                <FormField id="client-location" label="Location" optional hint="Business location or service area.">
                  <input
                    id="client-location"
                    autoComplete="address-level2"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    className={fieldClass()}
                    aria-describedby="client-location-hint"
                  />
                </FormField>
              </div>
            </AdminFormCard>
          ) : null}

          {step === 2 ? (
            <>
              <AdminFormCard icon={ClipboardCheck} title="Review and add" description="Check the details. Use Edit to change anything before the client is created.">
                <dl className="divide-y divide-[var(--admin-line)] rounded-lg border border-[var(--admin-line)]">
                  {reviewRows.map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <dt className="text-[12px] text-[var(--admin-muted)]">{row.label}</dt>
                        <dd className="mt-0.5 break-words text-sm font-semibold text-[var(--admin-ink)]">{row.value}</dd>
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
                    <ClientStatusBadge status="Active" />
                    <p className="text-sm text-[var(--admin-ink)]">New clients start as Active.</p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--admin-muted)]">
                    Status is set automatically. You can change it later from the client profile.
                  </p>
                </div>
              </AdminFormCard>

              <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6">
                <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">What happens next</h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--admin-muted)]">
                  Creating the client is only the first step. Continue the workflow from their profile. These records are not
                  created automatically.
                </p>
                <ol className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-2">
                  {NEXT_STEPS.map((label, index) => (
                    <li key={label} className="flex items-center gap-1.5">
                      <span className="rounded-full bg-[rgb(0_80_240_/_0.08)] px-2.5 py-1 font-heading text-[12px] font-semibold text-[var(--admin-blue)]">
                        {label}
                      </span>
                      {index < NEXT_STEPS.length - 1 ? <ArrowRight size={13} className="text-[var(--admin-muted)]" aria-hidden="true" /> : null}
                    </li>
                  ))}
                </ol>
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
              <Link to="/admin/clients" className={adminGhostBtn}>
                Cancel
              </Link>
            )}
            {lastStep ? (
              <button type="submit" disabled={busy} className={adminPrimaryBtn}>
                {busy ? "Creating…" : "Add Client"}
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
