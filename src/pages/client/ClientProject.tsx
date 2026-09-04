import { Link, useParams } from "react-router-dom";
import { ClientActionCard } from "@/components/client/ClientActionCard";
import { ClientProjectCard } from "@/components/client/ClientProjectCard";
import { ClientProjectSwitcher } from "@/components/client/ClientProjectSwitcher";
import { ClientWebsiteSection } from "@/components/client/ClientWebsiteSection";
import { ClientDiscoveryCard } from "@/components/client/ClientDiscoveryCard";
import { ClientTaskRequestsCard } from "@/components/client/ClientTaskRequestsCard";
import { ClientScopePrompt } from "@/components/client/ClientScopePrompt";
import { useClientDiscovery } from "@/components/client/useClientDiscovery";
import { useClientTaskRequests } from "@/components/client/useClientTaskRequests";
import { ClientTimeline } from "@/components/client/ClientTimeline";
import { useClientPortalAction } from "@/components/client/useClientPortalAction";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { currentMilestone } from "@/data/agencyProjects";
import { displayMilestoneName } from "@/data/projectMilestones";
import { timelineStagesFromProject } from "@/data/clientProjectProgress";

export function ClientProject() {
  const { projectId } = useParams();
  const session = usePortalSession();
  const { action, waiting, onboarding, loading } = useClientPortalAction();
  const project = projectId
    ? (session.projects.find((item) => item.id === projectId) ?? null)
    : session.project;
  const milestone = project ? currentMilestone(project) : null;
  const stages = timelineStagesFromProject(project);
  const discovery = useClientDiscovery(project?.id);
  const taskRequests = useClientTaskRequests(project?.id);

  if (projectId && !project) {
    return (
      <div className="w-full">
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight">Project not found</h1>
        <Link to="/client/project" className="mt-4 inline-flex font-heading text-sm font-semibold text-[var(--client-blue)] hover:underline">
          Back to project
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">My Project</h1>
        <p className="mt-1 text-sm text-[var(--client-muted)]">
          {project?.name ?? (onboarding.brief ? "Your project will appear here after we set it up." : "Tell us what you need first.")}
          {milestone ? ` · Current milestone: ${displayMilestoneName(milestone.name)}` : ""}
        </p>
      </header>

      <ClientProjectSwitcher projects={session.projects} activeId={project?.id ?? null} />

      <ClientScopePrompt brief={onboarding.brief} hasProject={Boolean(project)} />

      {project ? (
        <ClientDiscoveryCard
          projectId={project.id}
          projectName={project.name}
          intake={discovery.intake}
          loading={discovery.loading}
        />
      ) : null}

      {project ? (
        <ClientTaskRequestsCard
          projectId={project.id}
          pendingCount={taskRequests.pendingCount}
          loading={taskRequests.loading}
        />
      ) : null}

      {project ? (
        <ClientActionCard action={action} loading={loading} />
      ) : null}

      <ClientProjectCard
        project={project}
        nextLabel={action && action.kind !== "idle" ? action.title : "We’ll notify you when the next step is ready."}
      />

      {project ? <ClientWebsiteSection projectName={project.name} development={project.development} /> : null}

      {stages.length > 0 ? <ClientTimeline stages={stages} /> : null}

      {waiting.length > 1 && action?.kind === "review" ? (
        <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Also waiting</h2>
          <ul className="mt-3 space-y-3">
            {waiting.slice(1).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <p className="text-sm text-[var(--client-ink)]">{item.name}</p>
                <Link to={`/client/files/${item.id}`} className="font-heading text-[12px] font-semibold text-[var(--client-blue)] hover:underline">
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {project ? (
        <p className="text-sm text-[var(--client-muted)]">
          Have a question about your project?{" "}
          <Link
            to={`/client/messages?project=${project.id}`}
            className="font-heading font-semibold text-[var(--client-blue)] hover:underline"
          >
            Message MotiveScripts
          </Link>
        </p>
      ) : null}
    </div>
  );
}
