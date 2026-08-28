import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import type { AppNotification, ConversationSummary } from "@/data/messaging";
import {
  fetchConversations,
  fetchNotifications,
  markAllNotificationsRead as markAllNotificationsReadRecord,
  markConversationRead as markConversationReadRecord,
  markNotificationRead as markNotificationReadRecord,
  sendMessage as sendMessageRecord,
  setConversationStatus as setConversationStatusRecord,
  startConversation as startConversationRecord,
  subscribeMessaging,
} from "@/data/messagingRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { mapMessageRow, type ConversationMessage } from "@/data/messaging";

type MessagingContextValue = {
  conversations: ConversationSummary[];
  notifications: AppNotification[];
  loadStatus: "idle" | "loading" | "ready" | "error";
  loadError: string | null;
  unreadMessageCount: number;
  unreadNotificationCount: number;
  realtimeReady: boolean;
  reload: () => Promise<void>;
  startConversation: (input: {
    subject: string;
    body: string;
    projectId?: string | null;
    clientId?: string | null;
  }) => Promise<string | null>;
  sendMessage: (conversationId: string, body: string) => Promise<ConversationMessage | null>;
  markConversationRead: (conversationId: string) => Promise<void>;
  setConversationStatus: (conversationId: string, status: "open" | "closed") => Promise<boolean>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
};

const MessagingContext = createContext<MessagingContextValue | null>(null);

