import { StoredFilePreview } from "@/components/files/StoredFilePreview";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { formatFileLong, formatFileSize, versionLabel, type AgencyFileVersion } from "@/data/files";
import { hasStoredFile } from "@/data/fileUploadConfig";

type VersionPreviewModalProps = {
  version: AgencyFileVersion | null;
  isCurrent: boolean;
  downloading?: boolean;
  onClose: () => void;
  onDownload: () => void;
};

export function VersionPreviewModal({
  version,
  isCurrent,
  downloading = false,
  onClose,
  onDownload,
}: VersionPreviewModalProps) {
  const stored = version ? hasStoredFile(version) : false;

  return (
    <AdminDialog
      open={Boolean(version)}
      size="lg"
      title={version ? version.fileName : "Preview"}
      description={version ? `${versionLabel(version.versionNumber)}${isCurrent ? " · Current" : ""}` : undefined}
      onClose={onClose}
    >
      {version ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-bg)]">
            <StoredFilePreview version={version} />
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Item label="Version" value={versionLabel(version.versionNumber)} />
            <Item label="File type" value={version.fileType} />
            <Item label="File size" value={formatFileSize(version.fileSize)} />
            <Item label="Uploaded by" value={version.uploadedBy} />
            <Item label="Uploaded" value={formatFileLong(version.uploadedAt)} />
            <Item label="Status" value={isCurrent ? "Current" : version.status} />
          </dl>
          {version.description ? (
            <p className="text-sm leading-relaxed text-[var(--admin-ink)]">{version.description}</p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
              onClick={onClose}
            >
              Close
            </button>
            {stored ? (
              <button
                type="button"
                disabled={downloading}
                className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-50"
                onClick={onDownload}
              >
                {downloading ? "Preparing download…" : "Download"}
              </button>
            ) : (
              <span className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-[12px] font-semibold text-[var(--admin-muted)]">
                No file uploaded yet
              </span>
            )}
          </div>
        </div>
      ) : null}
    </AdminDialog>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-[var(--admin-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-[var(--admin-ink)]">{value}</dd>
    </div>
  );
}
