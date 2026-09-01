import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ConversationList } from "@/components/messaging/ConversationList";
import { ConversationThread } from "@/components/messaging/ConversationThread";
import { StartConversationDialog } from "@/components/messaging/StartConversationDialog";
import { messagingClasses } from "@/components/messaging/messagingTheme";
import { useAuth } from "@/auth/AuthProvider";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useMessaging } from "@/providers/MessagingProvider";
import { fetchConversationById } from "@/data/messagingRepository";
import { findPrimaryConversation, type ConversationSummary, type MessagingTone } from "@/data/messaging";
import { hasPermission } from "@/auth/permissions";
import { cn } from "@/lib/cn";

type MessagingWorkspaceProps = {
  tone: MessagingTone;
  basePath: string;
  showHeading?: boolean;
};

export function MessagingWorkspace({ tone, basePath, showHeading = true }: MessagingWorkspaceProps) {
  const { conversationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { clients, projects } = useLeads();
  const messaging = useMessaging();
  const styles = messagingClasses(tone);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeBusy, setComposeBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [missing, setMissing] = useState(false);
  const [extraConversation, setExtraConversation] = useState<ConversationSummary | null>(null);
  const [isLg, setIsLg] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false,
  );

  const queryClientId = searchParams.get("client") ?? "";
  const queryProjectId = searchParams.get("project") ?? "";
  const composeFlag = searchParams.get("compose");

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsLg(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (messaging.loadStatus !== "ready") return;
    if (conversationId) return;

    const clientId = queryClientId || undefined;
    const projectId = queryProjectId || undefined;
    if (clientId || projectId) {
      const match = findPrimaryConversation(messaging.conversations, { clientId, projectId });
      if (match) {
        navigate(`${basePath}/${match.id}`, { replace: true });
        return;
      }
      setComposeOpen(true);
      return;
    }

    if (composeFlag === "new") {
      setComposeOpen(true);
    }
  }, [basePath, composeFlag, conversationId, messaging.conversations, messaging.loadStatus, navigate, queryClientId, queryProjectId]);

  useEffect(() => {
    let cancelled = false;
    if (!conversationId || !user) {
      setExtraConversation(null);
      setMissing(false);
      return;
    }
    const listed = messaging.conversations.find((item) => item.id === conversationId);
    if (listed) {
      setExtraConversation(null);
      setMissing(false);
      return;
    }
    if (messaging.loadStatus !== "ready") return;
    void fetchConversationById(conversationId, user.id, {
      clients: clients.map((item) => ({ id: item.id, businessName: item.businessName, contactName: item.contactName })),
      projects: projects.map((item) => ({ id: item.id, name: item.name })),
    })
      .then((row) => {
        if (cancelled) return;
        setExtraConversation(row);
        setMissing(!row);
      })
      .catch(() => {
        if (cancelled) return;
        setExtraConversation(null);
        setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clients, conversationId, messaging.conversations, messaging.loadStatus, projects, user]);

  const active =
    messaging.conversations.find((item) => item.id === conversationId) ?? extraConversation;
  const showList = isLg || !conversationId;
  const showThread = isLg || Boolean(conversationId);
  const canPickClient = tone === "admin";

  const markConversationRead = messaging.markConversationRead;
  const markRead = useCallback(async () => {
    if (!conversationId) return;
    await markConversationRead(conversationId);
  }, [conversationId, markConversationRead]);

  const listedConversations =
    queryClientId && !conversationId
      ? messaging.conversations.filter((item) => item.clientId === queryClientId)
      : messaging.conversations;
  const emptyTitle = tone === "admin" ? "No conversations yet" : "No messages yet";
  const emptyDescription =
    tone === "admin"
      ? "Messages are for client questions that do not belong to a proposal, contract, invoice, review, or file."
      : "Have a question about your project? Start a conversation with MotiveScripts.";

  return (
    <div className="flex min-h-0 flex-col gap-4">
      {showHeading && (!conversationId || isLg) ? (
        <header>
          <h1 className={cn("font-heading text-[1.5rem] font-semibold tracking-tight md:text-[1.65rem]", styles.ink)}>
            Messages
          </h1>
          <p className={cn("mt-1 text-sm", styles.muted)}>
            {tone === "admin"
              ? "Client questions that do not belong to a proposal, contract, invoice, review, or file."
              : "Questions and communication with MotiveScripts. Proposals, contracts, invoices, and file review stay in their own sections."}
          </p>
        </header>
      ) : null}

      {messaging.loadStatus === "error" ? (
        <div className={cn("border px-5 py-8 text-center", styles.radius, styles.line, styles.card)}>
          <p className={cn("font-heading text-sm font-semibold", styles.ink)}>Unable to load messages.</p>
          <p className={cn("mt-1 text-sm", styles.muted)}>{messaging.loadError}</p>
          <button
            type="button"
            className={cn("mt-4 inline-flex h-10 items-center rounded-lg px-4 font-heading text-sm font-semibold text-white", styles.blueBtn)}
            onClick={() => void messaging.reload()}
          >
            Try again
          </button>
        </div>
      ) : (
        <div
          className={cn(
            "grid min-h-[32rem] overflow-hidden border lg:min-h-[calc(100svh-12rem)] lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]",
            styles.radius,
            styles.line,
            styles.card,
          )}
        >
          {showList ? (
            <ConversationList
              tone={tone}
              basePath={basePath}
              conversations={listedConversations}
              activeId={conversationId}
              loading={messaging.loadStatus === "loading"}
              emptyTitle={emptyTitle}
              emptyDescription={emptyDescription}
              showClient={tone === "admin"}
              onNew={() => setComposeOpen(true)}
            />
          ) : null}

          {showThread ? (
            missing && conversationId ? (
              <div className="flex flex-1 flex-col justify-center px-6 py-10">
                <p className={cn("font-heading text-sm font-semibold", styles.ink)}>Conversation not found</p>
                <p className={cn("mt-1 text-sm", styles.muted)}>
                  This conversation isn’t available on your account.
                </p>
                <button
                  type="button"
                  className={cn("mt-4 inline-flex font-heading text-sm font-semibold", tone === "admin" ? "text-[var(--admin-blue)]" : "text-[var(--client-blue)]")}
                  onClick={() => navigate(basePath)}
                >
                  Back to messages
                </button>
              </div>
            ) : active && user ? (
              <ConversationThread
                tone={tone}
                basePath={basePath}
                conversation={active}
                currentUserId={user.id}
                sending={sending}
                onMarkRead={markRead}
                onSend={async (body) => {
                  setSending(true);
                  const created = await messaging.sendMessage(active.id, body);
                  setSending(false);
                  return created;
                }}
                onCloseConversation={
                  hasPermission(profile, "messages.manage")
                    ? () => {
                        void messaging.setConversationStatus(active.id, "closed");
                      }
                    : undefined
                }
                onReopenConversation={
                  hasPermission(profile, "messages.manage")
                    ? () => {
                        void messaging.setConversationStatus(active.id, "open");
                      }
                    : undefined
                }
              />
            ) : (
              <div className="hidden flex-1 flex-col items-center justify-center px-6 py-10 text-center lg:flex">
                <p className={cn("font-heading text-sm font-semibold", styles.ink)}>Select a conversation</p>
                <p className={cn("mt-1 max-w-sm text-sm", styles.muted)}>
                  Or start one for questions like when you need content, whether a blog can be added later, or if a login
                  email bounced.
                </p>
              </div>
            )
          ) : null}
        </div>
      )}

      <StartConversationDialog
        open={composeOpen}
        tone={tone}
        canPickClient={canPickClient}
        conversations={messaging.conversations}
        clients={clients.map((item) => ({ id: item.id, businessName: item.businessName }))}
        projects={projects.map((item) => ({ id: item.id, name: item.name, clientId: item.clientId }))}
        initialClientId={queryClientId}
        initialProjectId={queryProjectId}
        busy={composeBusy}
        onClose={() => {
          setComposeOpen(false);
          if (searchParams.has("client") || searchParams.has("project") || searchParams.has("compose")) {
            const next = new URLSearchParams(searchParams);
            next.delete("client");
            next.delete("project");
            next.delete("compose");
            setSearchParams(next, { replace: true });
          }
        }}
        onSubmit={async (draft) => {
          setComposeBusy(true);
          try {
            const existing =
              !canPickClient || draft.clientId
                ? findPrimaryConversation(messaging.conversations, {
                    clientId: canPickClient ? draft.clientId : undefined,
                    projectId: draft.projectId || undefined,
                  })
                : null;
            if (existing) {
              const sent = await messaging.sendMessage(existing.id, draft.body);
              if (!sent) return false;
              navigate(`${basePath}/${existing.id}`);
              return true;
            }
            const id = await messaging.startConversation({
              subject: draft.subject,
              body: draft.body,
              projectId: draft.projectId || null,
              clientId: canPickClient ? draft.clientId : undefined,
            });
            if (!id) return false;
            navigate(`${basePath}/${id}`);
            return true;
          } finally {
            setComposeBusy(false);
          }
        }}
      />
    </div>
  );
}
