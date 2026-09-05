import { useEffect, useState } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { payrollMethodLabel, payrollPaymentMethods, type PayrollPaymentMethod } from "@/data/payroll";
import { formatUsdFromCents } from "@/data/money";

const fieldClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]";

export function RecordPayrollPaymentModal({
  open,
  busy,
  staffName,
  unpaidHours,
  owedCents,
  zelleContact,
  paypalEmail,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy?: boolean;
  staffName: string;
  unpaidHours: number;
  owedCents: number;
  zelleContact?: string | null;
  paypalEmail?: string | null;
  onClose: () => void;
  onConfirm: (input: { method: PayrollPaymentMethod; reference: string; notes: string }) => void;
}) {
  const [method, setMethod] = useState<PayrollPaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setMethod("bank_transfer");
    setReference("");
    setNotes("");
  }, [open]);

  return (
    <AdminDialog
      open={open}
      busy={busy}
      title="Record payroll payment"
      description={`Paying ${staffName} for ${unpaidHours}h — ${formatUsdFromCents(owedCents)} at their current rate. This records that you paid them; it does not move money.`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <label className="block text-sm font-semibold">
          Method
          <select value={method} onChange={(event) => setMethod(event.target.value as PayrollPaymentMethod)} className={fieldClass}>
            {payrollPaymentMethods.map((item) => (
              <option key={item} value={item}>
                {payrollMethodLabel(item)}
              </option>
            ))}
          </select>
        </label>
        {method === "zelle" || method === "paypal" ? (
          <p className="rounded-lg bg-[var(--admin-bg)] px-3 py-2 text-[13px] text-[var(--admin-ink)]">
            {method === "zelle"
              ? zelleContact
                ? <>Zelle contact on file: <span className="font-semibold">{zelleContact}</span></>
                : "No Zelle contact on file for this staff member yet — add one on the Payroll table."
              : paypalEmail
                ? <>PayPal email on file: <span className="font-semibold">{paypalEmail}</span></>
                : "No PayPal email on file for this staff member yet — add one on the Payroll table."}
          </p>
        ) : null}
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
          onClick={() => onConfirm({ method, reference, notes })}
        >
          {busy ? "Saving…" : "Record payment"}
        </button>
      </div>
    </AdminDialog>
  );
}
