import { useMemo, useState } from "react";
import { Eye, ExternalLink } from "lucide-react";
import { AdminActionsMenu, type AdminActionsMenuItem } from "@/components/admin/AdminActionsMenu";
import { TeamEmptyState } from "@/components/team/TeamEmptyState";
import { useTeamWork } from "@/components/team/useTeamWork";
import { developerDeploymentRows, type DeveloperDeploymentRow } from "@/data/developerOverview";
import { deploymentStatuses, formatDeploymentWhen, type DeploymentStatus } from "@/data/projectDevelopment";
import { teamProjectHref } from "@/data/teamWorkspace";
import { displayHttpHost, safeHttpHref } from "@/lib/safeUrl";
import { cn } from "@/lib/cn";

export function TeamDeployments() {
  const { myProjects } = useTeamWork();
  const deployments = useMemo(() => developerDeploymentRows(myProjects), [myProjects]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DeploymentStatus | "All">("All");

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return deployments.filter((row) => {
      if (status !== "All" && row.development.deploymentStatus !== status) return false;
      if (!needle) return true;
      return (
        row.projectName.toLowerCase().includes(needle) ||
        row.development.repositoryUrl.toLowerCase().includes(needle) ||
        row.development.hostingProvider.toLowerCase().includes(needle)
      );
    });
  }, [deployments, search, status]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Deployments</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">
          Starter template, repository, staging, production, and hosting for your projects.
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
              placeholder="Search project, repository, or hosting"
              className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as DeploymentStatus | "All")}
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
        <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-[var(--admin-line)] bg-[var(--admin-bg)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <tr>
                <th className="px-4 py-3 font-heading">Project</th>
                <th className="px-4 py-3 font-heading">Status</th>
                <th className="px-4 py-3 font-heading">Template</th>
                <th className="px-4 py-3 font-heading">Repository</th>
                <th className="px-4 py-3 font-heading">Staging</th>
                <th className="px-4 py-3 font-heading">Production</th>
                <th className="px-4 py-3 font-heading">Hosting</th>
                <th className="px-4 py-3 font-heading">Last deployed</th>
                <th className="px-4 py-3 font-heading">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-line)]">
              {visible.map((row) => (
                <DeploymentRow key={row.projectId} row={row} />
              ))}
            </tbody>
          </table>
        </div>
          )}
        </>
      )}
    </div>
  );
}

function UrlCell({ value }: { value: string }) {
  const display = displayHttpHost(value);
  if (!display) return <span className="text-[var(--admin-muted)]">Not configured</span>;
  return <span className="text-[var(--admin-ink)]">{display}</span>;
}

function DeploymentRow({ row }: { row: DeveloperDeploymentRow }) {
  const { development } = row;
  const templateHref = safeHttpHref(development.templateRepositoryUrl);
  const repoHref = safeHttpHref(development.repositoryUrl);
  const stagingHref = safeHttpHref(development.stagingUrl);
  const productionHref = safeHttpHref(development.productionUrl);

  const items: AdminActionsMenuItem[] = [
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

  return (
    <tr className="hover:bg-[var(--admin-bg)]">
      <td className="px-4 py-3 align-middle font-medium text-[var(--admin-ink)]">{row.projectName}</td>
      <td className="px-4 py-3 align-middle">
        <DeploymentStatusBadge status={development.deploymentStatus} />
      </td>
      <td className="px-4 py-3 align-middle">
        <UrlCell value={development.templateRepositoryUrl} />
      </td>
      <td className="px-4 py-3 align-middle">
        <UrlCell value={development.repositoryUrl} />
        {development.repositoryBranch.trim() ? (
          <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{development.repositoryBranch}</p>
        ) : null}
      </td>
      <td className="px-4 py-3 align-middle">
        <UrlCell value={development.stagingUrl} />
      </td>
      <td className="px-4 py-3 align-middle">
        <UrlCell value={development.productionUrl} />
      </td>
      <td className="px-4 py-3 align-middle text-[var(--admin-muted)]">{development.hostingProvider.trim() || "—"}</td>
      <td className="px-4 py-3 align-middle text-[var(--admin-muted)]">{formatDeploymentWhen(development.lastDeployedAt)}</td>
      <td className="px-4 py-3 align-middle">
        <AdminActionsMenu ariaLabel={`Actions for ${row.projectName}`} iconOnly items={items} />
      </td>
    </tr>
  );
}

const deploymentStatusStyles: Record<DeploymentStatus, string> = {
  "Not deployed": "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
  Development: "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  Staging: "bg-[rgb(245_158_11_/_0.12)] text-[#b45309]",
  Production: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  "Deployment issue": "bg-[rgb(220_38_38_/_0.1)] text-[#b91c1c]",
};

function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight",
        deploymentStatusStyles[status],
      )}
    >
      {status}
    </span>
  );
}
