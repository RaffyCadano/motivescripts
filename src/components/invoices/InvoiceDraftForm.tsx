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

type Option = { id: string; label: string };

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
  lockContract = false,
  disabled,
  onChange,
  onItemsChange,
}: {
  value: InvoiceDraftFormValue;
  items: LineItemDraft[];
  clients: Option[];
  projects: Option[];
  contracts: Option[];
  showClient?: boolean;
  showAdminNotes?: boolean;
  lockClient?: boolean;
  lockContract?: boolean;
  disabled?: boolean;
  onChange: (value: InvoiceDraftFormValue) => void;
  onItemsChange: (items: LineItemDraft[]) => void;
}) {
  const totals = invoiceDraftTotalCents(items, value.taxCents, value.discountCents);
  const money = (cents: number) => formatMoneyFromCents(cents, value.currency || "USD");

  return (
    <div className="space-y-4">
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
        <select
          disabled={disabled}
          value={value.projectId}
          onChange={(event) => onChange({ ...value, projectId: event.target.value })}
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
        Contract <span className="font-medium text-[var(--admin-muted)]">(optional, accepted only)</span>
        <select
          disabled={disabled || lockContract}
          value={value.contractId}
          onChange={(event) => onChange({ ...value, contractId: event.target.value })}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Issue date
          <input
            type="date"
            disabled={disabled}
            value={value.issueDate}
            onChange={(event) => onChange({ ...value, issueDate: event.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm font-semibold">
          Due date
          <input
            type="date"
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
      <div>
        <p className="text-sm font-semibold">Line items</p>
        <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
          Totals use quantity × unit price in integer cents. The database recalculates the invoice.
        </p>
        <div className="mt-3">
          <LineItemsEditor items={items} disabled={disabled} onChange={onItemsChange} />
        </div>
      </div>
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
      <label className="block text-sm font-semibold">
        Notes <span className="font-medium text-[var(--admin-muted)]">(shown on the invoice)</span>
        <textarea
          rows={4}
          disabled={disabled}
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
          className={fieldClass}
        />
      </label>
      {showAdminNotes ? (
        <label className="block text-sm font-semibold">
          Internal notes <span className="font-medium text-[var(--admin-muted)]">(not shown to the client)</span>
          <textarea
            rows={3}
            disabled={disabled}
            value={value.adminNotes}
            onChange={(event) => onChange({ ...value, adminNotes: event.target.value })}
            className={fieldClass}
          />
        </label>
      ) : null}
      <dl className="space-y-1 text-sm text-[var(--admin-muted)]">
        <div className="flex justify-between gap-4">
          <dt>Subtotal</dt>
          <dd>{money(totals.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Tax</dt>
          <dd>{money(totals.tax)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Discount</dt>
          <dd>−{money(totals.discount)}</dd>
        </div>
        <div className="flex justify-between gap-4 font-heading text-[var(--admin-ink)] font-semibold">
          <dt>Total</dt>
          <dd>{money(totals.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
