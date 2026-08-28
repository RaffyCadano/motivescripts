import { centsInputValue, parseDollarsToCents } from "@/data/money";
import { emptyLineItem, lineItemTotalCents, lineItemsTotalCents, type LineItemDraft } from "@/data/documents";
import { formatUsdFromCents } from "@/data/money";

type LineItemsEditorProps = {
  items: LineItemDraft[];
  disabled?: boolean;
  onChange: (items: LineItemDraft[]) => void;
};

export function LineItemsEditor({ items, disabled, onChange }: LineItemsEditorProps) {
  function update(index: number, patch: Partial<LineItemDraft>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.key}
          className="grid gap-2 rounded-lg border border-[var(--admin-line)] bg-white p-3 sm:grid-cols-[minmax(0,1.2fr)_4.5rem_7rem_auto]"
        >
          <label className="block">
            <span className="sr-only">Item name</span>
            <input
              value={item.name}
              disabled={disabled}
              placeholder="Item name"
              onChange={(event) => update(index, { name: event.target.value })}
              className={inputClass}
            />
            <textarea
              value={item.description}
              disabled={disabled}
              rows={2}
              placeholder="Optional description"
              onChange={(event) => update(index, { description: event.target.value })}
              className={`${inputClass} mt-2 min-h-[4rem] py-2`}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Qty</span>
            <input
              type="number"
              min={1}
              max={9999}
              step={1}
              disabled={disabled}
              value={item.quantity}
              onChange={(event) => update(index, { quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) })}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Unit</span>
            <input
              inputMode="decimal"
              disabled={disabled}
              value={centsInputValue(item.unitPriceCents)}
              onChange={(event) => {
                const cents = parseDollarsToCents(event.target.value);
                if (cents == null) return;
                update(index, { unitPriceCents: cents });
              }}
              className={inputClass}
            />
          </label>
          <div className="flex items-end justify-between gap-2 sm:flex-col sm:items-stretch">
            <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">
              {formatUsdFromCents(lineItemTotalCents(item))}
            </p>
            <button
              type="button"
              disabled={disabled || items.length <= 1}
              className="text-[12px] font-semibold text-[var(--admin-muted)] hover:text-[var(--admin-ink)] disabled:opacity-40"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={disabled}
          className="font-heading text-sm font-semibold text-[var(--admin-blue)] hover:underline disabled:opacity-40"
          onClick={() => onChange([...items, emptyLineItem()])}
        >
          Add line item
        </button>
        <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">
          Total {formatUsdFromCents(lineItemsTotalCents(items))}
        </p>
      </div>
    </div>
  );
}

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)] disabled:bg-[var(--admin-bg)]";
