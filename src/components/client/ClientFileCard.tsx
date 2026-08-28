import { FileArchive, FileImage, LayoutTemplate } from "lucide-react";
import { Link } from "react-router-dom";
import { ClientStatusBadge } from "@/components/client/ClientStatusBadge";
import type { ClientFile, ClientFileKind, FileVersion } from "@/data/clientPortal";
import { cn } from "@/lib/cn";

const kindIcons: Record<ClientFileKind, typeof LayoutTemplate> = {
  design: LayoutTemplate,
  image: FileImage,
  archive: FileArchive,
};

const kindLabels: Record<ClientFileKind, string> = {
  design: "Design",
  image: "Image",
  archive: "Folder",
};

type ClientFileCardProps = {
  file: ClientFile;
  onView: (file: ClientFile, version: FileVersion) => void;
};

export function ClientFileCard({ file, onView }: ClientFileCardProps) {
  const Icon = kindIcons[file.kind];
  const current = file.versions.find((version) => version.status === "current") ?? file.versions[0];

  return (
    <article
      id={file.id}
      className="scroll-mt-4 rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)]"
    >
      <div className="flex flex-col gap-4 border-b border-[var(--client-line)] px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--client-hover)] text-[var(--client-blue)]">
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-base font-semibold tracking-tight text-[var(--client-ink)]">
                {file.name}
              </h2>
              {file.awaitingReview ? <ClientStatusBadge label="Awaiting Review" tone="review" /> : null}
              {!file.awaitingReview && current?.status === "final" ? (
                <ClientStatusBadge label="Final" tone="done" />
              ) : null}
            </div>
            <p className="mt-1 text-[13px] text-[var(--client-muted)]">
              {kindLabels[file.kind]}
              <span aria-hidden="true"> · </span>
              Current version {file.currentVersionLabel}
              <span aria-hidden="true"> · </span>
              {file.uploadedLabel}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
          onClick={() => current && onView(file, current)}
        >
          View {file.currentVersionLabel}
        </button>
      </div>

      <div className="px-5 py-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">
          Versions
        </h3>
        <ul className="mt-3 divide-y divide-[var(--client-line)] rounded-xl border border-[var(--client-line)]">
          {file.versions.map((version) => (
            <li key={version.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">{version.label}</p>
                <p className="mt-0.5 text-[12px] text-[var(--client-muted)]">
                  {version.uploadedLabel}
                  {version.approvedBy ? ` · Approved by ${version.approvedBy}` : null}
                  {version.approvedDate ? ` · ${version.approvedDate}` : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ClientStatusBadge
                  label={versionBadge(version).label}
                  tone={versionBadge(version).tone}
                />
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-9 items-center rounded-lg border border-[var(--client-line)] bg-white px-3 font-heading text-[12px] font-semibold text-[var(--client-ink)] hover:bg-[var(--client-bg)]",
                  )}
                  onClick={() => onView(file, version)}
                >
                  View
                </button>
              </div>
            </li>
          ))}
        </ul>

        {file.awaitingReview ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              to="/client/feedback"
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-bg)]"
            >
              Leave Feedback
            </Link>
            <Link
              to="/client/approvals"
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-bg)]"
            >
              Approve Version
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function versionBadge(version: FileVersion): { label: string; tone: "progress" | "review" | "done" | "neutral" } {
  if (version.status === "current") return { label: "Current", tone: "progress" };
  if (version.status === "final") return { label: "Final", tone: "done" };
  if (version.approvedBy) return { label: "Approved", tone: "done" };
  return { label: "Previous", tone: "neutral" };
}
