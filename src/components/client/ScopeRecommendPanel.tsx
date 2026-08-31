import { useState } from "react";
import { cn } from "@/lib/cn";

type ScopeRecommendPanelProps = {
  kind: "pages" | "features";
  industry: string | null | undefined;
  suggestions: string[];
  selected: string[];
  onAdd: (picks: string[]) => void;
};

export function ScopeRecommendPanel({ kind, industry, suggestions, selected, onAdd }: ScopeRecommendPanelProps) {
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<string[]>(suggestions);
  const already = new Set(selected);
  const knownIndustry = Boolean(industry && industry !== "Other");
  const isPages = kind === "pages";

  function openPanel() {
    setPicks(suggestions);
    setOpen(true);
  }

  function togglePick(label: string) {
    setPicks((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    );
  }

  function addPicks() {
    onAdd(picks);
    setOpen(false);
  }

  const newCount = picks.filter((item) => !already.has(item)).length;

  return (
    <div className="mt-4">
      {!open ? (
        <div className="rounded-xl border border-dashed border-[var(--client-line)] bg-[var(--client-hover)]/40 px-4 py-3">
          <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">
            {isPages ? "Not sure what pages you need?" : "Not sure which features you need?"}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--client-muted)]">
            {isPages
              ? "That’s okay. We’ll suggest a starting point based on your business."
              : "We’ll suggest common features that may make sense for your website."}
          </p>
          <button
            type="button"
            onClick={openPanel}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-4 font-heading text-[12px] font-semibold text-[var(--client-ink)] hover:bg-[var(--client-hover)]"
          >
            {isPages ? "Recommend Pages" : "Recommend Features"}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[rgb(0_80_240_/_0.22)] bg-white px-4 py-4">
          <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">Recommended for your business</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--client-muted)]">
            {knownIndustry
              ? `These are a starting point for a ${industry} website. Review them, then add only what you want.`
              : "These are a starting point for a typical small-business website. Review them, then add only what you want."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((item) => {
              const on = picks.includes(item);
              const owned = already.has(item);
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={on}
                  onClick={() => togglePick(item)}
                  className={cn(
                    "inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 font-heading text-[12px] font-semibold",
                    on
                      ? "border-[var(--client-navy)] bg-[var(--client-navy)] text-white"
                      : "border-[var(--client-line)] bg-white text-[var(--client-ink)] hover:border-[rgb(0_80_240_/_0.35)] hover:bg-[var(--client-hover)]",
                  )}
                >
                  {on ? `${item} ✓` : item}
                  {owned ? (
                    <span className={cn("ml-1 font-medium", on ? "text-white/80" : "text-[var(--client-muted)]")}>
                      (already added)
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={addPicks}
              disabled={picks.length === 0}
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-4 font-heading text-[12px] font-semibold text-white hover:bg-[var(--client-bright)] disabled:opacity-60"
            >
              {isPages
                ? newCount > 0
                  ? "Add Recommended Pages"
                  : "Keep Current Pages"
                : newCount > 0
                  ? "Add Recommended Features"
                  : "Keep Current Features"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-4 font-heading text-[12px] font-semibold text-[var(--client-ink)] hover:bg-[var(--client-hover)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
