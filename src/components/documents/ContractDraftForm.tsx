import { AdminInfoTip } from "@/components/admin/AdminInfoTip";

export type ContractDraftFormValue = {
  title: string;
  parties: string;
  scope: string;
  responsibilities: string;
  timeline: string;
  compensation: string;
  paymentTerms: string;
  confidentiality: string;
  intellectualProperty: string;
  revisionsPolicy: string;
  termination: string;
  generalTerms: string;
  effectiveDate: string;
  expiresAt: string;
  adminNotes: string;
};

export const emptyContractDraft = (): ContractDraftFormValue => ({
  title: "",
  parties: "",
  scope: "",
  responsibilities: "",
  timeline: "",
  compensation: "",
  paymentTerms: "",
  confidentiality: "",
  intellectualProperty: "",
  revisionsPolicy: "",
  termination: "",
  generalTerms: "",
  effectiveDate: "",
  expiresAt: "",
  adminNotes: "",
});

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)] disabled:bg-[var(--admin-bg)]";

export function ContractDraftForm({
  value,
  disabled,
  onChange,
}: {
  value: ContractDraftFormValue;
  disabled?: boolean;
  onChange: (value: ContractDraftFormValue) => void;
}) {
  const patch = (next: Partial<ContractDraftFormValue>) => onChange({ ...value, ...next });

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-[var(--admin-muted)]">
        Starting copy is a template for workflow only. Edit it before sending. This is not legal advice.
      </p>
      <Field label="Title" value={value.title} disabled={disabled} onChange={(title) => patch({ title })} />
      <Area label="Parties" value={value.parties} disabled={disabled} onChange={(parties) => patch({ parties })} />
      <Area label="Scope" value={value.scope} disabled={disabled} onChange={(scope) => patch({ scope })} />
      <Area
        label="Responsibilities"
        value={value.responsibilities}
        disabled={disabled}
        onChange={(responsibilities) => patch({ responsibilities })}
      />
      <Area label="Timeline" value={value.timeline} disabled={disabled} onChange={(timeline) => patch({ timeline })} />
      <Area
        label="Compensation"
        value={value.compensation}
        disabled={disabled}
        onChange={(compensation) => patch({ compensation })}
      />
      <Area
        label="Payment terms"
        value={value.paymentTerms}
        disabled={disabled}
        onChange={(paymentTerms) => patch({ paymentTerms })}
      />
      <Area
        label="Confidentiality"
        value={value.confidentiality}
        disabled={disabled}
        onChange={(confidentiality) => patch({ confidentiality })}
      />
      <Area
        label="Intellectual property"
        value={value.intellectualProperty}
        disabled={disabled}
        onChange={(intellectualProperty) => patch({ intellectualProperty })}
      />
      <Area
        label="Revisions"
        value={value.revisionsPolicy}
        disabled={disabled}
        onChange={(revisionsPolicy) => patch({ revisionsPolicy })}
      />
      <Area
        label="Termination"
        value={value.termination}
        disabled={disabled}
        onChange={(termination) => patch({ termination })}
      />
      <Area
        label="General terms"
        value={value.generalTerms}
        disabled={disabled}
        onChange={(generalTerms) => patch({ generalTerms })}
      />
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <label htmlFor="contract-effective-date">Effective date</label>
          <AdminInfoTip text="The calendar day this agreement starts. Saved as that day, not a timestamp." />
        </p>
        <input
          id="contract-effective-date"
          type="date"
          disabled={disabled}
          value={value.effectiveDate}
          onChange={(event) => patch({ effectiveDate: event.target.value })}
          className={fieldClass}
        />
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <label htmlFor="contract-valid-until">Valid until</label>
          <AdminInfoTip text="Last day the client can accept this revision. Defaults to 30 days. After that it expires. This is not the end of the project." />
        </p>
        <input
          id="contract-valid-until"
          type="date"
          disabled={disabled}
          min={value.effectiveDate || undefined}
          value={value.expiresAt}
          onChange={(event) => patch({ expiresAt: event.target.value })}
          className={fieldClass}
        />
      </div>
      <Area
        label="Internal notes (not shown to the client)"
        value={value.adminNotes}
        disabled={disabled}
        onChange={(adminNotes) => patch({ adminNotes })}
      />
    </div>
  );
}

function Field(props: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-semibold">
      {props.label}
      <input
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
        className={fieldClass}
      />
    </label>
  );
}

function Area(props: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-semibold">
      {props.label}
      <textarea
        value={props.value}
        disabled={props.disabled}
        rows={4}
        onChange={(event) => props.onChange(event.target.value)}
        className={fieldClass}
      />
    </label>
  );
}
