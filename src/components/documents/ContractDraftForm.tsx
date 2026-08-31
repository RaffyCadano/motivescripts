import type { ReactNode } from "react";
import { AdminInfoTip } from "@/components/admin/AdminInfoTip";
import { fiftyFiftySplit } from "@/components/documents/ContractDocumentView";
import { formatUsdFromCents } from "@/data/money";
import { partitionScopeLines } from "@/data/proposalPresets";

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

export type ContractProposalRef = {
  id: string;
  number: string;
  revisionNumber: number;
  investmentCents: number;
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
  includeTitle = true,
  includeDates = true,
  includeNotes = true,
  proposal,
}: {
  value: ContractDraftFormValue;
  disabled?: boolean;
  onChange: (value: ContractDraftFormValue) => void;
  includeTitle?: boolean;
  includeDates?: boolean;
  includeNotes?: boolean;
  proposal?: ContractProposalRef | null;
}) {
  const patch = (next: Partial<ContractDraftFormValue>) => onChange({ ...value, ...next });
  const scope = partitionScopeLines(value.scope);
  const hasStructuredScope = scope.pages.length + scope.features.length + scope.other.length > 0;
  const investment = proposal && proposal.investmentCents > 0 ? proposal.investmentCents : null;
  const schedule = investment != null ? fiftyFiftySplit(investment) : null;

  return (
    <div className="space-y-6">
      <p className="text-[12px] leading-5 text-[var(--admin-muted)]">
        Starting copy is a template for workflow only. Edit it before sending. This is not legal advice.
      </p>

      <EditorCard title="Agreement Content" helper="The terms the client will review and accept in the portal.">
        {includeTitle ? (
          <Field label="Title" value={value.title} disabled={disabled} onChange={(title) => patch({ title })} />
        ) : null}
        <Area label="Parties" value={value.parties} disabled={disabled} onChange={(parties) => patch({ parties })} />

        <div>
          <p className="text-sm font-semibold">Agreed Scope</p>
          {proposal ? (
            <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">
              Carried forward from accepted proposal {proposal.number}
              {proposal.revisionNumber ? ` · Revision ${proposal.revisionNumber}` : ""}.
            </p>
          ) : (
            <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">
              The pages and functionality included in this agreement.
            </p>
          )}
          {hasStructuredScope ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <ScopeGroup title="Pages & Design" lines={[...scope.pages, ...scope.other]} />
              <ScopeGroup title="Functionality" lines={scope.features} />
            </div>
          ) : null}
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-900">
            Changes to the agreed scope may require an updated proposal. Editing here does not change the original client
            scope or the accepted proposal.
          </p>
          <textarea
            value={value.scope}
            disabled={disabled}
            rows={8}
            onChange={(event) => patch({ scope: event.target.value })}
            className={fieldClass}
          />
        </div>

        <Area
          label="Responsibilities"
          value={value.responsibilities}
          disabled={disabled}
          onChange={(responsibilities) => patch({ responsibilities })}
        />
        <Area
          label="Estimated Project Timeline"
          hint="Timeline may change based on content delivery, feedback, approvals, and project requirements."
          value={value.timeline}
          disabled={disabled}
          rows={8}
          onChange={(timeline) => patch({ timeline })}
        />

        <div>
          <p className="text-sm font-semibold">Compensation</p>
          {investment != null ? (
            <div className="mt-3 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                Total Project Investment
              </p>
              <p className="mt-1 font-heading text-2xl font-semibold text-[var(--admin-ink)]">
                {formatUsdFromCents(investment)}
              </p>
              {schedule ? (
                <ul className="mt-3 space-y-1 text-sm text-[var(--admin-muted)]">
                  <li>50% deposit — {formatUsdFromCents(schedule.depositCents)}</li>
                  <li>50% final payment — {formatUsdFromCents(schedule.remainderCents)}</li>
                </ul>
              ) : null}
              <p className="mt-2 text-[12px] leading-5 text-[var(--admin-muted)]">
                This amount corresponds to the accepted proposal. It is shown for clarity and is not a separate billing
                engine.
              </p>
            </div>
          ) : null}
          <Area
            label="Compensation notes"
            value={value.compensation}
            disabled={disabled}
            onChange={(compensation) => patch({ compensation })}
          />
        </div>

        <div>
          <p className="text-sm font-semibold">Payment Terms</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--admin-line)] bg-white p-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">Deposit</p>
              <p className="mt-1 text-sm text-[var(--admin-ink)]">50% due before work begins.</p>
            </div>
            <div className="rounded-lg border border-[var(--admin-line)] bg-white p-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
                Final payment
              </p>
              <p className="mt-1 text-sm text-[var(--admin-ink)]">Remaining 50% due before the website goes live.</p>
            </div>
          </div>
          <p className="mt-2 text-[12px] leading-5 text-[var(--admin-muted)]">
            The headings above describe the usual schedule. The saved terms below are what the client agrees to unless
            you edit them.
          </p>
          <Area
            label="Payment terms"
            value={value.paymentTerms}
            disabled={disabled}
            rows={7}
            onChange={(paymentTerms) => patch({ paymentTerms })}
          />
        </div>

        <Area
          label="Confidentiality"
          value={value.confidentiality}
          disabled={disabled}
          onChange={(confidentiality) => patch({ confidentiality })}
        />
        <Area
          label="Intellectual Property"
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
          label="General Terms"
          value={value.generalTerms}
          disabled={disabled}
          onChange={(generalTerms) => patch({ generalTerms })}
        />
      </EditorCard>

      {includeDates ? (
        <EditorCard title="Dates">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <label htmlFor="contract-effective-date">Effective date</label>
              <AdminInfoTip text="The calendar day this agreement starts after acceptance. Saved as that day, not a timestamp." />
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--admin-muted)]">
              The date this agreement becomes effective after acceptance.
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
              <AdminInfoTip text="Last day the client can accept this revision. After that it expires. This is not the end of the project." />
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--admin-muted)]">
              The date through which this contract may be accepted.
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
        </EditorCard>
      ) : null}

      {includeNotes ? (
        <EditorCard
          title="Internal Notes"
          helper="Staff only — never shown to the client. Not included on the proposal, contract preview, PDF, or client portal."
        >
          <Area
            label="Internal notes (not shown to the client)"
            value={value.adminNotes}
            disabled={disabled}
            onChange={(adminNotes) => patch({ adminNotes })}
          />
        </EditorCard>
      ) : null}
    </div>
  );
}

function EditorCard({ title, helper, children }: { title: string; helper?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div>
        <h2 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{title}</h2>
        {helper ? <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">{helper}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ScopeGroup({ title, lines }: { title: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-[var(--admin-ink)]">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-emerald-700">✓</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
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

function Area(props: {
  label: string;
  hint?: string;
  value: string;
  disabled?: boolean;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold">
      {props.label}
      {props.hint ? <span className="mt-1 block font-medium text-[12px] leading-5 text-[var(--admin-muted)]">{props.hint}</span> : null}
      <textarea
        value={props.value}
        disabled={props.disabled}
        rows={props.rows ?? 4}
        onChange={(event) => props.onChange(event.target.value)}
        className={fieldClass}
      />
    </label>
  );
}
