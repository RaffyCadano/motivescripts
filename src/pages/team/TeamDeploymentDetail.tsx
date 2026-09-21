import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Minus } from "lucide-react";
import { canCoordinateAssignedWork, hasPermission } from "@/auth/permissions";
import { adminGhostBtn, adminSoftBtn } from "@/components/admin/adminActionStyles";
import { DomainHostingStatusBadge } from "@/components/admin/projects/ProjectDevelopmentSection";
import { WebsiteHealthCard } from "@/components/admin/projects/WebsiteHealthCard";
import { DeploymentStatusBadge } from "@/components/team/DeploymentStatusBadge";
import { TeamDevelopmentEditor } from "@/components/team/TeamDevelopmentEditor";
import { TeamEmptyState } from "@/components/team/TeamEmptyState";
import { useTeamWork } from "@/components/team/useTeamWork";
import {
  deliverySetupItems,
  launchGateItems,
  readinessCounts,
  type ReadinessItem,
} from "@/data/deploymentReadiness";
import { formatDeploymentWhen } from "@/data/projectDevelopment";
import { teamProjectHref } from "@/data/teamWorkspace";
import type { WebsiteHealthEnvironment, WebsiteHealthState } from "@/data/websiteHealth";
import { displayHttpHost, safeHttpHref } from "@/lib/safeUrl";
import { cn } from "@/lib/cn";

const cardClass = "rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5";
const cardTitleClass = "font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]";

