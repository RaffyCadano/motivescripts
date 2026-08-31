import type { ReactNode } from "react";
import { LineItemsEditor } from "@/components/documents/LineItemsEditor";
import { invoiceDraftTotalCents, type LineItemDraft } from "@/data/invoices";
import { centsInputValue, formatMoneyFromCents, parseDollarsToCents } from "@/data/money";

export type InvoiceDraftFormValue = {
  clientId: string;
  projectId: string;
  contractId: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  taxCents: number;
  discountCents: number;
  notes: string;
  adminNotes: string;
};

export type InvoiceDraftOption = { id: string; label: string; projectId?: string | null };

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)] disabled:bg-[var(--admin-bg)]";

export function InvoiceDraftForm({
  value,
  items,
  clients,
  projects,
  contracts,
  showClient = true,
  showAdminNotes = true,
  lockClient = false,
  lockProject = false,
  lockContract = false,
  disabled,
  lineItemsHelper,
  onChange,
  onItemsChange,
}: {
  value: InvoiceDraftFormValue;
  items: LineItemDraft[];
  clients: InvoiceDraftOption[];
  projects: InvoiceDraftOption[];
  contracts: InvoiceDraftOption[];
  showClient?: boolean;
  showAdminNotes?: boolean;
  lockClient?: boolean;
  lockProject?: boolean;
  lockContract?: boolean;
  disabled?: boolean;
  lineItemsHelper?: string;
  onChange: (value: InvoiceDraftFormValue) => void;
  onItemsChange: (items: LineItemDraft[]) => void;
}) {
  const totals = invoiceDraftTotalCents(items, value.taxCents, value.discountCents);
  const money = (cents: number) => formatMoneyFromCents(cents, value.currency || "USD");
  const selectedClient = clients.find((row) => row.id === value.clientId);
  const selectedProject = projects.find((row) => row.id === value.projectId);
  const selectedContract = contracts.find((row) => row.id === value.contractId);
  const projectContracts = contracts.filter((row) => row.projectId && row.projectId === value.projectId);
  const suggestedContract = !value.contractId && !lockContract && projectContracts.length === 1 ? projectContracts[0] : null;
  const clientSelected = Boolean(value.clientId);
  const lockedFromContract = lockContract && Boolean(value.contractId);

  return (
    <div className="space-y-6">
      <EditorCard
        title="Invoice Setup"
        helper={
          lockedFromContract
            ? "This invoice is based on the accepted contract. Client, project, and contract stay connected to the approved work."
            : "Invoices belong to a client. Link a project and the accepted contract when this charge is for that work."
        }
      >
        {lockedFromContract ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Client</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{selectedClient?.label ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Project</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                {selectedProject?.label ?? "No project linked"}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Based on accepted contract</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{selectedContract?.label ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Amount due</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{money(totals.total)}</dd>
            </div>
          </dl>
        ) : (
          <>
            {showClient ? (
              <label className="block text-sm font-semibold">
                Client
                <select
                  required
                  disabled={disabled || lockClient}
                  value={value.clientId}
                  onChange={(event) =>
                    onChange({ ...value, clientId: event.target.value, projectId: "", contractId: "" })
                  }
                  className={fieldClass}
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block text-sm font-semibold">
              Project <span className="font-medium text-[var(--admin-muted)]">(optional)</span>
              <span className="mt-1 block font-medium text-[12px] leading-5 text-[var(--admin-muted)]">
                Recommended when this invoice belongs to a project. Only this client’s projects are listed.
              </span>
              <select
                disabled={disabled || lockProject || !clientSelected}
                value={value.projectId}
                onChange={(event) => {
                  const projectId = event.target.value;
                  const current = contracts.find((row) => row.id === value.contractId);
                  const keepContract = current && (!current.projectId || current.projectId === projectId);
                  onChange({ ...value, projectId, contractId: keepContract ? value.contractId : "" });
                }}
                className={fieldClass}
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Contract <span className="font-medium text-[var(--admin-muted)]">(optional)</span>
              <span className="mt-1 block font-medium text-[12px] leading-5 text-[var(--admin-muted)]">
                Link this invoice to the accepted contract when applicable.
              </span>
              <select
                disabled={disabled || lockContract || !clientSelected}
                value={value.contractId}
                onChange={(event) => {
                  const contractId = event.target.value;
                  const selected = contracts.find((row) => row.id === contractId);
                  onChange({
                    ...value,
                    contractId,
                    projectId: lockProject ? value.projectId : selected?.projectId || value.projectId,
                  });
                }}
                className={fieldClass}
              >
                <option value="">No contract</option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.label}
                  </option>
                ))}
              </select>
            </label>
            {suggestedContract ? (
              <button
                type="button"
                disabled={disabled}
                className="font-heading text-sm font-semibold text-[var(--admin-blue)] hover:underline disabled:opacity-40"
                onClick={() =>
                  onChange({
                    ...value,
                    contractId: suggestedContract.id,
                    projectId: lockProject ? value.projectId : suggestedContract.projectId || value.projectId,
                  })
                }
              >
                Use accepted contract {suggestedContract.label}
              </button>
            ) : null}
          </>
        )}
      </EditorCard>

      <EditorCard title="Invoice dates" helper="Issue today by default. Due date follows the agency payment period and cannot be earlier than the issue date.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Issue date
            <span className="mt-1 block font-medium text-[12px] leading-5 text-[var(--admin-muted)]">
              The date this invoice is issued.
            </span>
            <input
              type="date"
              disabled={disabled}
              value={value.issueDate}
              onChange={(event) => {
                const issueDate = event.target.value;
                const dueDate = value.dueDate && issueDate && value.dueDate < issueDate ? issueDate : value.dueDate;
                onChange({ ...value, issueDate, dueDate });
              }}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-semibold">
            Due date
            <span className="mt-1 block font-medium text-[12px] leading-5 text-[var(--admin-muted)]">
              The date payment is due.
            </span>
            <input
              type="date"
              min={value.issueDate || undefined}
              disabled={disabled}
              value={value.dueDate}
              onChange={(event) => onChange({ ...value, dueDate: event.target.value })}
              className={fieldClass}
            />
          </label>
        </div>
        <label className="block text-sm font-semibold">
          Currency
          <select
            disabled={disabled}
            value={value.currency}
            onChange={(event) => onChange({ ...value, currency: event.target.value })}
            className={fieldClass}
          >
            <option value="USD">USD</option>
          </select>
        </label>
      </EditorCard>

      <EditorCard
        title="Line Items"
        helper="Add the services or deliverables being billed. Quantity × unit price is calculated in integer cents."
      >
        <p className="text-sm leading-6 text-[var(--admin-muted)]">
          {lineItemsHelper ??
            "This invoice bills the amount shown here. If payment terms are a deposit and a remainder, label this charge (for example “Website Design & Development — 50% Deposit”) and set that amount. Create another invoice later for the rest."}
        </p>
        <LineItemsEditor items={items} disabled={disabled} showSubtotal={false} onChange={onItemsChange} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Tax
            <input
              inputMode="decimal"
              disabled={disabled}
              value={centsInputValue(value.taxCents)}
              onChange={(event) => {
                const cents = parseDollarsToCents(event.target.value);
                if (cents == null) return;
                onChange({ ...value, taxCents: cents });
              }}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-semibold">
            Discount
            <input
              inputMode="decimal"
              disabled={disabled}
              value={centsInputValue(value.discountCents)}
              onChange={(event) => {
                const cents = parseDollarsToCents(event.target.value);
                if (cents == null) return;
                onChange({ ...value, discountCents: cents });
              }}
              className={fieldClass}
            />
          </label>
        </div>
        <dl className="space-y-2 border-t border-[var(--admin-line)] pt-4 text-sm">
          <div className="flex justify-between gap-4 text-[var(--admin-muted)]">
            <dt>Subtotal</dt>
            <dd>{money(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-[var(--admin-muted)]">
            <dt>Tax</dt>
            <dd>{money(totals.tax)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-[var(--admin-muted)]">
            <dt>Discount</dt>
            <dd>{totals.discount > 0 ? `−${money(totals.discount)}` : money(0)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-[var(--admin-line)] pt-3 font-heading text-base font-semibold text-[var(--admin-ink)]">
            <dt>Amount Due</dt>
            <dd>{money(totals.total)}</dd>
          </div>
        </dl>
      </EditorCard>

      <EditorCard title="Client-facing notes" helper="Shown to the client on the invoice.">
        <textarea
          rows={4}
          disabled={disabled}
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
          className={fieldClass}
        />
      </EditorCard>

      {showAdminNotes ? (
        <EditorCard title="Internal notes" helper="Agency-only. Never shown to the client.">
          <textarea
            rows={3}
            disabled={disabled}
            value={value.adminNotes}
            onChange={(event) => onChange({ ...value, adminNotes: event.target.value })}
            className={fieldClass}
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
