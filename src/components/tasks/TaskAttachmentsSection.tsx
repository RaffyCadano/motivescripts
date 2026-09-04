import { useEffect, useRef, useState } from "react";
import {
  listTaskAttachments,
  removeTaskAttachment,
  uploadTaskAttachment,
} from "@/data/taskAttachmentsRepository";
import type { TaskAttachment } from "@/data/taskAttachments";
import { signedUrlForPath } from "@/data/fileStorage";
import { MAX_FILE_SIZE_LABEL, fileInputAccept } from "@/data/fileUploadConfig";
import { AgencyDbError } from "@/lib/dbErrors";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskAttachmentsSection({
  taskId,
  projectId,
  uploadedByLabel,
}: {
  taskId: string;
  projectId: string;
  uploadedByLabel: string;
}) {
  const [files, setFiles] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    setLoading(true);
    try {
      setFiles(await listTaskAttachments(taskId));
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to load attachments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function onFileChosen(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadTaskAttachment({ projectId, taskId, uploadedByLabel, file });
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to upload this file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onRemove(file: TaskAttachment) {
    setBusy(true);
    setError(null);
    try {
      await removeTaskAttachment(file);
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to remove this file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold">Attachments</h3>
        <button
          type="button"
          disabled={busy}
          className="text-[12px] font-semibold text-[var(--admin-blue)] hover:underline disabled:opacity-50"
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : "Add file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={fileInputAccept}
          className="hidden"
          onChange={(event) => void onFileChosen(event.target.files?.[0])}
        />
      </div>
      <p className="mt-1 text-[11px] text-[var(--admin-muted)]">
        Working files for this task only (screenshots, reference docs) — up to {MAX_FILE_SIZE_LABEL}. Not client-visible; for
        client-reviewable deliverables use the project's Files tab instead.
      </p>
      {loading ? (
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Loading…</p>
      ) : files.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--admin-muted)]">No files attached yet.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="min-w-0 truncate text-left text-sm font-medium text-[var(--admin-blue)] hover:underline"
                onClick={() => void signedUrlForPath(file.storagePath).then((url) => window.open(url, "_blank"))}
              >
                {file.fileName}
              </button>
              <span className="shrink-0 text-[11px] text-[var(--admin-muted)]">{formatBytes(file.fileSize)}</span>
              <button
                type="button"
                disabled={busy}
                className="shrink-0 text-[11px] font-semibold text-[var(--admin-muted)] hover:text-[#b45309] disabled:opacity-50"
                onClick={() => void onRemove(file)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="mt-2 text-[12px] text-[#b45309]">{error}</p> : null}
    </section>
  );
}