export function TeamDeploymentDetail() {
  const { id = "" } = useParams();
  const { profile, myProjects, deliverables, reload } = useTeamWork();
  const [editing, setEditing] = useState(false);
  const [productionHealth, setProductionHealth] = useState<WebsiteHealthState | null>(null);

  const project = useMemo(() => myProjects.find((item) => item.id === id) ?? null, [myProjects, id]);
  const projectDeliverables = useMemo(() => deliverables.filter((item) => item.projectId === id), [deliverables, id]);

  if (!project) {
    return (
      <div className="space-y-4">
        <BackLink />
        <TeamEmptyState
          title="Deployment not found"
          body="This project doesn't exist, or it isn't one of your projects."
        />
      </div>
    );
  }

  const { development } = project;
  const canManage = hasPermission(profile, "projects.manage");
  const stagingHref = safeHttpHref(development.stagingUrl);
  const productionHref = safeHttpHref(development.productionUrl);
  const repoHref = safeHttpHref(development.repositoryUrl);
  const templateHref = safeHttpHref(development.templateRepositoryUrl);

  const launched = development.deploymentStatus === "Production" || project.status === "Completed";
  const gates = launchGateItems(project, projectDeliverables);
  const gateCounts = readinessCounts(gates);
  const setup = deliverySetupItems(development, productionHref ? productionHealth : null);

  function onHealthState(environment: WebsiteHealthEnvironment, state: WebsiteHealthState) {
    if (environment === "production") setProductionHealth(state);
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">{project.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-[var(--admin-muted)]">
            <DeploymentStatusBadge status={development.deploymentStatus} />
            <span>Last deployed (entered manually): {formatDeploymentWhen(development.lastDeployedAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={teamProjectHref(project.id)} className={cn(adminGhostBtn, "h-9 px-3.5 text-[12px]")}>
            View project
          </Link>
          {canManage ? (
            <button type="button" className={cn(adminSoftBtn, "h-9 px-3.5 text-[12px]")} onClick={() => setEditing(true)}>
              Edit deployment details
            </button>
          ) : null}
        </div>
      </div>

      <section aria-label="Environments" className="space-y-3">
        <h2 className={cardTitleClass}>Environments</h2>
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {stagingHref ? (
            <WebsiteHealthCard
              projectId={project.id}
              productionUrl={development.productionUrl}
              stagingUrl={development.stagingUrl}
              canCheckNow={canManage}
              fixedEnvironment="staging"
            />
          ) : (
            <NotConfiguredCard title="Staging" body="No staging URL is configured for this project yet." />
          )}
          {productionHref ? (
            <WebsiteHealthCard
              projectId={project.id}
              productionUrl={development.productionUrl}
              stagingUrl={development.stagingUrl}
              canCheckNow={canManage}
              fixedEnvironment="production"
              onStateChange={onHealthState}
            />
          ) : (
            <NotConfiguredCard title="Production" body="No production URL is configured for this project yet." />
          )}
        </div>
      </section>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <section className={cardClass}>
          <h2 className={cardTitleClass}>Source</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Repository" value={development.repositoryUrl} href={repoHref} />
            <Field label="Branch" value={development.repositoryBranch} emptyLabel="No branch set" />
            <Field label="Starter template" value={development.templateRepositoryUrl} href={templateHref} />
          </dl>
          <p className="mt-4 border-t border-[var(--admin-line)] pt-3 text-[12px] text-[var(--admin-muted)]">
            Only the repository link and branch are stored. Latest commit, pull requests, and build status aren&apos;t
            available until a GitHub integration is connected.
          </p>
        </section>

        <section className={cardClass}>
          <h2 className={cardTitleClass}>Hosting &amp; domain</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Hosting</dt>
              <dd className="mt-1 space-y-1.5">
                <p className="break-all font-heading text-sm font-semibold text-[var(--admin-ink)]">
                  {development.hostingProvider.trim() || (
                    <span className="font-normal text-[var(--admin-muted)]">Not configured</span>
                  )}
                </p>
                <DomainHostingStatusBadge status={development.hostingStatus} />
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Domain</dt>
              <dd className="mt-1 space-y-1.5">
                <p className="break-all font-heading text-sm font-semibold text-[var(--admin-ink)]">
                  {development.domainName.trim() || (
                    <span className="font-normal text-[var(--admin-muted)]">Not configured</span>
                  )}
                </p>
                <DomainHostingStatusBadge status={development.domainStatus} />
              </dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-[var(--admin-line)] pt-3 text-[12px] text-[var(--admin-muted)]">
            Hosting and domain status are set by hand. SSL and DNS status aren&apos;t tracked in MotiveScripts.
          </p>
        </section>
      </div>

      <section className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className={cardTitleClass}>Launch readiness</h2>
          {launched ? (
            <span className="inline-flex items-center rounded-full bg-[rgb(16_185_129_/_0.1)] px-2 py-0.5 font-heading text-xs font-semibold text-[#0f7a56]">
              {project.status === "Completed" ? "Completed" : "Launched"}
            </span>
          ) : (
            <span className="text-[12px] text-[var(--admin-muted)]">
              {gateCounts.met} of {gateCounts.total} workflow gates met
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-[12px] font-semibold text-[var(--admin-ink)]">Launch gates</h3>
            <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
              Same checks the system enforces before a project can go live.
            </p>
            <ReadinessList items={gates} />
            <p className="mt-3 text-[12px] text-[var(--admin-muted)]">
              Launch also requires the final payment gate, which Admin/PM confirm separately.
            </p>
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-[var(--admin-ink)]">Delivery setup</h3>
            <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
              Informational only. These are tracked by hand and don&apos;t block launch.
            </p>
            <ReadinessList items={setup} />
          </div>
        </div>
      </section>

      <p className="text-[12px] text-[var(--admin-muted)]">
        Not available yet: deployment history, build and deploy logs, and automatic deploy, redeploy, or rollback. Those
        need a GitHub/Vercel integration, and MotiveScripts doesn&apos;t have one.
      </p>

      {editing ? (
        <TeamDevelopmentEditor
          projectId={project.id}
          development={development}
          canManageDomainHosting={canCoordinateAssignedWork(profile)}
          onClose={() => setEditing(false)}
          onSaved={() => void reload()}
        />
      ) : null}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/team/deployments"
      className="inline-flex items-center gap-1.5 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
    >
      <ArrowLeft size={14} aria-hidden="true" />
      All deployments
    </Link>
  );
}

function NotConfiguredCard({ title, body }: { title: string; body: string }) {
  return (
    <section className={cardClass}>
      <h2 className={cardTitleClass}>{title}</h2>
      <p className="mt-3 text-sm text-[var(--admin-muted)]">{body}</p>
    </section>
  );
}

function Field({
  label,
  value,
  href,
  emptyLabel = "Not configured",
}: {
  label: string;
  value: string;
  href?: string | null;
  emptyLabel?: string;
}): ReactNode {
  const display = value.trim() ? (href ? displayHttpHost(value) || value : value) : "";
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-[var(--admin-muted)]">{label}</dt>
      <dd className="mt-1 break-all">
        {display ? (
          href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)] hover:underline"
            >
              {display}
            </a>
          ) : (
            <span className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{display}</span>
          )
        ) : (
          <span className="text-sm text-[var(--admin-muted)]">{emptyLabel}</span>
        )}
      </dd>
    </div>
  );
}

function ReadinessList({ items }: { items: ReadinessItem[] }) {
  return (
    <ul className="mt-3 divide-y divide-[var(--admin-line)]">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-2.5 py-2 text-sm first:pt-0 last:pb-0">
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              item.met ? "bg-[rgb(16_185_129_/_0.12)] text-[#0f7a56]" : "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
            )}
          >
            {item.met ? (
              <Check size={12} strokeWidth={3} aria-hidden="true" />
            ) : (
              <Minus size={12} strokeWidth={3} aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0 flex-1 text-[var(--admin-ink)]">{item.label}</span>
          <span className="sr-only">{item.met ? "Met" : "Not met"}</span>
          {item.detail ? <span className="shrink-0 text-[12px] text-[var(--admin-muted)]">{item.detail}</span> : null}
        </li>
      ))}
    </ul>
  );
}
