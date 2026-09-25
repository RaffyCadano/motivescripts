import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, CalendarClock, ChevronRight, ExternalLink, FileCheck, FileText, Files, Globe, Receipt, type LucideIcon } from "lucide-react";
import { adminGhostBtn } from "@/components/admin/adminActionStyles";
import { cn } from "@/lib/cn";
import { displayHttpHost } from "@/lib/safeUrl";

function PanelHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
          <Icon size={15} strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">{title}</h2>
          {subtitle ? <p className="text-[12px] text-[var(--admin-muted)]">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export type DocumentPanelRow = {
  id: "proposal" | "contract" | "invoice";
  label: string;
  /** The status text, or "Not created". */
  value: string;
  created: boolean;
  href?: string;
};

const DOCUMENT_ICONS: Record<DocumentPanelRow["id"], LucideIcon> = {
  proposal: FileText,
  contract: FileCheck,
  invoice: Receipt,
};

/** Proposal, contract and invoice as three tiles: what each is, its status, and a link in when it exists. */
export function ProjectDocumentsPanel({ rows, onOpenFiles }: { rows: DocumentPanelRow[]; onOpenFiles: () => void }) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <PanelHeader
        icon={Files}
        title="Documents"
        subtitle="Proposal, contract and invoice for this project."
        action={
          <button type="button" className={adminGhostBtn} onClick={onOpenFiles}>
            View project files
          </button>
        }
      />
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {rows.map((row) => {
          const Icon = DOCUMENT_ICONS[row.id];
          const body = (
            <>
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-ink)]">
                  <Icon size={16} strokeWidth={2} className={row.created ? "text-[var(--admin-blue)]" : "text-[var(--admin-muted)]"} aria-hidden="true" />
                  {row.label}
                </span>
                {row.href ? <ChevronRight size={16} strokeWidth={2.2} className="text-[var(--admin-muted)]" aria-hidden="true" /> : null}
              </span>
              <span
                className={cn(
                  "mt-2.5 inline-flex w-fit items-center rounded-full px-2.5 py-1 font-heading text-[12px] font-semibold",
                  row.created ? "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]" : "bg-[var(--admin-line)] text-[var(--admin-muted)]",
                )}
              >
                {row.value}
              </span>
            </>
          );
          const tileClass = cn(
            "flex flex-col rounded-lg border p-3.5",
            row.created ? "border-[var(--admin-line)] bg-[var(--admin-card)]" : "border-dashed border-[var(--admin-line)] bg-[var(--admin-bg)]",
          );
          return (
            <li key={row.id}>
              {row.href ? (
                <Link to={row.href} className={cn(tileClass, "transition-colors hover:border-[rgb(0_80_240_/_0.35)] hover:bg-[var(--admin-bg)]")}>
                  {body}
                </Link>
              ) : (
                <div className={tileClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SiteRow({ label, href }: { label: string; href: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-2.5">
      <span className="text-[12px] text-[var(--admin-muted)]">{label}</span>
      {href ? (
        <a className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[var(--admin-blue)] hover:underline" href={href} target="_blank" rel="noreferrer">
          <span className="truncate">{displayHttpHost(href)}</span>
          <ExternalLink size={13} strokeWidth={2.2} className="shrink-0" aria-hidden="true" />
        </a>
      ) : (
        <span className="text-sm text-[var(--admin-muted)]">Not available yet</span>
      )}
    </div>
  );
}

function DateFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--admin-line)] px-3 py-2.5">
      <Icon size={16} strokeWidth={2} className="shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[12px] text-[var(--admin-muted)]">{label}</p>
        <p className="truncate text-sm font-semibold text-[var(--admin-ink)]">{value}</p>
      </div>
    </div>
  );
}

/** Where the site lives (staging and production) and the two dates that matter, with the way to edit the URLs. */
export function ProjectWebsitePanel({
  stagingHref,
  productionHref,
  targetLaunch,
  started,
  onEditUrls,
  onOpenFiles,
}: {
  stagingHref: string | null;
  productionHref: string | null;
  targetLaunch: string;
  started: string;
  onEditUrls: () => void;
  onOpenFiles: () => void;
}) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <PanelHeader
        icon={Globe}
        title="Website"
        subtitle="Staging, production, and deliverables."
        action={
          <button type="button" className={adminGhostBtn} onClick={onEditUrls}>
            Edit URLs
          </button>
        }
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <SiteRow label="Staging" href={stagingHref} />
          <SiteRow label="Production" href={productionHref} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DateFact icon={CalendarClock} label="Target launch" value={targetLaunch} />
          <DateFact icon={CalendarCheck} label="Started" value={started} />
        </div>
      </div>
      <button
        type="button"
        className="mt-4 inline-flex items-center gap-1 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
        onClick={onOpenFiles}
      >
        View deliverables
        <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </section>
  );
}
