import { useState } from "react";
import { AdminInfoTip } from "@/components/admin/AdminInfoTip";
import { toggleNamedLineItem, type LineItemDraft } from "@/data/documents";
import { formatUsdFromCents } from "@/data/money";
import {
  hasPresetLine,
  paidAddonCents,
  PROPOSAL_FEATURE_PRESETS,
  PROPOSAL_SCOPE_INCLUDED,
  PROPOSAL_SCOPE_OPTIONAL,
  togglePresetLine,
} from "@/data/proposalPresets";

type ProposalPresetPanelProps = {
  scope: string;
  deliverables: string;
  items: LineItemDraft[];
  onScopeChange: (value: string) => void;
  onDeliverablesChange: (value: string) => void;
  onItemsChange: (items: LineItemDraft[]) => void;
};

function chipLabel(item: string, on: boolean) {
  const cents = paidAddonCents(item);
  const price = cents != null ? ` · ${formatUsdFromCents(cents)}` : "";
  if (cents != null) return on ? `${item}${price}` : `+ ${item}${price}`;
  return on ? item : `+ ${item}`;
}

export function ProposalPresetPanel({
  scope,
  deliverables,
  items,
  onScopeChange,
  onDeliverablesChange,
  onItemsChange,
}: ProposalPresetPanelProps) {
  const [custom, setCustom] = useState("");

  function addCustom() {
    const label = custom.trim();
    if (!label) return;
    if (!hasPresetLine(deliverables, label)) {
      onDeliverablesChange(togglePresetLine(deliverables, label));
    }
    setCustom("");
  }

  return (
    <div className="space-y-4 rounded-lg border border-[var(--admin-line)] p-4">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          Scope
          <AdminInfoTip text="Homepage and responsive setup start included. Chips that show a dollar amount also add that charge on Line items. Click again to remove." />
        </p>
        <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
          Homepage is already included. Click again to remove a line from Scope of work.
        </p>
        <p className="mt-3 text-[12px] font-semibold text-[var(--admin-muted)]">Included with the website</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PROPOSAL_SCOPE_INCLUDED.map((item) => {
            const on = hasPresetLine(scope, item);
            return (
              <button
                key={item}
                type="button"
                className={on ? chipOn : chipOff}
                aria-pressed={on}
                onClick={() => onScopeChange(togglePresetLine(scope, item))}
              >
                {on ? `${item} · Included` : `+ ${item}`}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] font-semibold text-[var(--admin-muted)]">Add pages and setup</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PROPOSAL_SCOPE_OPTIONAL.map((item) => {
            const on = hasPresetLine(scope, item);
            return (
              <button
                key={item}
                type="button"
                className={on ? chipOn : chipOff}
                aria-pressed={on}
                onClick={() => {
                  const nextOn = !on;
                  const cents = paidAddonCents(item);
                  if (cents != null) onItemsChange(toggleNamedLineItem(items, item, cents, nextOn));
                  onScopeChange(togglePresetLine(scope, item));
                }}
              >
                {chipLabel(item, on)}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          Features
          <AdminInfoTip text="Chips with a dollar amount add that charge on Line items. The rest write to Deliverables only. Click again to remove." />
        </p>
        <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
          Standard inclusions write to Deliverables. Paid chips also add a line-item charge.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PROPOSAL_FEATURE_PRESETS.map((item) => {
            const on = hasPresetLine(deliverables, item);
            return (
              <button
                key={item}
                type="button"
                className={on ? chipOn : chipOff}
                aria-pressed={on}
                onClick={() => {
                  const nextOn = !on;
                  const cents = paidAddonCents(item);
                  if (cents != null) onItemsChange(toggleNamedLineItem(items, item, cents, nextOn));
                  onDeliverablesChange(togglePresetLine(deliverables, item));
                }}
              >
                {chipLabel(item, on)}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustom();
              }
            }}
            placeholder="Add custom feature"
            className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
          <button type="button" className={chipOff} onClick={addCustom}>
            Add custom feature
          </button>
        </div>
      </div>
    </div>
  );
}

const chipOff =
  "inline-flex min-h-9 items-center rounded-full border border-[var(--admin-line)] bg-white px-3 py-1.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:border-[rgb(0_80_240_/_0.35)] hover:bg-[var(--admin-hover)]";
const chipOn =
  "inline-flex min-h-9 items-center rounded-full border border-[var(--admin-navy)] bg-[var(--admin-navy)] px-3 py-1.5 font-heading text-[12px] font-semibold text-white";
