import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ClientActionCard } from "@/components/client/ClientActionCard";
import { ClientActivity } from "@/components/client/ClientActivity";
import { ClientDocumentAttention } from "@/components/client/ClientDocumentAttention";
import { ClientFiles } from "@/components/client/ClientFiles";
import { ClientProjectCard } from "@/components/client/ClientProjectCard";
import { ClientTasks } from "@/components/client/ClientTasks";
import { ClientTimeline } from "@/components/client/ClientTimeline";
import { usePortalIdentity, usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { currentVersion, versionLabel } from "@/data/files";
import { formatProjectDate } from "@/data/agencyProjects";
import { awaitingReview, canClientReview } from "@/data/review";
import { greetingForHour } from "@/data/clientPortal";
import { clientTasksFromProject, timelineStagesFromProject } from "@/data/clientProjectProgress";
import { useMessaging } from "@/providers/MessagingProvider";

export function ClientOverview() {
  const identity = usePortalIdentity();
  const greeting = useMemo(() => greetingForHour(new Date().getHours(), identity.firstName), [identity.firstName]);
  const { project, files } = usePortalSession();
  const { unreadMessageCount, conversations } = useMessaging();
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

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">{greeting}</h1>
        <p className="mt-1 text-sm text-[var(--client-muted)]">Here’s the latest on your project.</p>
      </header>

      <ClientProjectCard />
      <ClientDocumentAttention />
      {unreadMessageCount > 0 ? (
        <p className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] px-4 py-3 text-sm text-[var(--client-ink)]">
          You have {unreadMessageCount} unread message{unreadMessageCount === 1 ? "" : "s"}.{" "}
          <Link to="/client/messages" className="font-heading font-semibold text-[var(--client-blue)] hover:underline">
            Open messages
          </Link>
        </p>
      ) : conversations.length > 0 ? (
        <p className="text-sm text-[var(--client-muted)]">
          Latest conversation: {conversations[0]?.subject}.{" "}
          <Link to="/client/messages" className="font-heading font-semibold text-[var(--client-blue)] hover:underline">
            View messages
          </Link>
        </p>
      ) : null}
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