export function MessagingProvider({ children }: { children: ReactNode }) {
  const { loading: authLoading, session, profile, profileStatus } = useAuth();
  const { clients, projects, notify } = useLeads();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const lookupRef = useRef({ clients, projects });
  lookupRef.current = { clients, projects };

  const lookup = useMemo(
    () => ({
      clients: clients.map((item) => ({ id: item.id, businessName: item.businessName, contactName: item.contactName })),
      projects: projects.map((item) => ({ id: item.id, name: item.name })),
    }),
    [clients, projects],
  );

  const reload = useCallback(async () => {
    const userId = session?.user.id;
    const role = profile?.role;
    if (!userId || (role !== "admin" && role !== "staff" && role !== "client")) {
      setConversations([]);
      setNotifications([]);
      setLoadStatus("ready");
      setLoadError(null);
      return;
    }
    const [nextConversations, nextNotifications] = await Promise.all([
      fetchConversations(userId, lookupRef.current),
      fetchNotifications(),
    ]);
    setConversations(nextConversations);
    setNotifications(nextNotifications);
    setLoadStatus("ready");
    setLoadError(null);
  }, [profile?.role, session?.user.id]);

  useEffect(() => {
    let cancelled = false;
    if (authLoading || (session && profileStatus === "loading")) {
      setLoadStatus("loading");
      return;
    }
    if (!session || profileStatus !== "ready" || !profile || (profile.role !== "admin" && profile.role !== "staff" && profile.role !== "client")) {
      setConversations([]);
      setNotifications([]);
      setLoadStatus("ready");
      setLoadError(null);
      return;
    }
    setLoadStatus("loading");
    Promise.all([fetchConversations(session.user.id, lookupRef.current), fetchNotifications()])
      .then(([nextConversations, nextNotifications]) => {
        if (cancelled) return;
        setConversations(nextConversations);
        setNotifications(nextNotifications);
        setLoadStatus("ready");
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof AgencyDbError ? error.message : "Unable to load messages.";
        setLoadError(message);
        setLoadStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, profile, profileStatus, session]);

  useEffect(() => {
    setConversations((current) => {
      let changed = false;
      const next = current.map((item) => {
        const client = lookup.clients.find((entry) => entry.id === item.clientId);
        const project = item.projectId ? lookup.projects.find((entry) => entry.id === item.projectId) : undefined;
        const clientName = client?.businessName ?? item.clientName;
        const contactName = client?.contactName ?? item.contactName;
        const projectName = project?.name ?? item.projectName;
        if (clientName === item.clientName && contactName === item.contactName && projectName === item.projectName) {
          return item;
        }
        changed = true;
        return { ...item, clientName, contactName, projectName };
      });
      return changed ? next : current;
    });
  }, [lookup]);

  useEffect(() => {
    const userId = session?.user.id;
    const role = profile?.role;
    if (!userId || !profile || (role !== "admin" && role !== "staff" && role !== "client") || profileStatus !== "ready") {
      setRealtimeReady(false);
      return;
    }
    const unsubscribe = subscribeMessaging({
      userId,
      clientId: profile.clientId,
      role,
      onConversationsChange: () => {
        void reload().catch(() => undefined);
      },
      onNotificationsChange: () => {
        void fetchNotifications()
          .then(setNotifications)
          .catch(() => undefined);
      },
    });
    setRealtimeReady(true);
    const onFocus = () => {
      void reload().catch(() => undefined);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [profile, profileStatus, reload, session?.user.id]);

  const startConversation = useCallback(
    async (input: { subject: string; body: string; projectId?: string | null; clientId?: string | null }) => {
      try {
        const row = await startConversationRecord(input);
        await reload();
        return row.id;
      } catch (error) {
        notify(error instanceof AgencyDbError ? error.message : "Unable to start this conversation.");
        return null;
      }
    },
    [notify, reload],
  );

  const sendMessage = useCallback(
    async (conversationId: string, body: string) => {
      try {
        const row = await sendMessageRecord(conversationId, body);
        void reload().catch(() => undefined);
        return mapMessageRow(row);
      } catch (error) {
        notify(error instanceof AgencyDbError ? error.message : "Unable to send this message.");
        return null;
      }
    },
    [notify, reload],
  );

  const markConversationRead = useCallback(async (conversationId: string) => {
    try {
      await markConversationReadRecord(conversationId);
      setConversations((current) => {
        const match = current.find((item) => item.id === conversationId);
        if (!match || match.unreadCount === 0) return current;
        return current.map((item) => (item.id === conversationId ? { ...item, unreadCount: 0 } : item));
      });
    } catch {
      /* read receipts are best-effort; list refresh will reconcile */
    }
  }, []);

  const setConversationStatus = useCallback(
    async (conversationId: string, status: "open" | "closed") => {
      try {
        await setConversationStatusRecord(conversationId, status);
        await reload();
        return true;
      } catch (error) {
        notify(error instanceof AgencyDbError ? error.message : "Unable to update this conversation.");
        return false;
      }
    },
    [notify, reload],
  );

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      try {
        await markNotificationReadRecord(notificationId);
        setNotifications((current) =>
          current.map((item) =>
            item.id === notificationId ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item,
          ),
        );
      } catch (error) {
        notify(error instanceof AgencyDbError ? error.message : "Unable to update notifications.");
      }
    },
    [notify],
  );

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await markAllNotificationsReadRecord();
      const now = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to update notifications.");
    }
  }, [notify]);

  const value = useMemo<MessagingContextValue>(
    () => ({
      conversations,
      notifications,
      loadStatus,
      loadError,
      unreadMessageCount: conversations.reduce((sum, item) => sum + item.unreadCount, 0),
      unreadNotificationCount: notifications.filter((item) => !item.readAt).length,
      realtimeReady,
      reload,
      startConversation,
      sendMessage,
      markConversationRead,
      setConversationStatus,
      markNotificationRead,
      markAllNotificationsRead,
    }),
    [
      conversations,
      loadError,
      loadStatus,
      markAllNotificationsRead,
      markConversationRead,
      markNotificationRead,
      notifications,
      realtimeReady,
      reload,
      sendMessage,
      setConversationStatus,
      startConversation,
    ],
  );

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

export function useMessaging(): MessagingContextValue {
  const value = useContext(MessagingContext);
  if (!value) {
    throw new Error("useMessaging must be used within MessagingProvider");
  }
  return value;
}
