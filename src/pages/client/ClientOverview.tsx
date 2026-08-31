import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClientActionCard } from "@/components/client/ClientActionCard";
import { ClientActivity } from "@/components/client/ClientActivity";
import { ClientDocumentAttention } from "@/components/client/ClientDocumentAttention";
import { ClientFiles } from "@/components/client/ClientFiles";
import { ClientPreProjectDashboard } from "@/components/client/ClientPreProjectDashboard";
import { ClientProjectCard } from "@/components/client/ClientProjectCard";
import { ClientStatusBadge } from "@/components/client/ClientStatusBadge";
import { ClientTasks } from "@/components/client/ClientTasks";
import { ClientTimeline } from "@/components/client/ClientTimeline";
import { usePortalOnboarding } from "@/components/client/usePortalOnboarding";
import { usePortalIdentity, usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { currentVersion, versionLabel } from "@/data/files";
import { formatProjectDate } from "@/data/agencyProjects";
import { awaitingReview, canClientReview } from "@/data/review";
import { greetingForHour } from "@/data/clientPortal";
import { fetchClientPortalWelcome } from "@/data/settingsRepository";
import { isProductionProject } from "@/data/preProject";
import { clientTasksFromProject, timelineStagesFromProject } from "@/data/clientProjectProgress";
import { useMessaging } from "@/providers/MessagingProvider";

export function ClientOverview() {
  const identity = usePortalIdentity();
  const greeting = useMemo(() => greetingForHour(new Date().getHours(), identity.firstName), [identity.firstName]);
  const [welcome, setWelcome] = useState("");
  const { project, files } = usePortalSession();
  const onboarding = usePortalOnboarding();
  const { unreadMessageCount, conversations } = useMessaging();

  useEffect(() => {
    let active = true;
    void fetchClientPortalWelcome()
      .then((message) => {
        if (active) setWelcome(message.trim());
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const waiting = awaitingReview(files.filter((item) => item.status !== "Archived"));
  const first = waiting[0];
  const current = first ? currentVersion(first) : null;
  const stages = timelineStagesFromProject(project);
  const tasks = clientTasksFromProject(project);
  const activity = (project?.activity ?? []).slice(0, 4).map((item) => ({
    id: item.id,
    description: item.description,
    time: formatProjectDate(item.createdAt),
    icon: (item.icon === "review" ? "approval" : item.icon === "file" ? "upload" : "status") as "upload" | "approval" | "update" | "status",
  }));
  const showOnboarding =
    !isProductionProject(project?.status) && onboarding.steps.some((step) => step.state === "current");

  if (!project) {
    return (
      <div className="w-full space-y-6">
        <header>
          <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">{greeting}</h1>
          <p className="mt-1 text-sm text-[var(--client-muted)]">
            {onboarding.flags.hasScope
              ? "Thanks — we’ll use your answers to prepare your project and proposal."
              : "Start by telling us what you need on the website."}
          </p>
        </header>
        {onboarding.loading ? (
          <div className="h-72 animate-pulse rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)]" />
        ) : (
          <ClientPreProjectDashboard
            firstName={identity.firstName}
            phaseLabel={onboarding.phaseLabel}
            phaseTone={onboarding.phaseTone}
            steps={onboarding.steps}
            projectName={null}
            hasProject={false}
          />
        )}
        <MessagesLine unread={unreadMessageCount} latestSubject={conversations[0]?.subject} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">{greeting}</h1>
          <p className="mt-1 text-sm text-[var(--client-muted)]">{welcome || "Here’s the latest on your project."}</p>
        </div>
        <ClientStatusBadge label={onboarding.phaseLabel} tone={onboarding.phaseTone} />
      </header>

      {showOnboarding && !onboarding.loading ? (
        <ClientPreProjectDashboard
          firstName={identity.firstName}
          phaseLabel={onboarding.phaseLabel}
          phaseTone={onboarding.phaseTone}
          steps={onboarding.steps}
          projectName={onboarding.flags.projectName}
          hasProject
        />
      ) : null}

      <ClientProjectCard />
      <ClientDocumentAttention />
      <MessagesLine unread={unreadMessageCount} latestSubject={conversations[0]?.subject} />
      {stages.length > 0 ? <ClientTimeline stages={stages} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]">
        <ClientActionCard
          action={
            first && current
              ? {
                  id: first.id,
                  title: `${first.name} ${versionLabel(current.versionNumber)} is ready for review.`,
                  body: "Review the current version and let us know if you’d like any changes.",
                  fileId: first.id,
                  reviewHref: `/client/files/${first.id}`,
                  canApprove: canClientReview(first),
                }
              : null
          }
        />
        {tasks.length > 0 ? <ClientTasks tasks={tasks} /> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ClientActivity items={activity} />
        <ClientFiles />
      </div>
    </div>
  );
}

function MessagesLine({ unread, latestSubject }: { unread: number; latestSubject?: string }) {
  if (unread > 0) {
    return (
      <p className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] px-4 py-3 text-sm text-[var(--client-ink)]">
        You have {unread} unread message{unread === 1 ? "" : "s"}.{" "}
        <Link to="/client/messages" className="font-heading font-semibold text-[var(--client-blue)] hover:underline">
          Open messages
        </Link>
      </p>
    );
  }
  if (latestSubject) {
    return (
      <p className="text-sm text-[var(--client-muted)]">
        Latest conversation: {latestSubject}.{" "}
        <Link to="/client/messages" className="font-heading font-semibold text-[var(--client-blue)] hover:underline">
          View messages
        </Link>
      </p>
    );
  }
  return null;
}
