import { useState } from "react";
import { AdminInfoTip } from "@/components/admin/AdminInfoTip";
import { toggleNamedLineItem, type LineItemDraft } from "@/data/documents";
import { formatUsdFromCents } from "@/data/money";
import {
  extraScopeLines,
  hasPresetLine,
  paidAddonCents,
  PROPOSAL_ADDITIONAL_PAID,
  PROPOSAL_ADDITIONAL_UNPAID,
  PROPOSAL_FUNCTIONALITY_PRESETS,
  PROPOSAL_PAGE_PRESETS,
  scopeLineVariants,
  togglePresetLine,
} from "@/data/proposalPresets";

type ProposalScopePanelProps = {
  scope: string;
  requestedLines: string[];
  disabled?: boolean;
  onScopeChange: (value: string) => void;
};

type ProposalAdditionalPanelProps = {
  scope: string;
  items: LineItemDraft[];
  disabled?: boolean;
  addonCents?: Partial<Record<string, number>>;
  onScopeChange: (value: string) => void;
  onItemsChange: (items: LineItemDraft[]) => void;
};

const chipOff =
  "inline-flex min-h-9 items-center rounded-full border border-[var(--admin-line)] bg-white px-3 py-1.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:border-[rgb(0_80_240_/_0.35)] hover:bg-[var(--admin-hover)] disabled:opacity-50";
const chipOn =
  "inline-flex min-h-9 items-center rounded-full border border-[var(--admin-navy)] bg-[var(--admin-navy)] px-3 py-1.5 font-heading text-[12px] font-semibold text-white disabled:opacity-50";
const chipRequested =
  "inline-flex min-h-9 items-center rounded-full border border-emerald-700 bg-emerald-700 px-3 py-1.5 font-heading text-[12px] font-semibold text-white disabled:opacity-50";
const chipRequestedOff =
  "inline-flex min-h-9 items-center rounded-full border border-emerald-700/40 bg-[rgb(16_185_129_/_0.08)] px-3 py-1.5 font-heading text-[12px] font-semibold text-emerald-900 hover:bg-[rgb(16_185_129_/_0.14)] disabled:opacity-50";

function requestedBlob(requestedLines: string[]): string {
  return requestedLines.join("\n");
}

function isRequested(label: string, requestedLines: string[]): boolean {
  return hasPresetLine(requestedBlob(requestedLines), label);
}

function Chip({
  item,
  on,
  requested,
  disabled,
  suffix,
  onToggle,
}: {
  item: string;
  on: boolean;
  requested?: boolean;
  disabled?: boolean;
  suffix?: string;
  onToggle: () => void;
}) {
  const className = requested ? (on ? chipRequested : chipRequestedOff) : on ? chipOn : chipOff;
  const prefix = on ? "✓ " : "+ ";
  return (
    <button type="button" className={className} aria-pressed={on} disabled={disabled} onClick={onToggle}>
      {prefix}
      {item}
      {suffix ? ` · ${suffix}` : ""}
      {requested ? " · Requested" : ""}
    </button>
  );
}

export function ProposalScopePanel({ scope, requestedLines, disabled, onScopeChange }: ProposalScopePanelProps) {
  const [custom, setCustom] = useState("");
  const extras = extraScopeLines(scope);

  function addCustom() {
    const label = custom.trim();
    if (!label || disabled) return;
    if (!hasPresetLine(scope, label)) onScopeChange(togglePresetLine(scope, label));
    setCustom("");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-[var(--admin-muted)]">
        This is what MotiveScripts is offering. Click to include or remove an item. Items marked Requested came from the
        client's Website Scope — removing them here does not change the original scope.
      </p>
      <div>
        <p className="text-[12px] font-semibold text-[var(--admin-muted)]">Pages & Design</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PROPOSAL_PAGE_PRESETS.map((item) => {
            const on = hasPresetLine(scope, item);
            return (
              <Chip
                key={item}
                item={item}
                on={on}
                requested={isRequested(item, requestedLines)}
                disabled={disabled}
                onToggle={() => onScopeChange(togglePresetLine(scope, item))}
              />
            );
          })}
        </div>
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--admin-muted)]">
          Functionality
          <AdminInfoTip text="Included in the proposal at no extra line-item charge. Use Additional Services if you want to bill for something separately." />
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PROPOSAL_FUNCTIONALITY_PRESETS.map((item) => {
            const on = hasPresetLine(scope, item);
            return (
              <Chip
                key={item}
                item={item}
                on={on}
                requested={isRequested(item, requestedLines)}
                disabled={disabled}
                onToggle={() => onScopeChange(togglePresetLine(scope, item))}
              />
            );
          })}
        </div>
      </div>
      {extras.length > 0 ? (
        <div>
          <p className="text-[12px] font-semibold text-[var(--admin-muted)]">Other included items</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {extras.map((item) => (
              <Chip
                key={item}
                item={item}
                on
                requested={isRequested(item, requestedLines)}
                disabled={disabled}
                onToggle={() => onScopeChange(togglePresetLine(scope, item))}
              />
            ))}
          </div>
        </div>
      ) : null}
      {disabled ? null : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustom();
              }
            }}
            placeholder="Add a custom page or feature"
            className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
          <button type="button" className={chipOff} onClick={addCustom}>
            Add to scope
          </button>
        </div>
      )}
    </div>
  );
}

function lineItemMatches(items: LineItemDraft[], label: string): LineItemDraft | undefined {
  const variants = new Set(scopeLineVariants(label).map((entry) => entry.toLowerCase()));
  return items.find((item) => variants.has(item.name.trim().toLowerCase()));
}

export function ProposalAdditionalPanel({
  scope,
  items,
  disabled,
  addonCents,
  onScopeChange,
  onItemsChange,
}: ProposalAdditionalPanelProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-[var(--admin-muted)]">
        Optional extras. Items with a price add a paid line item — they are not charged just because they appeared in the
        client's scope. Unpriced items are included in the offer at no extra charge.
      </p>
      <div>
        <p className="text-[12px] font-semibold text-[var(--admin-muted)]">Included at no extra charge</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PROPOSAL_ADDITIONAL_UNPAID.map((item) => {
            const on = hasPresetLine(scope, item);
            return (
              <Chip
                key={item}
                item={item}
                on={on}
                disabled={disabled}
                onToggle={() => onScopeChange(togglePresetLine(scope, item))}
              />
            );
          })}
        </div>
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--admin-muted)]">
          Additional — billed separately
          <AdminInfoTip text="Selecting these writes a line item using the existing quantity × unit price calculation. Click again to remove the charge." />
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PROPOSAL_ADDITIONAL_PAID.map((item) => {
            const cents = paidAddonCents(item, addonCents);
            const match = lineItemMatches(items, item);
            const on = Boolean(match);
            return (
              <Chip
                key={item}
                item={item}
                on={on}
                disabled={disabled || cents == null}
                suffix={cents != null ? formatUsdFromCents(cents) : undefined}
                onToggle={() => {
                  if (cents == null) return;
                  onItemsChange(toggleNamedLineItem(items, match?.name ?? item, cents, !on));
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
