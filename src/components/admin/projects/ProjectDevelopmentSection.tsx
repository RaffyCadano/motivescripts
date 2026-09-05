import { Link } from "react-router-dom";
import { adminSoftBtn } from "@/components/admin/adminActionStyles";
import {
  formatDeploymentWhen,
  type DeploymentStatus,
  type ProjectDevelopment,
} from "@/data/projectDevelopment";
import { displayHttpHost, safeHttpHref } from "@/lib/safeUrl";
import { cn } from "@/lib/cn";

const statusTone: Record<DeploymentStatus, string> = {
  "Not deployed": "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
  Development: "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  Staging: "bg-[rgb(0_200_255_/_0.12)] text-[#0077aa]",
  Production: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  "Deployment issue": "bg-[rgb(220_38_38_/_0.08)] text-[#b42318]",
};

function DevelopmentStatus({ status }: { status: DeploymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight",
        statusTone[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
  );
}

function ExternalLinkButton({ href, label }: { href: string; label: string }) {
  const safe = safeHttpHref(href);
  if (!safe) return null;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className={`${adminSoftBtn} mt-2 h-9 min-w-[8.5rem] justify-center px-4 text-[12px]`}
    >
      {label}
    </a>
  );
}

function Field({
  label,
  value,
  href,
  linkLabel,
  emptyLabel = "Not configured",
}: {
  label: string;
  value: string;
  href?: string;
  linkLabel?: string;
  emptyLabel?: string;
}) {
  const display = value.trim() ? (href ? displayHttpHost(value) || value : value) : "";
  return (
    <div>
      <dt className="text-[12px] text-[var(--admin-muted)]">{label}</dt>
      <dd className="mt-1">
        {display ? (
          <p className="break-all font-heading text-sm font-semibold text-[var(--admin-ink)]">{display}</p>
        ) : (
          <p className="text-sm text-[var(--admin-muted)]">{emptyLabel}</p>
        )}
        {href && linkLabel ? <ExternalLinkButton href={href} label={linkLabel} /> : null}
      </dd>
    </div>
  );
}

type ProjectDevelopmentSectionProps = {
  development: ProjectDevelopment;
  editHref?: string;
  onEditClick?: () => void;
};

export function ProjectDevelopmentSection({ development, editHref, onEditClick }: ProjectDevelopmentSectionProps) {
  const repoHref = safeHttpHref(development.repositoryUrl);
  const templateHref = safeHttpHref(development.templateRepositoryUrl);
  const stagingHref = safeHttpHref(development.stagingUrl);
  const productionHref = safeHttpHref(development.productionUrl);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Development</h2>
        {editHref ? (
          <Link to={editHref} className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
            Edit
          </Link>
        ) : onEditClick ? (
          <button
            type="button"
            onClick={onEditClick}
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
          >
            Edit
          </button>
        ) : null}
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Starter template"
          value={development.templateRepositoryUrl}
          href={templateHref ?? undefined}
          linkLabel="Open Template"
        />
        <Field label="Repository" value={development.repositoryUrl} href={repoHref ?? undefined} linkLabel="Open Repository" />
        <Field label="Branch" value={development.repositoryBranch} />
        <Field label="Staging" value={development.stagingUrl} href={stagingHref ?? undefined} linkLabel="Open Staging" />
        <Field label="Production" value={development.productionUrl} href={productionHref ?? undefined} linkLabel="Open Production" />
        <Field label="Hosting" value={development.hostingProvider} />
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Deployment</dt>
          <dd className="mt-1">
            <DevelopmentStatus status={development.deploymentStatus} />
          </dd>
        </div>
        <Field
          label="Last deployment"
          value={development.lastDeployedAt ? formatDeploymentWhen(development.lastDeployedAt) : ""}
          emptyLabel="Not deployed"
        />
      </dl>
    </section>
  );
}
