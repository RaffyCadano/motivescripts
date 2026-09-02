import { Link, useLocation, useNavigate } from "react-router-dom";
import { useClientProjects, useLeads } from "@/components/admin/leads/LeadsProvider";
import { ClientPreProjectOverview } from "@/components/admin/clients/ClientPreProjectOverview";
import { useClientWorkflowState } from "@/components/admin/clients/ClientPreProjectStatus";
import { ProjectOverview } from "@/components/admin/projects/ProjectOverview";
import { useProjectWorkflowState } from "@/components/admin/projects/useProjectWorkflowState";
import type { AgencyClient } from "@/data/agencyClients";

type ClientOperationsOverviewProps = {
  client: AgencyClient;
  canManageProjects: boolean;
  createHref: string;
  onInvite?: () => void;
  onAddNote: () => void;
};

export function ClientOperationsOverview({
  client,
  canManageProjects,
  createHref,
  onInvite,
  onAddNote,
}: ClientOperationsOverviewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { portalAccounts } = useLeads();
  const projects = useClientProjects(client.id);
  const project = projects[0] ?? null;
  const portalLinked = portalAccounts.some((account) => account.clientId === client.id && account.role === "client");
  const clientWorkflow = useClientWorkflowState(client);
  const projectWorkflow = useProjectWorkflowState(project, client, portalLinked);

  function onOpenTab(tab: string) {
    navigate({ pathname: location.pathname, hash: tab }, { replace: true });
  }

  return (
    <div className="space-y-6">
      {projects.length > 1 && project ? (
        <p className="text-sm text-[var(--admin-muted)]">
          Showing primary project.{" "}
          <Link to={{ pathname: location.pathname, hash: "projects" }} className="font-semibold text-[var(--admin-blue)] hover:underline">
            View all {projects.length} projects
          </Link>
        </p>
      ) : null}

      {project ? (
        <ProjectOverview project={project} client={client} workflow={projectWorkflow} onOpenTab={onOpenTab} />
      ) : (
        <ClientPreProjectOverview
          client={client}
          workflow={clientWorkflow}
          canManageProjects={canManageProjects}
          createHref={createHref}
          onInvite={onInvite}
          onOpenTab={onOpenTab}
          onAddNote={onAddNote}
        />
      )}
    </div>
  );
}
