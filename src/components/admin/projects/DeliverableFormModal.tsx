import { useEffect, useState, type FormEvent } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import {
  deliverableCategories,
  fileInputAccept,
  fileTypeFromName,
  formatFileSize,
  reviewStatuses,
  type DeliverableCategory,
  type DeliverableDraft,
  type ReviewStatus,
} from "@/data/files";
import { MAX_FILE_SIZE_LABEL, validateUploadFile } from "@/data/fileUploadConfig";

const fieldClass =
  "mt-1.5 h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]";

const emptyDraft: DeliverableDraft = {
  name: "",
  description: "",
  category: "Website Page",
  status: "Draft",
};

type DeliverableFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (draft: DeliverableDraft, file: File | null) => Promise<boolean>;
};

export function DeliverableFormModal({ open, onClose, onSubmit }: DeliverableFormModalProps) {
  const [draft, setDraft] = useState<DeliverableDraft>(emptyDraft);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(emptyDraft);
    setFile(null);
    setError(null);
    setUploading(false);
  }, [open]);

  function chooseFile(nextFile: File | null) {
    setFile(nextFile);
    if (!nextFile) {
      setError(null);
      return;
    }
    const invalid = validateUploadFile(nextFile);
    setError(invalid?.message ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
    if (file) {
      const invalid = validateUploadFile(file);
      if (invalid) {
        setError(invalid.message);
        return;
      }
    }
    setUploading(true);
    const ok = await onSubmit(draft, file);
    setUploading(false);
    if (ok) onClose();
  }

  return (
    <AdminDialog
      open={open}
      busy={uploading}
      title="New Deliverable"
      description="Create a piece of project work. Versions can be added now or later."
      onClose={onClose}
    >
      <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Deliverable name
          <input
            required
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            className={fieldClass}
          />
        </label>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Description
          <textarea
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            rows={3}
            className="mt-1.5 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </label>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Category
          <select
            value={draft.category}
            onChange={(event) =>
              setDraft((current) => ({ ...current, category: event.target.value as DeliverableCategory }))
            }
            className={fieldClass}
          >
            {deliverableCategories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Initial status
          <select
            value={draft.status}
            onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ReviewStatus }))}
            className={fieldClass}
          >
            {reviewStatuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Initial file
          <input
            type="file"
            accept={fileInputAccept}
            disabled={uploading}
            className="mt-1.5 block w-full text-sm text-[var(--admin-ink)] file:mr-3 file:rounded-lg file:border file:border-[var(--admin-line)] file:bg-white file:px-3 file:py-1.5 file:font-heading file:text-[12px] file:font-semibold"
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          />
          <span className="mt-1 block text-[12px] font-normal text-[var(--admin-muted)]">
            Optional. Uploaded to private Storage. Maximum {MAX_FILE_SIZE_LABEL}.
          </span>
        </label>
        {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
        {file ? (
          <p className="text-[12px] text-[var(--admin-muted)]">
            {file.name} · {fileTypeFromName(file.name, file.type)} · {formatFileSize(file.size)}
          </p>
        ) : null}
        {uploading ? (
          <div>
            <p className="text-sm font-medium text-[var(--admin-ink)]">Uploading…</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--admin-line)]">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#0050F0,#00C8FF)]" />
            </div>
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={uploading}
            className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading || Boolean(error)}
            className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Create Deliverable"}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
