import { formatLeadTimestamp, type Lead } from "@/data/leads";

type LeadNotesProps = {
  lead: Lead;
  onAddNote: () => void;
};

export function LeadNotes({ lead, onAddNote }: LeadNotesProps) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Internal Notes</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Agency only — never shown in the Client Portal.</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          onClick={onAddNote}
        >
          Add Note
        </button>
      </div>
      {lead.notes.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">No internal notes yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {lead.notes.map((note) => (
            <li key={note.id} className="rounded-lg bg-[var(--admin-bg)] px-3 py-3">
              <p className="text-sm leading-relaxed text-[var(--admin-ink)]">{note.body}</p>
              <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
                {note.author} · {formatLeadTimestamp(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
