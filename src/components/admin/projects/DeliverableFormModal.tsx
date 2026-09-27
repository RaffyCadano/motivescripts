import { FilePlus, FileText, Tags, Upload } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import {
  DialogActions,
  DialogField,
  DialogSection,
  DialogSelect,
  dialogInputClass,
  dialogTextareaClass,
} from "@/components/admin/dialog/formKit";

import {
  deliverableCategories,
  designCheckpointLabel,
  designCheckpoints,
  fileInputAccept,
  fileTypeFromName,
  formatFileSize,
  reviewStatuses,
  type AgencyDeliverable,
  type DeliverableCategory,
  type DeliverableDraft,
  type DesignCheckpoint,
  type ReviewStatus,
} from "@/data/files";
import { MAX_FILE_SIZE_LABEL, validateUploadFile } from "@/data/fileUploadConfig";
import { cn } from "@/lib/cn";


const emptyDraft: DeliverableDraft = {
  name: "",
  description: "",
  category: "Website Page",
  status: "Draft",
  designCheckpoint: null,
};

type DeliverableFormModalProps = {
  open: boolean;
  deliverable?: AgencyDeliverable | null;
  onClose: () => void;
  onSubmit: (draft: DeliverableDraft, file: File | null) => Promise<boolean>;
};

export function DeliverableFormModal({ open, deliverable, onClose, onSubmit }: DeliverableFormModalProps) {
  const [draft, setDraft] = useState<DeliverableDraft>(emptyDraft);
  const formId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const editing = Boolean(deliverable);

  useEffect(() => {
    if (!open) return;
    setDraft(
      deliverable
        ? {
            name: deliverable.name,
            description: deliverable.description,
            category: deliverable.category,
            status: deliverable.status === "Archived" ? "Draft" : deliverable.status,
            designCheckpoint: deliverable.designCheckpoint,
          }
        : emptyDraft,
    );
    setFile(null);
    setError(null);
    setUploading(false);
  }, [deliverable, open]);

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
      icon={FilePlus}
      title={editing ? "Edit Deliverable" : "New Deliverable"}
      description={
        editing
          ? "Update the deliverable name, description, or category. Review status stays the same."
          : "Create a project deliverable. Upload a first version now, or add versions later."
      }
      size="xl"
      onClose={onClose}
      footer={
        <DialogActions
          formId={formId}
          submitLabel={uploading ? "Saving…" : editing ? "Save changes" : "Create Deliverable"}
          onCancel={onClose}
          busy={uploading}
          disabled={Boolean(error)}
        />
      }
    >
      <form id={formId} className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
        <DialogSection title="Deliverable" icon={FileText}>
          <div className="space-y-4">
            <DialogField label="Deliverable name" required>
              <input
                required
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className={dialogInputClass}
                placeholder="For example, Homepage design"
              />
            </DialogField>
            <DialogField label="Description">
              <textarea
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                className={dialogTextareaClass}
              />
            </DialogField>
          </div>
        </DialogSection>

        <DialogSection title="Details" icon={Tags}>
          <div className="grid gap-4 sm:grid-cols-2">
            <DialogField label="Category" className={editing ? "sm:col-span-2" : undefined}>
              <DialogSelect
                value={draft.category}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, category: event.target.value as DeliverableCategory }))
                }
              >
                {deliverableCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </DialogSelect>
            </DialogField>
            {editing ? null : (
              <DialogField label="Initial status">
                <DialogSelect
                  value={draft.status}
                  onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ReviewStatus }))}
                >
                  {reviewStatuses.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </DialogSelect>
              </DialogField>
            )}
            <DialogField
              label="Design checkpoint"
              className="sm:col-span-2"
              hint="Only set this for the deliverable that IS one of the three design approval checkpoints."
            >
              <DialogSelect
                value={draft.designCheckpoint ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    designCheckpoint: (event.target.value || null) as DesignCheckpoint | null,
                  }))
                }
              >
                <option value="">Not a checkpoint</option>
                {designCheckpoints.map((item) => (
                  <option key={item} value={item}>
                    {designCheckpointLabel(item)}
                  </option>
                ))}
              </DialogSelect>
            </DialogField>
          </div>
        </DialogSection>

        {editing ? null : (
          <DialogSection title="First version" icon={Upload} description="Optional. You can also add versions later.">
            <label
              className={cn(
                "flex cursor-pointer items-center gap-4 rounded-[var(--admin-radius)] border border-dashed px-4 py-4 transition-colors",
                error ? "border-[#e8a39b] bg-[rgb(220_38_38_/_0.04)]" : "border-[#c7d0dd] bg-[var(--admin-bg)] hover:border-[rgb(0_80_240_/_0.45)] hover:bg-[rgb(0_80_240_/_0.03)]",
                uploading && "pointer-events-none opacity-60",
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--admin-blue)] ring-1 ring-[var(--admin-line)]">
                <Upload size={18} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--admin-ink)]">
                  {file ? file.name : "Choose a file to upload"}
                </span>
                <span className="mt-0.5 block text-[12px] text-[var(--admin-muted)]">
                  {file
                    ? `${fileTypeFromName(file.name, file.type)} · ${formatFileSize(file.size)}`
                    : `Stored privately. Maximum ${MAX_FILE_SIZE_LABEL}.`}
                </span>
              </span>
              <span className="hidden shrink-0 rounded-lg border border-[var(--admin-line)] bg-white px-3 py-1.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] sm:inline-flex">
                {file ? "Change" : "Browse"}
              </span>
              <input
                type="file"
                accept={fileInputAccept}
                disabled={uploading}
                className="sr-only"
                onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {error ? <p className="text-[13px] font-medium text-[#b42318]">{error}</p> : null}
          </DialogSection>
        )}

        {uploading ? (
          <div>
            <p className="text-sm font-medium text-[var(--admin-ink)]">Uploading…</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--admin-line)]">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#0050F0,#00C8FF)]" />
            </div>
          </div>
        ) : null}
      </form>
    </AdminDialog>
  );
}
