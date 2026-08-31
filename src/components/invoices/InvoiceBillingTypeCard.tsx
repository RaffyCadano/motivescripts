import { Link } from "react-router-dom";
import {
  adminInvoiceStatusLabel,
  splitInvoiceInvestmentCents,
  type InvoiceBillingType,
} from "@/data/invoices";
import type { InvoiceSummary } from "@/data/invoicesRepository";
import { formatMoneyFromCents } from "@/data/money";

const options: { type: InvoiceBillingType; label: string }[] = [
  { type: "full", label: "Full amount" },
  { type: "deposit", label: "50% deposit" },
  { type: "balance", label: "Remaining 50%" },
  { type: "custom", label: "Custom amount" },
];

export function InvoiceBillingTypeCard({
  currency,
  investmentCents,
  billingType,
  relatedInvoices,
  disabled,
  onChange,
}: {
  currency: string;
  investmentCents: number;
  billingType: InvoiceBillingType;
  relatedInvoices: InvoiceSummary[];
  disabled?: boolean;
  onChange: (type: InvoiceBillingType) => void;
}) {
  if (investmentCents <= 0) return null;
  const money = (cents: number) => formatMoneyFromCents(cents, currency);
  const { depositCents, remainderCents } = splitInvoiceInvestmentCents(investmentCents);
  const amountFor = (type: InvoiceBillingType) => {
    if (type === "full") return investmentCents;
    if (type === "deposit") return depositCents;
    if (type === "balance") return remainderCents;
    return null;
  };
  const matchingDeposits = relatedInvoices.filter(
    (row) => row.status !== "cancelled" && row.totalCents === depositCents,
  );

  return (
    <section className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div>
        <h2 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Payment amount</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">
          Choose how much this invoice bills. The proposal investment stays {money(investmentCents)}. Stripe will charge
          this invoice’s amount due, not the full project price.
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Project investment</dt>
          <dd className="mt-1 font-heading text-sm font-semibold">{money(investmentCents)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">50% deposit</dt>
          <dd className="mt-1 font-heading text-sm font-semibold">{money(depositCents)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Remaining balance</dt>
          <dd className="mt-1 font-heading text-sm font-semibold">{money(remainderCents)}</dd>
        </div>
      </dl>
      <fieldset disabled={disabled}>
        <legend className="sr-only">Payment amount</legend>
        <div className="space-y-2">
          {options.map((option) => {
            const amount = amountFor(option.type);
            return (
              <label
                key={option.type}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--admin-line)] px-3 py-2.5 text-sm text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
              >
                <input
                  type="radio"
                  name="invoice-billing-type"
                  checked={billingType === option.type}
                  onChange={() => onChange(option.type)}
                />
                <span className="font-medium">
                  {option.label}
                  {amount != null ? ` — ${money(amount)}` : ""}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="text-sm leading-6 text-[var(--admin-muted)]">
        This project is {money(investmentCents)}. A 50% deposit is {money(depositCents)}. The remaining{" "}
        {money(remainderCents)} can be invoiced later.
      </p>
      {relatedInvoices.length > 0 ? (
        <div>
          <p className="text-sm font-semibold text-[var(--admin-ink)]">Existing invoices on this project</p>
          <ul className="mt-2 space-y-1.5 text-sm text-[var(--admin-muted)]">
            {relatedInvoices.map((row) => (
              <li key={row.id}>
                <Link className="font-medium text-[var(--admin-blue)] hover:underline" to={`/admin/invoices/${row.id}`}>
                  {row.number}
                </Link>
                {` · ${money(row.totalCents)} · ${adminInvoiceStatusLabel(row.effectiveStatus)}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {billingType === "deposit" && matchingDeposits.length > 0 ? (
        <p className="text-sm leading-6 text-amber-800">
          A {money(depositCents)} invoice already exists
          {matchingDeposits[0] ? ` (${matchingDeposits[0].number})` : ""}. Choose Remaining 50% for the second payment
          unless this is a correction.
        </p>
      ) : null}
    </section>
  );
}
