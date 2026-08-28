import { useEffect, useState } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { isoCalendarDate, paymentMethodLabel, type PaymentMethod } from "@/data/invoices";
import { centsInputValue, formatMoneyFromCents, parseDollarsToCents } from "@/data/money";

const methods: PaymentMethod[] = ["bank_transfer", "cash", "check", "other"];

const fieldClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]";

export function RecordPaymentModal({
  open,
  busy,
  amountDueCents,
  currency,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy?: boolean;
  amountDueCents: number;
  currency: string;
  onClose: () => void;
  onConfirm: (input: {
    amountCents: number;
    paymentDate: string;
    method: PaymentMethod;
    reference: string;
    notes: string;
  }) => void;
}) {
  const [amount, setAmount] = useState(amountDueCents);
  const [paymentDate, setPaymentDate] = useState(isoCalendarDate());
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount(amountDueCents);
    setPaymentDate(isoCalendarDate());
    setMethod("bank_transfer");
    setReference("");
    setNotes("");
    setError(null);
  }, [open, amountDueCents]);

  return (
    <AdminDialog
      open={open}
      busy={busy}
      title="Record payment"
      description={`Amount due ${formatMoneyFromCents(amountDueCents, currency)}. This is a manual record — no card or bank charge.`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <label className="block text-sm font-semibold">
          Amount
          <input
            inputMode="decimal"
            value={centsInputValue(amount)}
            onChange={(event) => {
              const cents = parseDollarsToCents(event.target.value);
              if (cents == null) return;
              setAmount(cents);
              setError(null);
            }}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm font-semibold">
          Date
          <input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold">
          Method
          <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className={fieldClass}>
            {methods.map((item) => (
              <option key={item} value={item}>
                {paymentMethodLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Reference
          <input value={reference} onChange={(event) => setReference(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold">
          Notes
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </label>
        {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={busy}
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold disabled:opacity-60"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
          onClick={() => {
            if (amount <= 0) {
              setError("Enter a payment amount greater than zero.");
              return;
            }
            if (amount > amountDueCents) {
              setError("That payment is more than the amount due.");
              return;
            }
            if (!paymentDate) {
              setError("Choose a payment date.");
              return;
            }
            onConfirm({ amountCents: amount, paymentDate, method, reference, notes });
          }}
        >
          {busy ? "Saving…" : "Record payment"}
        </button>
      </div>
    </AdminDialog>
  );
}
