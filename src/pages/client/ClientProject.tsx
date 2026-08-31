import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ClientActionCard } from "@/components/client/ClientActionCard";
import { ClientProjectCard } from "@/components/client/ClientProjectCard";
import { ClientScopePrompt } from "@/components/client/ClientScopePrompt";
import { ClientTimeline } from "@/components/client/ClientTimeline";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { fetchClientScopeBrief } from "@/data/scopeBriefsRepository";
import type { ClientScopeBrief } from "@/data/scopeBriefs";
import { currentMilestone } from "@/data/agencyProjects";
import { timelineStagesFromProject } from "@/data/clientProjectProgress";
import { currentVersion, versionLabel } from "@/data/files";
import { awaitingReview, canClientReview } from "@/data/review";

export function ClientProject() {
  const { projectId } = useParams();
  const session = usePortalSession();
  const [brief, setBrief] = useState<ClientScopeBrief | null>(null);
  const project = projectId
    ? (session.projects.find((item) => item.id === projectId) ?? null)
    : session.project;

  useEffect(() => {
    if (!session.client?.id || project) return;
    let active = true;
    void fetchClientScopeBrief(session.client.id)
      .then((row) => {
        if (active) setBrief(row);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [session.client?.id, project]);
  const files = project ? session.files.filter((item) => item.projectId === project.id) : [];
  const waiting = awaitingReview(files.filter((item) => item.status !== "Archived"));
  const first = waiting[0];
  const current = first ? currentVersion(first) : null;
  const milestone = project ? currentMilestone(project) : null;
  const stages = timelineStagesFromProject(project);

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
          {project?.name ?? (brief ? "Your project will appear here after we set it up." : "Tell us what you need first.")}
          {milestone ? ` · Current milestone: ${milestone.name}` : ""}
        </p>
      </header>

      <ClientScopePrompt brief={brief} hasProject={Boolean(project)} />
      <ClientProjectCard project={project} />
      {project ? (
        <p>
          <Link
            to={`/client/messages?project=${project.id}`}
            className="inline-flex h-10 items-center rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] px-4 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-bg)]"
          >
            Message MotiveScripts
          </Link>
        </p>
      ) : null}
      {stages.length > 0 ? <ClientTimeline stages={stages} /> : null}

      {project ? (
        <ClientActionCard
          action={
            first && current
              ? {
                  id: first.id,
                  title: `${first.name} ${versionLabel(current.versionNumber)} is ready for review.`,
                  body: "Review the current version and approve it or request changes.",
                  fileId: first.id,
                  reviewHref: `/client/files/${first.id}`,
                  canApprove: canClientReview(first),
                }
              : null
          }
        />
      ) : null}

      {waiting.length > 1 ? (
        <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Also waiting</h2>
          <ul className="mt-3 space-y-3">
            {waiting.slice(1).map((item) => {
              const version = currentVersion(item);
              return (
                <li key={item.id} className="flex items-center justify-between gap-3">
                  <p className="text-sm text-[var(--client-ink)]">
                    {item.name} {version ? versionLabel(version.versionNumber) : ""}
                  </p>
                  <Link to={`/client/files/${item.id}`} className="font-heading text-[12px] font-semibold text-[var(--client-blue)] hover:underline">
                    Review
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
