import { formatTeamTimestamp, type StaffNote } from "@/data/team";

/**
 * A running internal log about one staff member -- mirrors ClientNotesSection. Nothing here is
 * ever shown to the person it's about; it exists for the agency's own record of conversations,
 * warnings, and context behind a later promotion or deactivation.
 */
export function StaffNotesSection({ notes, onAddNote }: { notes: StaffNote[]; onAddNote: () => void }) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Internal Notes</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Admins only — this person never sees these.</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          onClick={onAddNote}
        >
          Add Note
        </button>
      </div>
      {notes.length === 0 ? (
        <div className="mt-4">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No internal notes yet</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            Add a note for admins -- a conversation, a warning, anything worth remembering later.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg bg-[var(--admin-bg)] px-3 py-3">
              <p className="text-sm leading-relaxed text-[var(--admin-ink)]">{note.body}</p>
              <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
                {note.author} · {formatTeamTimestamp(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
