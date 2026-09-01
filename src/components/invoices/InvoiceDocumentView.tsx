import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { clientInvoiceStatusLabel, formatInvoiceDate, type EffectiveInvoiceStatus, type InvoiceSnapshotItem } from "@/data/invoices";
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
  status?: EffectiveInvoiceStatus;
  paidAt?: string | null;
};

function itemLines(description: string): { title: string; detail: string } {
  const trimmed = description.trim() || "Item";
  const breakAt = trimmed.indexOf("\n");
  if (breakAt < 0) return { title: trimmed, detail: "" };
  return { title: trimmed.slice(0, breakAt).trim() || "Item", detail: trimmed.slice(breakAt + 1).trim() };
}

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
  const paid = doc.status === "paid";
  const showTax = doc.taxCents > 0;
  const showDiscount = doc.discountCents > 0;
  const paidDate = formatInvoiceDate(doc.paidAt);

  return (
    <article className={`invoice-document ${radius} border ${line} ${card} p-5 md:p-8 ${ink}`}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={`font-heading text-xs font-bold uppercase tracking-[0.16em] ${muted}`}>{site.name}</p>
          <p className={`mt-2 text-sm ${muted}`}>{site.supportEmail}</p>
        </div>
        <div className="sm:text-right">
          <p className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${muted}`}>Invoice</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">{doc.number}</h1>
          {paid ? (
            <p className="mt-2 font-heading text-sm font-semibold tracking-tight text-[#0f7a56]">PAID ✓</p>
          ) : doc.status ? (
            <div className="mt-2 sm:flex sm:justify-end">
              <InvoiceStatusBadge status={doc.status} audience={tone} />
            </div>
          ) : null}
        </div>
      </div>

      <dl className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <dt className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${muted}`}>Bill to</dt>
          <dd className="mt-2">
            {doc.contactName ? <p className="font-heading text-sm font-semibold">{doc.contactName}</p> : null}
            <p className={`text-sm ${doc.contactName ? `mt-1 ${muted}` : "font-heading font-semibold"}`}>{doc.companyName}</p>
            {doc.email ? (
              <p className={`mt-1 text-sm ${muted}`}>
                <a href={`mailto:${doc.email}`} className="hover:underline">
                  {doc.email}
                </a>
              </p>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${muted}`}>Invoice details</dt>
          <dd className="mt-2 space-y-2 text-sm">
            <DetailRow label="Invoice number" value={doc.number} muted={muted} />
            <DetailRow label="Issue date" value={formatInvoiceDate(doc.issueDate)} muted={muted} />
            <DetailRow label="Due date" value={formatInvoiceDate(doc.dueDate)} muted={muted} />
            {doc.projectName ? <DetailRow label="Project" value={doc.projectName} muted={muted} /> : null}
            {doc.contractNumber ? <DetailRow label="Contract" value={doc.contractNumber} muted={muted} /> : null}
          </dd>
        </div>
      </dl>

      <section className="mt-8">
        <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Services</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-0 text-left text-sm">
            <thead>
              <tr className={`border-b ${line}`}>
                <th className={`py-2 pr-4 font-heading text-[11px] font-semibold uppercase tracking-[0.12em] ${muted}`}>
                  Description
                </th>
                <th className={`py-2 pl-4 text-right font-heading text-[11px] font-semibold uppercase tracking-[0.12em] ${muted}`}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {doc.items.length === 0 ? (
                <tr>
                  <td colSpan={2} className={`py-3 ${muted}`}>
                    No line items yet.
                  </td>
                </tr>
              ) : (
                doc.items.map((item, index) => {
                  const lines = itemLines(item.description);
                  return (
                    <tr key={item.id ?? `${item.description}-${index}`} className={`border-b ${line} last:border-b-0`}>
                      <td className="min-w-0 py-3 pr-4 align-top">
                        <p className={`font-heading text-sm font-semibold ${ink}`}>{lines.title}</p>
                        {lines.detail ? (
                          <p className={`mt-1 whitespace-pre-wrap text-[12px] leading-5 ${muted}`}>{lines.detail}</p>
                        ) : null}
                        {item.quantity !== 1 ? (
                          <p className={`mt-1 text-[12px] ${muted}`}>
                            {item.quantity} × {money(item.unit_price_cents)}
                          </p>
                        ) : null}
                      </td>
                      <td className={`whitespace-nowrap py-3 pl-4 text-right align-top font-heading text-sm font-semibold ${ink}`}>
                        {money(item.total_cents)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <dl className="mt-6 ml-auto w-full max-w-xs space-y-2 text-sm">
        <div className="flex justify-between gap-6">
          <dt className={muted}>Subtotal</dt>
          <dd>{money(doc.subtotalCents)}</dd>
        </div>
        {showTax ? (
          <div className="flex justify-between gap-6">
            <dt className={muted}>Tax</dt>
            <dd>{money(doc.taxCents)}</dd>
          </div>
        ) : null}
        {showDiscount ? (
          <div className="flex justify-between gap-6">
            <dt className={muted}>Discount</dt>
            <dd>{money(doc.discountCents)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-6 border-t border-[rgb(7_17_31_/_0.08)] pt-3 font-heading text-base font-semibold">
          <dt>Total</dt>
          <dd>{money(doc.totalCents)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className={muted}>Amount paid</dt>
          <dd>{money(doc.amountPaidCents)}</dd>
        </div>
        <div className="flex justify-between gap-6 border-t border-[rgb(7_17_31_/_0.08)] pt-3 font-heading text-lg font-semibold">
          <dt>Balance due</dt>
          <dd>{money(doc.amountDueCents)}</dd>
        </div>
      </dl>

      {paid ? (
        <section className="mt-8 border-t border-[rgb(7_17_31_/_0.08)] pt-6">
          <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Payment</h2>
          <dl className="mt-3 max-w-xs space-y-2 text-sm">
            <DetailRow label="Payment status" value={clientInvoiceStatusLabel("paid")} muted={muted} />
            {paidDate !== "—" ? <DetailRow label="Payment date" value={paidDate} muted={muted} /> : null}
          </dl>
        </section>
      ) : null}

      {doc.notes.trim() ? (
        <section className="mt-8">
          <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Notes</h2>
          <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${muted}`}>{doc.notes}</p>
        </section>
      ) : null}
    </article>
  );
}

function DetailRow({ label, value, muted }: { label: string; value: string; muted: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className={muted}>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
