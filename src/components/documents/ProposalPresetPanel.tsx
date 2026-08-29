import { useState } from "react";
import {
  hasPresetLine,
  PROPOSAL_FEATURE_PRESETS,
  PROPOSAL_SCOPE_PRESETS,
  togglePresetLine,
} from "@/data/proposalPresets";

type ProposalPresetPanelProps = {
  scope: string;
  deliverables: string;
  onScopeChange: (value: string) => void;
  onDeliverablesChange: (value: string) => void;
};

export function ProposalPresetPanel({
  scope,
  deliverables,
  onScopeChange,
  onDeliverablesChange,
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
    <div className="space-y-4 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4">
      <div>
        <p className="text-sm font-semibold">Scope</p>
        <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
          Add what is included in the build. Click again to remove that line from Scope of work.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PROPOSAL_SCOPE_PRESETS.map((item) => {
            const on = hasPresetLine(scope, item);
            return (
              <button
                key={item}
                type="button"
                className={on ? chipOn : chipOff}
                onClick={() => onScopeChange(togglePresetLine(scope, item))}
              >
                {on ? item : `+ ${item}`}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">Features</p>
        <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
          Standard inclusions. These write to Deliverables, not Scope of work.
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
                onClick={() => onDeliverablesChange(togglePresetLine(deliverables, item))}
              >
                {item}
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
  "inline-flex h-9 items-center rounded-full border border-[var(--admin-line)] bg-white px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-white";
const chipOn =
  "inline-flex h-9 items-center rounded-full border border-[rgb(0_80_240_/_0.35)] bg-white px-3 font-heading text-[12px] font-semibold text-[var(--admin-navy)]";
