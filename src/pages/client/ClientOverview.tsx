import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClientActionCard } from "@/components/client/ClientActionCard";
import { ClientActivity } from "@/components/client/ClientActivity";
import { ClientFiles } from "@/components/client/ClientFiles";
import { ClientPreProjectDashboard } from "@/components/client/ClientPreProjectDashboard";
import { ClientProjectCard } from "@/components/client/ClientProjectCard";
import { ClientPausedBanner } from "@/components/client/ClientPausedBanner";
import { ClientWebsiteSection } from "@/components/client/ClientWebsiteSection";
import { ClientStatusBadge } from "@/components/client/ClientStatusBadge";
import { ClientTimeline } from "@/components/client/ClientTimeline";
import { useClientPlanOffer } from "@/components/client/useClientPlanOffer";
import { useClientPortalAction } from "@/components/client/useClientPortalAction";
import { usePortalIdentity, usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { formatProjectDate, formatProjectDay } from "@/data/agencyProjects";
import { hasNoOpenPlans } from "@/data/clientPlanOffer";
import { greetingForHour } from "@/data/clientPortal";
import {
  daysUntil,
  fetchClientDeliveryStatus,
  isInLaunchTrial,
  timelineStagesFromProject,
  type ClientDeliveryStatus,
} from "@/data/clientProjectProgress";
import { fetchClientPortalWelcome } from "@/data/settingsRepository";
import { useMessaging } from "@/providers/MessagingProvider";

export function ClientOverview() {
  const identity = usePortalIdentity();
  const greeting = useMemo(() => greetingForHour(new Date().getHours(), identity.firstName), [identity.firstName]);
  const [welcome, setWelcome] = useState("");
  const { project } = usePortalSession();
  const { action, waiting, onboarding, loading } = useClientPortalAction();
  const { unreadMessageCount, conversations } = useMessaging();
  const planOffer = useClientPlanOffer();
  const [deliveryStatus, setDeliveryStatus] = useState<ClientDeliveryStatus | null>(null);

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

  useEffect(() => {
    if (!project?.id || !planOffer.launched) {
      setDeliveryStatus(null);
      return;
    }
    let active = true;
    void fetchClientDeliveryStatus(project.id)
      .then((status) => {
        if (active) setDeliveryStatus(status);
      })
      .catch(() => {
        if (active) setDeliveryStatus(null);
      });
    return () => {
      active = false;
    };
  }, [project?.id, planOffer.launched]);

  const inLaunchTrial = isInLaunchTrial(deliveryStatus);

  const stages = timelineStagesFromProject(project);
  const activity = (project?.activity ?? []).slice(0, 4).map((item) => ({
    id: item.id,
    description: item.description,
    time: formatProjectDate(item.createdAt),
    icon: (item.icon === "review" ? "approval" : item.icon === "file" ? "upload" : "status") as
      | "upload"
      | "approval"
      | "update"
      | "status",
  }));

  if (!project) {
    return (
      <div className="w-full space-y-6">
        <header>
          <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">{greeting}</h1>
          <p className="mt-1 text-sm text-[var(--client-muted)]">
            {onboarding.flags.scopeStatus === "submitted"
              ? "Thanks — we’ll use your answers to prepare your project and proposal."
              : onboarding.flags.scopeStatus === "in_progress"
                ? "Your scope is saved as a draft. Continue when you’re ready."
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

      {deliveryStatus?.pausedAt ? <ClientPausedBanner pausedAt={deliveryStatus.pausedAt} reason={deliveryStatus.pauseReason} note={deliveryStatus.pauseNote} /> : null}

      <ClientActionCard action={action} loading={loading} />

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

      {planOffer.launched && !planOffer.loading && hasNoOpenPlans(planOffer.plans) ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.25)] bg-[rgb(0_80_240_/_0.04)] p-5">
          <div className="min-w-0">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Your website is live</h2>
            <p className="mt-1 text-sm text-[var(--client-muted)]">
              Keep it running smoothly with an optional monthly plan: Website Care, Hosting, or SEO.
            </p>
            {inLaunchTrial && deliveryStatus?.launchTrialEndsAt ? (
              <p className="mt-2 text-[13px] font-medium text-[var(--client-ink)]">
                Free period ends {formatProjectDay(deliveryStatus.launchTrialEndsAt)} · {daysUntil(deliveryStatus.launchTrialEndsAt)} days remaining. After that your website is paused unless you have a Website Care plan.
              </p>
            ) : null}
          </div>
          <Link
            to="/client/plans"
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
          >
            Choose a plan
          </Link>
        </section>
      ) : null}

      <ClientProjectCard nextLabel={action && action.kind !== "idle" ? action.title : "We’ll notify you when the next step is ready."} />
      {project ? (
        <ClientWebsiteSection
          projectId={project.id}
          projectName={project.name}
          development={project.development}
          paused={Boolean(deliveryStatus?.pausedAt)}
        />
      ) : null}
      {stages.length > 0 ? <ClientTimeline stages={stages} /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <ClientActivity items={activity} />
        <ClientFiles />
      </div>

      <MessagesLine unread={unreadMessageCount} latestSubject={conversations[0]?.subject} />
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
  return (
    <p className="text-sm text-[var(--client-muted)]">
      Have a question about your project?{" "}
      <Link to="/client/messages" className="font-heading font-semibold text-[var(--client-blue)] hover:underline">
        Message MotiveScripts
      </Link>
    </p>
  );
}
