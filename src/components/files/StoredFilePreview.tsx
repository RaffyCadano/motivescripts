import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { FileTypeIcon } from "@/components/admin/projects/FileTypeIcon";
import { signedUrlForPath } from "@/data/fileStorage";
import { canPreviewAsImage, canPreviewAsPdf, hasStoredFile } from "@/data/fileUploadConfig";
import type { AgencyFileVersion } from "@/data/files";
import type { PinComment } from "@/data/pinComments";
import { AgencyDbError } from "@/lib/dbErrors";

type PreviewState =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "ready"; url: string; kind: "image" | "pdf" | "other" }
  | { status: "error"; message: string };

export function useSignedFilePreview(version: AgencyFileVersion | null): PreviewState {
  const [state, setState] = useState<PreviewState>({ status: "empty" });

  useEffect(() => {
    if (!version || !hasStoredFile(version)) {
      setState({ status: "empty" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    const kind = canPreviewAsImage(version.fileType, version.mimeType)
      ? "image"
      : canPreviewAsPdf(version.fileType, version.mimeType)
        ? "pdf"
        : "other";
    signedUrlForPath(version.storagePath as string)
      .then((url) => {
        if (!cancelled) setState({ status: "ready", url, kind });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof AgencyDbError ? error.message : "Unable to open this file.";
        setState({ status: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return state;
}

type StoredFilePreviewProps = {
  version: AgencyFileVersion;
  className?: string;
  /** Pin comments to render as markers over the image. Images only -- never wired up for PDFs. */
  pins?: PinComment[];
  /** Called with the click position as a 0-100 percentage of the image, for placing a new pin. */
  onImageClick?: (xPct: number, yPct: number) => void;
  renderPinMarker?: (pin: PinComment, index: number) => ReactNode;
};

export function StoredFilePreview({ version, className, pins, onImageClick, renderPinMarker }: StoredFilePreviewProps) {
  const preview = useSignedFilePreview(version);

  function handleImageClick(event: MouseEvent<HTMLImageElement>) {
    if (!onImageClick) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xPct = ((event.clientX - rect.left) / rect.width) * 100;
    const yPct = ((event.clientY - rect.top) / rect.height) * 100;
    onImageClick(Math.max(0, Math.min(100, xPct)), Math.max(0, Math.min(100, yPct)));
  }

  if (preview.status === "loading") {
    return (
      <div className={className ?? "flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center"}>
        <p className="font-heading text-sm font-semibold">Preparing preview…</p>
        <p className="mt-1 text-[13px] opacity-70">Loading the stored file.</p>
      </div>
    );
  }

  if (preview.status === "error") {
    return (
      <div className={className ?? "flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center"}>
        <FileTypeIcon fileType={version.fileType} />
        <p className="mt-3 font-heading text-sm font-semibold">Unable to open this file.</p>
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed opacity-70">{preview.message}</p>
      </div>
    );
  }

  if (preview.status === "ready" && preview.kind === "image") {
    if (!pins && !onImageClick) {
      return (
        <img
          src={preview.url}
          alt={`Preview of ${version.fileName}`}
          className="mx-auto max-h-80 object-contain"
        />
      );
    }

    return (
      <div className="relative mx-auto w-fit">
        <img
          src={preview.url}
          alt={`Preview of ${version.fileName}`}
          className={onImageClick ? "max-h-80 cursor-crosshair object-contain" : "max-h-80 object-contain"}
          onClick={onImageClick ? handleImageClick : undefined}
        />
        {(pins ?? []).map((pin, index) => (
          <div
            key={pin.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pin.xPct}%`, top: `${pin.yPct}%` }}
          >
            {renderPinMarker ? (
              renderPinMarker(pin, index)
            ) : (
              <span className="flex size-6 items-center justify-center rounded-full bg-[var(--admin-blue)] text-[11px] font-semibold text-white shadow">
                {index + 1}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (preview.status === "ready" && preview.kind === "pdf") {
    return (
      <iframe
        title={`Preview of ${version.fileName}`}
        src={preview.url}
        className="h-80 w-full bg-white"
      />
    );
  }

  return (
    <div className={className ?? "flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center"}>
      <FileTypeIcon fileType={version.fileType} />
      <p className="mt-3 font-heading text-sm font-semibold">
        {hasStoredFile(version) ? "Preview unavailable" : "No file uploaded yet"}
      </p>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed opacity-70">
        {hasStoredFile(version)
          ? `${version.fileType} files can be downloaded. Inline preview isn’t available for this type.`
          : "This version has metadata only. Upload a file to store it in Supabase Storage."}
      </p>
    </div>
  );
}
