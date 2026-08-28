import { useState, type FormEvent } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import type { Lead } from "@/data/leads";

type AddNoteModalProps = {
  lead: Lead | null;
  onClose: () => void;
  onSave: (body: string) => void;
};

export function AddNoteModal({ lead, onClose, onSave }: AddNoteModalProps) {
  const [body, setBody] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = body.trim();
    if (!next) return;
    onSave(next);
    setBody("");
    onClose();
  }

  return (
    <AdminDialog
      open={Boolean(lead)}
      title="Add internal note"
      description="This note is for the agency only. Clients never see it."
      onClose={() => {
        setBody("");
        onClose();
      }}
    >
      <form onSubmit={handleSubmit}>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Note
          <textarea
            required
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="mt-1.5 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
            onClick={() => {
              setBody("");
              onClose();
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white"
          >
            Add Note
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
