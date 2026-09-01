import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { LeadStatusBadge } from "@/components/admin/leads/LeadStatusBadge";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { leadIndustries, type LeadIndustry } from "@/data/leads";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

type FieldKey = "name" | "businessName" | "email" | "request" | "projectDetails";
type FieldErrors = Partial<Record<FieldKey, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AdminLeadNew() {
  const { addLead, notify } = useLeads();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState<LeadIndustry>("Other");
  const [request, setRequest] = useState("");
  const [projectDetails, setProjectDetails] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

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

  const hasFieldErrors = Object.keys(errors).length > 0;

  return (
    <div className="space-y-5">
      <Link to="/admin/leads" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Leads
      </Link>
      <AdminPageHeader
        title="Add Lead"
        description="Create a lead from a new project inquiry or potential client."
      />
      <p className="max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
        Leads are the starting point for the MotiveScripts sales workflow. Qualify the inquiry before converting it into
        a client. Creating a lead does not start production or create later records.
      </p>

      {!hasPermission(profile, "leads.manage") ? (
        <p className="text-sm text-[var(--admin-muted)]">You don’t have permission to add leads.</p>
      ) : (
        <form
          noValidate
          className="w-full max-w-2xl space-y-6 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6"
          onSubmit={onSubmit}
        >
          {hasFieldErrors ? (
            <p
              role="alert"
              className="rounded-lg border border-[rgb(180_35_24_/_0.22)] bg-[rgb(220_38_38_/_0.06)] px-3 py-2 text-sm font-semibold text-[#b42318]"
            >
              Complete the required fields marked below. Your other entries are still here.
            </p>
          ) : null}

          <div className="space-y-4">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="lead-name"
                label="Name"
                hint="Primary contact for this inquiry."
                error={errors.name}
              >
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
              <FormField
                id="lead-email"
                label="Email"
                hint="Primary email for communicating with this lead."
                error={errors.email}
              >
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
          </div>

          <div className="space-y-4 border-t border-[var(--admin-line)] pt-6">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Business</h2>
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
          </div>

          <div className="space-y-4 border-t border-[var(--admin-line)] pt-6">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">
              Project inquiry
            </h2>
            <FormField
              id="lead-request"
              label="What do you need?"
              hint="A short description of what the prospect wants."
              error={errors.request}
            >
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
          </div>

          <div className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <LeadStatusBadge status="New" />
              <p className="text-sm text-[var(--admin-ink)]">New leads start with status New.</p>
            </div>
            <p className="mt-1 text-xs text-[var(--admin-muted)]">
              Status is set automatically. You progress the lead later from the lead record.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--admin-line)] pt-5 sm:flex-row sm:justify-end">
            <Link to="/admin/leads" className={`${adminGhostBtn} justify-center`}>
              Cancel
            </Link>
            <button type="submit" disabled={busy} className={`${adminPrimaryBtn} justify-center`}>
              {busy ? "Creating…" : "Add Lead"}
            </button>
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
