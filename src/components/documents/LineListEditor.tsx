import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

type LineListEditorProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  addLabel?: string;
  placeholder?: string;
};

function splitLines(text: string): string[] {
  return text === "" ? [] : text.split(/\r?\n/);
}

function compactLines(lines: string[]): string {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(line);
  }
  return next.join("\n");
}

export function LineListEditor({
  value,
  disabled,
  onChange,
  addLabel = "Add item",
  placeholder = "Add another item",
}: LineListEditorProps) {
  const lines = splitLines(value);
  const [draft, setDraft] = useState("");

  function commit(next: string[], compact = true) {
    onChange(compact ? compactLines(next) : next.join("\n"));
  }

  function addLine() {
    const label = draft.trim();
    if (!label) return;
    commit([...lines, label]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      {lines.filter((line) => line.trim()).length === 0 && disabled ? (
        <p className="text-sm text-[var(--admin-muted)]">No items yet. Add what MotiveScripts will deliver.</p>
      ) : null}
      {lines.length > 0 ? (
        <ul className="space-y-2">
          {lines.map((line, index) => (
            <li
              key={index}
              className="flex items-center gap-2 rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2"
            >
              {disabled ? (
                <p className="min-w-0 flex-1 text-sm text-[var(--admin-ink)]">{line}</p>
              ) : (
                <input
                  value={line}
                  onChange={(event) => {
                    const next = [...lines];
                    next[index] = event.target.value;
                    commit(next, false);
                  }}
                  onBlur={() => commit(lines)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--admin-ink)] outline-none"
                />
              )}
              {disabled ? null : (
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={index === 0}
                    className="rounded p-1 text-[var(--admin-muted)] hover:bg-[var(--admin-hover)] hover:text-[var(--admin-ink)] disabled:opacity-30"
                    onClick={() => {
                      if (index === 0) return;
                      const next = [...lines];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      commit(next);
                    }}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={index === lines.length - 1}
                    className="rounded p-1 text-[var(--admin-muted)] hover:bg-[var(--admin-hover)] hover:text-[var(--admin-ink)] disabled:opacity-30"
                    onClick={() => {
                      if (index === lines.length - 1) return;
                      const next = [...lines];
                      [next[index + 1], next[index]] = [next[index], next[index + 1]];
                      commit(next);
                    }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove"
                    className="rounded p-1 text-[var(--admin-muted)] hover:bg-[var(--admin-hover)] hover:text-[#b42318]"
                    onClick={() => commit(lines.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : disabled ? null : (
        <p className="text-sm text-[var(--admin-muted)]">No items yet. Add what MotiveScripts will deliver.</p>
      )}
      {disabled ? null : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addLine();
              }
            }}
            placeholder={placeholder}
            className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--admin-line)] bg-white px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-hover)]"
            onClick={addLine}
          >
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}
