import { useEffect, useState, type FormEvent } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import {
  clientStatuses,
  type AgencyClient,
  type AgencyClientEdits,
  type AgencyClientStatus,
} from "@/data/agencyClients";
import { leadIndustries, type LeadIndustry } from "@/data/leads";

const emptyDraft: AgencyClientEdits = {
  contactName: "",
  businessName: "",
  email: "",
  phone: "",
  industry: "Other",
  website: "",
  location: "",
  status: "Active",
};

const fieldClass =
  "mt-1.5 h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]";

type ClientFormModalProps = {
  open: boolean;
  client?: AgencyClient | null;
  onClose: () => void;
  onSubmit: (values: AgencyClientEdits) => void;
};

export function ClientFormModal({ open, client, onClose, onSubmit }: ClientFormModalProps) {
  const [draft, setDraft] = useState<AgencyClientEdits>(emptyDraft);

  useEffect(() => {
    if (!open) return;
    if (client) {
      setDraft({
        contactName: client.contactName,
        businessName: client.businessName,
        email: client.email,
        phone: client.phone === "—" ? "" : client.phone,
        industry: client.industry,
        website: client.website,
        location: client.location,
        status: client.status,
      });
      return;
    }
    setDraft(emptyDraft);
  }, [client, open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(draft);
    onClose();
  }

  return (
    <AdminDialog
      open={open}
      title="Edit Client"
      description="Update this client’s contact and business details."
      onClose={onClose}
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Contact name"
            value={draft.contactName}
            onChange={(value) => setDraft((current) => ({ ...current, contactName: value }))}
            required
          />
          <Field
            label="Business name"
            value={draft.businessName}
            onChange={(value) => setDraft((current) => ({ ...current, businessName: value }))}
            required
          />
          <Field
            label="Email"
            type="email"
            value={draft.email}
            onChange={(value) => setDraft((current) => ({ ...current, email: value }))}
            required
          />
          <Field
            label="Phone"
            type="tel"
            value={draft.phone}
            onChange={(value) => setDraft((current) => ({ ...current, phone: value }))}
          />
        </div>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Industry
          <select
            required
            className={fieldClass}
            value={draft.industry}
            onChange={(event) => setDraft((current) => ({ ...current, industry: event.target.value as LeadIndustry }))}
          >
            {leadIndustries.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Website"
          value={draft.website}
          onChange={(value) => setDraft((current) => ({ ...current, website: value }))}
          placeholder="https://"
        />
        <Field
          label="Location"
          value={draft.location}
          onChange={(value) => setDraft((current) => ({ ...current, location: value }))}
        />
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Status
          <select
            required
            className={fieldClass}
            value={draft.status}
            onChange={(event) =>
              setDraft((current) => ({ ...current, status: event.target.value as AgencyClientStatus }))
            }
          >
            {clientStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--admin-bright)]"
          >
            Save changes
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
    </label>
  );
}
