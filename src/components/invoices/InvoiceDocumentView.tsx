import { formatInvoiceDate, type InvoiceSnapshotItem } from "@/data/invoices";
import { formatMoneyFromCents } from "@/data/money";
import { site } from "@/data/site";

export type InvoiceViewModel = {
  number: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  companyName: string;
  contactName?: string;
  email?: string;
  projectName?: string | null;
  contractNumber?: string | null;
  notes: string;
  items: InvoiceSnapshotItem[];
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  amountPaidCents: number;
  amountDueCents: number;
};

export function InvoiceDocumentView({
  document: doc,
  tone = "admin",
}: {
  document: InvoiceViewModel;
  tone?: "admin" | "client";
}) {
  const ink = tone === "client" ? "text-[var(--client-ink)]" : "text-[var(--admin-ink)]";
  const muted = tone === "client" ? "text-[var(--client-muted)]" : "text-[var(--admin-muted)]";
  const line = tone === "client" ? "border-[var(--client-line)]" : "border-[var(--admin-line)]";
  const card = tone === "client" ? "bg-[var(--client-card)]" : "bg-[var(--admin-card)]";
  const radius = tone === "client" ? "rounded-[var(--client-radius)]" : "rounded-[var(--admin-radius)]";
  const money = (cents: number) => formatMoneyFromCents(cents, doc.currency);

  return (
    <article className={`${radius} border ${line} ${card} p-5 md:p-8 ${ink}`}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={`font-heading text-xs font-bold uppercase tracking-[0.16em] ${muted}`}>{site.name}</p>
          <p className={`mt-2 text-sm ${muted}`}>{site.email}</p>
        </div>
        <div className="sm:text-right">
          <p className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${muted}`}>Invoice</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">{doc.number}</h1>
        </div>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${muted}`}>Bill to</dt>
          <dd className="mt-2">
            <p className="font-heading text-sm font-semibold">{doc.companyName}</p>
            {doc.contactName ? <p className={`mt-1 text-sm ${muted}`}>{doc.contactName}</p> : null}
            {doc.email ? <p className={`mt-1 text-sm ${muted}`}>{doc.email}</p> : null}
          </dd>
        </div>
        <div className="sm:text-right">
          <div>
            <p className={`text-[12px] ${muted}`}>Issue date</p>
            <p className="mt-1 text-sm font-medium">{formatInvoiceDate(doc.issueDate)}</p>
          </div>
          <div className="mt-3">
            <p className={`text-[12px] ${muted}`}>Due date</p>
            <p className="mt-1 text-sm font-medium">{formatInvoiceDate(doc.dueDate)}</p>
          </div>
          {doc.projectName ? (
            <div className="mt-3">
              <p className={`text-[12px] ${muted}`}>Project</p>
              <p className="mt-1 text-sm font-medium">{doc.projectName}</p>
            </div>
          ) : null}
          {doc.contractNumber ? (
            <div className="mt-3">
              <p className={`text-[12px] ${muted}`}>Contract</p>
              <p className="mt-1 text-sm font-medium">{doc.contractNumber}</p>
            </div>
          ) : null}
        </div>
      </dl>

      <section className="mt-8">
        <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Line items</h2>
        <ul className="mt-3 divide-y divide-[rgb(7_17_31_/_0.08)]">
          {doc.items.length === 0 ? (
            <li className={`py-3 text-sm ${muted}`}>No line items yet.</li>
          ) : (
            doc.items.map((item, index) => (
              <li key={item.id ?? `${item.description}-${index}`} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div>
                  <p className={`font-heading text-sm font-semibold ${ink}`}>{item.description}</p>
                  <p className={`mt-1 text-[12px] ${muted}`}>
                    {item.quantity} × {money(item.unit_price_cents)}
                  </p>
                </div>
                <p className={`font-heading text-sm font-semibold ${ink}`}>{money(item.total_cents)}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <dl className="mt-6 ml-auto max-w-xs space-y-2 text-sm">
        <div className="flex justify-between gap-6">
          <dt className={muted}>Subtotal</dt>
          <dd>{money(doc.subtotalCents)}</dd>
        </div>
        {doc.taxCents > 0 ? (
          <div className="flex justify-between gap-6">
            <dt className={muted}>Tax</dt>
            <dd>{money(doc.taxCents)}</dd>
          </div>
        ) : null}
        {doc.discountCents > 0 ? (
          <div className="flex justify-between gap-6">
            <dt className={muted}>Discount</dt>
            <dd>−{money(doc.discountCents)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-6 border-t border-[rgb(7_17_31_/_0.08)] pt-2 font-heading text-base font-semibold">
          <dt>Total</dt>
          <dd>{money(doc.totalCents)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className={muted}>Paid</dt>
          <dd>{money(doc.amountPaidCents)}</dd>
        </div>
        <div className="flex justify-between gap-6 font-heading font-semibold">
          <dt>Amount due</dt>
          <dd>{money(doc.amountDueCents)}</dd>
        </div>
      </dl>

      {doc.notes.trim() ? (
        <section className="mt-8">
          <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Notes</h2>
          <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${muted}`}>{doc.notes}</p>
        </section>
      ) : null}
    </article>
  );
}
