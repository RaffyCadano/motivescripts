import { useState, type FormEvent } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { leadIndustries, type LeadDraft, type LeadIndustry } from "@/data/leads";

const emptyDraft: LeadDraft = {
  name: "",
  businessName: "",
  email: "",
  phone: "",
  industry: "Other",
  request: "",
  projectDetails: "",
};

const fieldClass =
  "mt-1.5 h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]";

type AddLeadModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (draft: LeadDraft) => void;
};

export function AddLeadModal({ open, onClose, onSubmit }: AddLeadModalProps) {
  const [draft, setDraft] = useState<LeadDraft>(emptyDraft);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(draft);
    setDraft(emptyDraft);
    onClose();
  }

  return (
    <AdminDialog
      open={open}
      title="Add Lead"
      description="Create a lead. It is saved to the agency database."
      onClose={() => {
        setDraft(emptyDraft);
        onClose();
      }}
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} required />
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
          <Field label="Phone" type="tel" value={draft.phone} onChange={(value) => setDraft((current) => ({ ...current, phone: value }))} />
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
          label="What do you need?"
          value={draft.request}
          onChange={(value) => setDraft((current) => ({ ...current, request: value }))}
          required
        />
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Project details
          <textarea
            required
            rows={3}
            className="mt-1.5 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            value={draft.projectDetails}
            onChange={(event) => setDraft((current) => ({ ...current, projectDetails: event.target.value }))}
          />
        </label>
        <p className="text-[12px] text-[var(--admin-muted)]">New leads start with status New.</p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
            onClick={() => {
              setDraft(emptyDraft);
              onClose();
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--admin-bright)]"
          >
            Add Lead
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
    </label>
  );
}
