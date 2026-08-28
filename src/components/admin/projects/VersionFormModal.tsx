import { useEffect, useState, type FormEvent } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import {
  fileTypeFromName,
  formatFileSize,
  nextVersionNumber,
  versionLabel,
  type AgencyDeliverable,
} from "@/data/files";
import {
  MAX_FILE_SIZE_LABEL,
  canPreviewAsImage,
  fileInputAccept,
  validateUploadFile,
} from "@/data/fileUploadConfig";

type VersionFormModalProps = {
  deliverable: AgencyDeliverable | null;
  onClose: () => void;
  onSubmit: (file: File, description: string) => Promise<boolean>;
};

export function VersionFormModal({ deliverable, onClose, onSubmit }: VersionFormModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!deliverable) return;
    setFile(null);
    setDescription("");
    setError(null);
    setUploading(false);
  }, [deliverable]);

  useEffect(() => {
    if (!file || !canPreviewAsImage(fileTypeFromName(file.name, file.type), file.type)) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const next = deliverable ? nextVersionNumber(deliverable.versions) : 1;

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
    if (!file || uploading) return;
    const invalid = validateUploadFile(file);
    if (invalid) {
      setError(invalid.message);
      return;
    }
    setUploading(true);
    setError(null);
    const ok = await onSubmit(file, description);
    setUploading(false);
    if (ok) onClose();
  }

  return (
    <AdminDialog
      open={Boolean(deliverable)}
      busy={uploading}
      title="Add Version"
      description={
        deliverable
          ? `${deliverable.name} will receive ${versionLabel(next)} as the current version. It will not be sent for review until you choose Send for Review.`
          : undefined
      }
      onClose={onClose}
    >
      <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          File
          <input
            required
            type="file"
            accept={fileInputAccept}
            disabled={uploading}
            className="mt-1.5 block w-full text-sm text-[var(--admin-ink)] file:mr-3 file:rounded-lg file:border file:border-[var(--admin-line)] file:bg-white file:px-3 file:py-1.5 file:font-heading file:text-[12px] file:font-semibold"
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          />
          <span className="mt-1 block text-[12px] font-normal text-[var(--admin-muted)]">
            Stored in the private project-files bucket. Maximum {MAX_FILE_SIZE_LABEL}.
          </span>
        </label>
        {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
        {file ? (
          <div className="rounded-lg bg-[var(--admin-bg)] px-3 py-3">
            {previewUrl ? (
              <img src={previewUrl} alt="" className="mb-3 max-h-40 rounded-md object-contain" />
            ) : null}
            <p className="text-sm font-medium text-[var(--admin-ink)]">{file.name}</p>
            <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
              {fileTypeFromName(file.name, file.type)} · {formatFileSize(file.size)}
            </p>
          </div>
        ) : null}
        {uploading ? (
          <div>
            <p className="text-sm font-medium text-[var(--admin-ink)]">Uploading…</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--admin-line)]">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#0050F0,#00C8FF)]" />
            </div>
          </div>
        ) : null}
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Description
          <textarea
            value={description}
            disabled={uploading}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </label>
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
            disabled={!file || Boolean(error) || uploading}
            className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-50"
          >
            {uploading ? "Uploading…" : `Add ${versionLabel(next)}`}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
