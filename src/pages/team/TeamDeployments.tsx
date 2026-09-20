import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Eye, ExternalLink, Rocket } from "lucide-react";
import { AdminActionsMenu, type AdminActionsMenuItem } from "@/components/admin/AdminActionsMenu";
import { DomainHostingStatusBadge } from "@/components/admin/projects/ProjectDevelopmentSection";
import { HealthStateBadge } from "@/components/admin/projects/WebsiteHealthCard";
import { DeploymentStatusBadge } from "@/components/team/DeploymentStatusBadge";
import { TeamEmptyState } from "@/components/team/TeamEmptyState";
import { useTeamWork } from "@/components/team/useTeamWork";
import { launchGateItems, readinessCounts } from "@/data/deploymentReadiness";
import { developerDeploymentRows, type DeveloperDeploymentRow } from "@/data/developerOverview";
import { deploymentStatuses, formatDeploymentWhen, type DeploymentStatus } from "@/data/projectDevelopment";
import { teamDeploymentHref, teamProjectHref } from "@/data/teamWorkspace";
import { currentHealthState, type WebsiteHealthCheck, type WebsiteHealthEnvironment } from "@/data/websiteHealth";
import { fetchLatestWebsiteHealthByProject } from "@/data/websiteHealthRepository";
import { displayHttpHost, safeHttpHref } from "@/lib/safeUrl";

type HealthByEnvironment = Record<WebsiteHealthEnvironment, Map<string, WebsiteHealthCheck>>;

const emptyHealth: HealthByEnvironment = { production: new Map(), staging: new Map() };

