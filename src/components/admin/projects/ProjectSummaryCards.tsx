import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, FileText, Globe, Mail, Phone, Users } from "lucide-react";
import { adminGhostBtn } from "@/components/admin/adminActionStyles";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { initialsFromName } from "@/auth/userDisplay";
import type { AgencyClient } from "@/data/agencyClients";
import { formatClientDate } from "@/data/agencyClients";
import type { AgencyProject } from "@/data/agencyProjects";
import { portalStatusLabel } from "@/data/invitation";
import { projectPackageLabels } from "@/data/projectPackages";
import { suggestProjectPackage } from "@/data/scopePackageHint";
import { scopeStatus, type ClientScopeBrief } from "@/data/scopeBriefs";
import { cn } from "@/lib/cn";
import { displayHttpHost } from "@/lib/safeUrl";

/** A summary card for the project overview: an icon, a title, then whatever the card holds. */
function Card({ icon: Icon, title, children }: { icon: typeof Users; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="flex items-center gap-2.5 font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
          <Icon size={15} strokeWidth={2} aria-hidden="true" />
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-[var(--admin-muted)]">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-[var(--admin-ink)]">{value}</dd>
    </div>
  );
}

function SiteLink({ label, href }: { label: string; href: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-2">
      <span className="text-[12px] text-[var(--admin-muted)]">{label}</span>
      {href ? (
        <a
          className="inline-flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-[var(--admin-blue)] hover:underline"
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          <span className="truncate">{displayHttpHost(href)}</span>
          <ExternalLink size={13} strokeWidth={2.2} className="shrink-0" aria-hidden="true" />
        </a>
      ) : (
        <span className="text-sm text-[var(--admin-muted)]">Not available yet</span>
      )}
    </div>
  );
}

/** Status and progress at the top, the numbers that matter as a small grid, and the two site links. */
export function ProjectFactsCard({
  project,
  progress,
  deliverables,
  pages,
  features,
  stagingHref,
  productionHref,
}: {
  project: AgencyProject;
  progress: number;
  deliverables: { approved: number; total: number };
  pages: number | null;
  features: number | null;
  stagingHref: string | null;
  productionHref: string | null;
}) {
  return (
    <Card icon={FileText} title="Project">
      <div className="flex items-center justify-between gap-3">
        <ProjectStatusBadge status={project.status} />
        <span className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{progress}%</span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--admin-line)]"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Project progress"
      >
        <div className="h-full rounded-full bg-[var(--admin-blue)]" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <Fact label="Type" value={project.type} />
        <Fact label="Deliverables" value={deliverables.total > 0 ? `${deliverables.approved}/${deliverables.total} approved` : "None yet"} />
        <Fact label="Pages" value={pages === null ? "—" : pages} />
        <Fact label="Features" value={features === null ? "—" : features} />
      </dl>
      <div className="mt-4 space-y-2">
        <SiteLink label="Staging" href={stagingHref} />
        <SiteLink label="Production" href={productionHref} />
      </div>
    </Card>
  );
}

/** Who the client is, how to reach them, and whether they have a portal login. */
export function ProjectClientCard({
  client,
  portalLinked,
  portalStatus,
  canInvite,
  onInvite,
}: {
  client: AgencyClient;
  portalLinked: boolean;
  portalStatus: Parameters<typeof portalStatusLabel>[0];
  canInvite: boolean;
  onInvite: () => void;
}) {
  const phone = client.phone !== "—" ? client.phone : "";
  return (
    <Card icon={Users} title="Client">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[rgb(0_80_240_/_0.1)] font-heading text-sm font-semibold text-[var(--admin-blue)]"
        >
          {initialsFromName(client.contactName)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold text-[var(--admin-ink)]">{client.contactName}</p>
          <p className="truncate text-[12px] text-[var(--admin-muted)]">{client.businessName}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        <li className="flex items-center gap-2.5">
          <Mail size={15} strokeWidth={2} className="shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
          <a className="truncate text-[var(--admin-blue)] hover:underline" href={`mailto:${client.email}`}>
            {client.email}
          </a>
        </li>
        <li className="flex items-center gap-2.5">
          <Phone size={15} strokeWidth={2} className="shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
          {phone ? (
            <a className="text-[var(--admin-ink)] hover:underline" href={`tel:${phone.replace(/[^+\d]/g, "")}`}>
              {phone}
            </a>
          ) : (
            <span className="text-[var(--admin-muted)]">Not provided</span>
          )}
        </li>
      </ul>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-2">
        <span className="text-[12px] text-[var(--admin-muted)]">Client portal</span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-ink)]">
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", portalLinked ? "bg-emerald-500" : "bg-amber-400")}
          />
          {portalStatusLabel(portalStatus)}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={`/admin/clients/${client.id}`} className={adminGhostBtn}>
          Manage client
        </Link>
        {!portalLinked && canInvite ? (
          <button type="button" className={adminGhostBtn} onClick={onInvite}>
            Invite
          </button>
        ) : null}
      </div>
    </Card>
  );
}

/** What the client asked for: page and feature counts as two big numbers, when it was submitted, and the goal on demand. */
export function ProjectScopeCard({
  loading,
  brief,
  pages,
  features,
  open,
  onToggle,
  clientId,
}: {
  loading: boolean;
  brief: ClientScopeBrief | null;
  pages: number;
  features: number;
  open: boolean;
  onToggle: () => void;
  clientId: string | null;
}) {
  const hasScope = Boolean(brief) && scopeStatus(brief) !== "not_started";
  return (
    <Card icon={Globe} title="Website scope">
      {loading ? (
        <p className="text-sm text-[var(--admin-muted)]">Loading…</p>
      ) : brief && hasScope ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-3">
              <p className="font-heading text-2xl font-semibold text-[var(--admin-ink)]">{pages}</p>
              <p className="text-[12px] text-[var(--admin-muted)]">page{pages === 1 ? "" : "s"}</p>
            </div>
            <div className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-3">
              <p className="font-heading text-2xl font-semibold text-[var(--admin-ink)]">{features}</p>
              <p className="text-[12px] text-[var(--admin-muted)]">feature{features === 1 ? "" : "s"}</p>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-[var(--admin-muted)]">
            {brief.submittedAt ? `Submitted ${formatClientDate(brief.submittedAt)}` : "Draft saved"}
            {brief.requestedPackage
              ? ` · Requested ${projectPackageLabels[brief.requestedPackage]}`
              : ` · Not sure of a package (suggested ${projectPackageLabels[suggestProjectPackage(brief.selectedPages, brief.features).package]})`}
          </p>
          <button type="button" className={`${adminGhostBtn} mt-4`} onClick={onToggle}>
            {open ? "Hide scope" : "View scope"}
          </button>
          {open ? (
            <div className="mt-4 space-y-2 border-t border-[var(--admin-line)] pt-4 text-sm text-[var(--admin-muted)]">
              {brief.goal.trim() ? <p>{brief.goal.trim()}</p> : null}
              {clientId ? (
                <Link
                  to={`/admin/clients/${clientId}#website-scope`}
                  className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                >
                  Open full scope on client
                </Link>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-[var(--admin-muted)]">No scope submitted yet.</p>
      )}
    </Card>
  );
}
