import { useEffect, useState } from "react";
import { StoredFilePreview } from "@/components/files/StoredFilePreview";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { formatFileLong, formatFileSize, versionLabel, type AgencyFileVersion } from "@/data/files";
import { hasStoredFile } from "@/data/fileUploadConfig";
import type { PinComment } from "@/data/pinComments";
import { listPinComments, resolvePinComment } from "@/data/pinCommentsRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

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
  const [pins, setPins] = useState<PinComment[]>([]);
  const [pinError, setPinError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    if (!version) {
      setPins([]);
      return;
    }
    let active = true;
    void listPinComments(version.id)
      .then((rows) => {
        if (active) setPins(rows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version?.id]);

  async function onResolve(pinId: string) {
    setResolvingId(pinId);
    setPinError(null);
    try {
      await resolvePinComment(pinId);
      if (version) setPins(await listPinComments(version.id));
    } catch (error) {
      setPinError(error instanceof AgencyDbError ? error.message : "Unable to resolve this pin.");
    } finally {
      setResolvingId(null);
    }
  }

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
            <StoredFilePreview
              version={version}
              pins={pins}
              renderPinMarker={(pin, index) => (
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow",
                    pin.status === "Resolved" ? "bg-[var(--admin-muted)]" : "bg-[var(--admin-blue)]",
                  )}
                  title={pin.body}
                >
                  {index + 1}
                </span>
              )}
            />
          </div>
          {pins.length > 0 ? (
            <div className="space-y-2 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white p-3">
              <p className="font-heading text-[12px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                Pin comments
              </p>
              <ul className="space-y-2">
                {pins.map((pin, index) => (
                  <li key={pin.id} className="flex items-start justify-between gap-3 text-sm">
                    <p className="text-[var(--admin-ink)]">
                      <span className="font-heading font-semibold">#{index + 1}</span> {pin.body}
                    </p>
                    {pin.status === "Open" ? (
                      <button
                        type="button"
                        disabled={resolvingId === pin.id}
                        className="shrink-0 text-[12px] font-semibold text-[var(--admin-blue)] hover:underline disabled:opacity-50"
                        onClick={() => void onResolve(pin.id)}
                      >
                        {resolvingId === pin.id ? "Resolving…" : "Resolve"}
                      </button>
                    ) : (
                      <span className="shrink-0 text-[12px] text-[var(--admin-muted)]">Resolved</span>
                    )}
                  </li>
                ))}
              </ul>
              {pinError ? <p className="text-sm text-[#b45309]">{pinError}</p> : null}
            </div>
          ) : null}
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