export function TeamDeployments() {
  const { myProjects, deliverables } = useTeamWork();
  const deployments = useMemo(() => developerDeploymentRows(myProjects), [myProjects]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DeploymentStatus | "All">("All");
  const [health, setHealth] = useState<HealthByEnvironment>(emptyHealth);
  const [healthLoaded, setHealthLoaded] = useState(false);

  const projectIdsKey = deployments.map((row) => row.projectId).join(",");

  // Latest stored check per project and environment, via the existing batched RPC.
  // Non-fatal: rows still render (health just stays unknown) if this fails.
  useEffect(() => {
    let cancelled = false;
    const ids = projectIdsKey ? projectIdsKey.split(",") : [];
    if (ids.length === 0) {
      setHealth(emptyHealth);
      setHealthLoaded(true);
      return;
    }
    setHealthLoaded(false);
    Promise.all([
      fetchLatestWebsiteHealthByProject(ids, "production"),
      fetchLatestWebsiteHealthByProject(ids, "staging"),
    ])
      .then(([production, staging]) => {
        if (!cancelled) setHealth({ production, staging });
      })
      .catch(() => {
        if (!cancelled) setHealth(emptyHealth);
      })
      .finally(() => {
        if (!cancelled) setHealthLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectIdsKey]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return deployments.filter((row) => {
      if (status !== "All" && row.development.deploymentStatus !== status) return false;
      if (!needle) return true;
      return (
        row.projectName.toLowerCase().includes(needle) ||
        row.development.repositoryUrl.toLowerCase().includes(needle) ||
        row.development.hostingProvider.toLowerCase().includes(needle) ||
        row.development.domainName.toLowerCase().includes(needle)
      );
    });
  }, [deployments, search, status]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Deployments</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">
          Repository, staging, production, hosting, and domain delivery for your projects. Deployment status, hosting,
          and domain are tracked by hand; website health comes from real server-side checks.
        </p>
      </div>

      {deployments.length === 0 ? (
        <TeamEmptyState title="No deployment information available." body="Deployment status for your projects will show up here." />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search project, repository, hosting, or domain"
              aria-label="Search deployments"
              className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as DeploymentStatus | "All")}
              aria-label="Filter by deployment status"
              className="h-10 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
            >
              <option value="All">All statuses</option>
              {deploymentStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {visible.length === 0 ? (
            <TeamEmptyState title="No deployments match your filters." body="Try a different search term or status." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {visible.map((row) => (
                <DeploymentCard
                  key={row.projectId}
                  row={row}
                  health={health}
                  healthLoaded={healthLoaded}
                  deliverables={deliverables}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type RowProps = {
  row: DeveloperDeploymentRow;
  health: HealthByEnvironment;
  healthLoaded: boolean;
  deliverables: ReturnType<typeof useTeamWork>["deliverables"];
};

function actionItems(row: DeveloperDeploymentRow): AdminActionsMenuItem[] {
  const { development } = row;
  const templateHref = safeHttpHref(development.templateRepositoryUrl);
  const repoHref = safeHttpHref(development.repositoryUrl);
  const stagingHref = safeHttpHref(development.stagingUrl);
  const productionHref = safeHttpHref(development.productionUrl);
  return [
    { id: "details", label: "View deployment details", icon: Rocket, href: teamDeploymentHref(row.projectId) },
    { id: "view", label: "View project", icon: Eye, href: teamProjectHref(row.projectId) },
    ...(templateHref
      ? [{ id: "template", label: "Open Template", icon: ExternalLink, href: templateHref, separatorBefore: true }]
      : []),
    ...(repoHref
      ? [{ id: "repo", label: "Open Repository", icon: ExternalLink, href: repoHref, separatorBefore: !templateHref }]
      : []),
    ...(stagingHref ? [{ id: "staging", label: "Open Staging", icon: ExternalLink, href: stagingHref }] : []),
    ...(productionHref ? [{ id: "production", label: "Open Production", icon: ExternalLink, href: productionHref }] : []),
  ];
}

function EnvironmentCell({
  url,
  check,
  healthLoaded,
}: {
  url: string;
  check: WebsiteHealthCheck | undefined;
  healthLoaded: boolean;
}) {
  const href = safeHttpHref(url);
  if (!href) return <span className="text-[var(--admin-muted)]">Not configured</span>;
  return (
    <div className="space-y-1">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-words text-[var(--admin-ink)] hover:text-[var(--admin-blue)] hover:underline"
      >
        {displayHttpHost(url)}
      </a>
      <div>
        {healthLoaded ? (
          <HealthStateBadge state={check ? currentHealthState([check]) : "unknown"} />
        ) : (
          <span className="text-[12px] text-[var(--admin-muted)]">Checking health…</span>
        )}
      </div>
    </div>
  );
}

function SourceCell({ row }: { row: DeveloperDeploymentRow }) {
  const { development } = row;
  const href = safeHttpHref(development.repositoryUrl);
  if (!href) return <span className="text-[var(--admin-muted)]">Not configured</span>;
  return (
    <div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-words text-[var(--admin-ink)] hover:text-[var(--admin-blue)] hover:underline"
      >
        {displayHttpHost(development.repositoryUrl)}
      </a>
      {development.repositoryBranch.trim() ? (
        <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">Branch: {development.repositoryBranch}</p>
      ) : (
        <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">No branch set</p>
      )}
    </div>
  );
}

function HostingDomainCell({ row }: { row: DeveloperDeploymentRow }) {
  const { development } = row;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[var(--admin-ink)]">{development.hostingProvider.trim() || "No host set"}</span>
        <DomainHostingStatusBadge status={development.hostingStatus} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="break-words text-[var(--admin-ink)]">{development.domainName.trim() || "No domain set"}</span>
        <DomainHostingStatusBadge status={development.domainStatus} />
      </div>
    </div>
  );
}

function LaunchCell({ row, deliverables }: { row: DeveloperDeploymentRow; deliverables: RowProps["deliverables"] }) {
  const launched = row.development.deploymentStatus === "Production" || row.project.status === "Completed";
  const projectDeliverables = useMemo(
    () => deliverables.filter((item) => item.projectId === row.projectId),
    [deliverables, row.projectId],
  );
  const counts = useMemo(
    () => readinessCounts(launchGateItems(row.project, projectDeliverables)),
    [row.project, projectDeliverables],
  );

  if (launched) {
    return (
      <span className="inline-flex items-center rounded-full bg-[rgb(16_185_129_/_0.1)] px-2 py-0.5 font-heading text-[11px] font-semibold text-[#0f7a56]">
        Launched
      </span>
    );
  }
  return (
    <Link
      to={teamDeploymentHref(row.projectId)}
      className="whitespace-nowrap text-[var(--admin-ink)] hover:text-[var(--admin-blue)] hover:underline"
      title="Workflow gates satisfied so far. Payment is confirmed separately by Admin/PM."
    >
      {counts.met} of {counts.total} gates
    </Link>
  );
}

function CardField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)]">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

function DeploymentCard({ row, health, healthLoaded, deliverables }: RowProps) {
  const { development } = row;
  return (
    <article className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={teamDeploymentHref(row.projectId)}
            className="font-heading text-base font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)] hover:underline"
          >
            {row.projectName}
          </Link>
          <div className="mt-1.5">
            <DeploymentStatusBadge status={development.deploymentStatus} />
          </div>
        </div>
        <AdminActionsMenu ariaLabel={`Actions for ${row.projectName}`} iconOnly items={actionItems(row)} />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CardField label="Staging">
          <EnvironmentCell url={development.stagingUrl} check={health.staging.get(row.projectId)} healthLoaded={healthLoaded} />
        </CardField>
        <CardField label="Production">
          <EnvironmentCell
            url={development.productionUrl}
            check={health.production.get(row.projectId)}
            healthLoaded={healthLoaded}
          />
        </CardField>
        <CardField label="Source">
          <SourceCell row={row} />
        </CardField>
        <CardField label="Hosting & domain">
          <HostingDomainCell row={row} />
        </CardField>
        <CardField label="Launch">
          <LaunchCell row={row} deliverables={deliverables} />
        </CardField>
        <CardField label="Last deployed">
          <span className="text-[var(--admin-muted)]">{formatDeploymentWhen(development.lastDeployedAt)}</span>
        </CardField>
      </dl>
    </article>
  );
}
