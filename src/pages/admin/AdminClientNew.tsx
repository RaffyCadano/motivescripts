import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
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

  const hasFieldErrors = Object.keys(errors).length > 0;

  return (
    <div className="space-y-5">
      <Link to="/admin/clients" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Clients
      </Link>
      <AdminPageHeader
        title="Add Client"
        description="Create a client record to begin managing their agency relationship."
      />
      <p className="max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
        Create the client record first. Then continue the client workflow from their profile: Portal → Scope → Project →
        Proposal → Contract → Invoice. Those records are not created automatically.
      </p>

      {!hasPermission(profile, "clients.manage") ? (
        <p className="text-sm text-[var(--admin-muted)]">You don’t have permission to add clients.</p>
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
              <FormField
                id="client-phone"
                label="Phone"
                optional
                hint="Optional phone number for the primary contact."
              >
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
          </div>

          <div className="space-y-4 border-t border-[var(--admin-line)] pt-6">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Business</h2>
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
              <FormField
                id="client-website"
                label="Website"
                optional
                hint="Client's existing website, if they have one."
              >
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
              <FormField
                id="client-location"
                label="Location"
                optional
                hint="Business location or service area."
              >
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
          </div>

          <div className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <ClientStatusBadge status="Active" />
              <p className="text-sm text-[var(--admin-ink)]">New clients start as Active.</p>
            </div>
            <p className="mt-1 text-xs text-[var(--admin-muted)]">
              Status is set automatically. You can change it later from the client profile.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--admin-line)] pt-5 sm:flex-row sm:justify-end">
            <Link to="/admin/clients" className={`${adminGhostBtn} justify-center`}>
              Cancel
            </Link>
            <button type="submit" disabled={busy} className={`${adminPrimaryBtn} justify-center`}>
              {busy ? "Creating…" : "Add Client"}
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
