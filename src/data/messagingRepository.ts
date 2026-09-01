import {
  CONVERSATION_LIST_LIMIT,
  MESSAGE_PAGE_SIZE,
  NOTIFICATION_LIST_LIMIT,
  mapConversationRow,
  mapMessageRow,
  mapNotificationRow,
  sortMessages,
  type AppNotification,
  type ConversationMessage,
  type ConversationSummary,
} from "@/data/messaging";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { ConversationRow, MessageRow } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type NameLookup = {
  clients: { id: string; businessName: string; contactName: string }[];
  projects: { id: string; name: string }[];
};

function db(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new AgencyDbError("Supabase is not configured. Add VITE_SUPABASE_URL and the publishable key.");
  }
  const client = getSupabase();
  if (!client) {
    throw new AgencyDbError("Supabase is not configured. Add VITE_SUPABASE_URL and the publishable key.");
  }
  return client;
}

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  throw new AgencyDbError(friendlyDbError(error, fallback), error);
}

function throwIf(error: unknown, context: string, fallback: string) {
  if (error) fail(context, error, fallback);
}

function firstRow<T>(data: T | T[] | null | undefined): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function namesFor(row: ConversationRow, lookup: NameLookup) {
  const client = lookup.clients.find((item) => item.id === row.client_id);
  const project = row.project_id ? lookup.projects.find((item) => item.id === row.project_id) : undefined;
  return {
    clientName: client?.businessName ?? "",
    contactName: client?.contactName ?? "",
    projectName: project?.name ?? null,
  };
}

export async function fetchConversationById(
  conversationId: string,
  userId: string,
  lookup: NameLookup,
): Promise<ConversationSummary | null> {
  const client = db();
  const { data, error } = await client.from("conversations").select("*").eq("id", conversationId).maybeSingle();
  throwIf(error, "load conversation", "Unable to load this conversation.");
  if (!data) return null;
  const { data: unread, error: unreadError } = await client
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .is("read_at", null)
    .neq("sender_user_id", userId);
  throwIf(unreadError, "load conversation", "Unable to load this conversation.");
  return mapConversationRow(data, unread?.length ?? 0, namesFor(data, lookup));
}

export async function fetchConversations(userId: string, lookup: NameLookup): Promise<ConversationSummary[]> {
  const client = db();
  const [convRes, unreadRes] = await Promise.all([
    client
      .from("conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(CONVERSATION_LIST_LIMIT),
    client.from("messages").select("conversation_id").is("read_at", null).neq("sender_user_id", userId).limit(4000),
  ]);
  throwIf(convRes.error, "load conversations", "Unable to load messages.");
  throwIf(unreadRes.error, "load unread messages", "Unable to load messages.");

  const unreadByConversation = new Map<string, number>();
  for (const row of unreadRes.data ?? []) {
    unreadByConversation.set(row.conversation_id, (unreadByConversation.get(row.conversation_id) ?? 0) + 1);
  }

  return (convRes.data ?? []).map((row) =>
    mapConversationRow(row, unreadByConversation.get(row.id) ?? 0, namesFor(row, lookup)),
  );
}

export async function fetchMessagesPage(
  conversationId: string,
  options?: { before?: string },
): Promise<{ messages: ConversationMessage[]; hasOlder: boolean }> {
  const client = db();
  let query = client
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_PAGE_SIZE + 1);
  if (options?.before) {
    query = query.lt("created_at", options.before);
  }
  const { data, error } = await query;
  throwIf(error, "load messages", "Unable to load this conversation.");
  const rows = data ?? [];
  const hasOlder = rows.length > MESSAGE_PAGE_SIZE;
  const page = hasOlder ? rows.slice(0, MESSAGE_PAGE_SIZE) : rows;
  return { messages: sortMessages(page.map(mapMessageRow)), hasOlder };
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const client = db();
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(NOTIFICATION_LIST_LIMIT);
  throwIf(error, "load notifications", "Unable to load notifications.");
  return (data ?? []).map(mapNotificationRow);
}

export async function startConversation(input: {
  subject: string;
  body: string;
  projectId?: string | null;
  clientId?: string | null;
}): Promise<ConversationRow> {
  const client = db();
  const { data, error } = await client.rpc("start_conversation", {
    p_subject: input.subject.trim(),
    p_body: input.body.trim(),
    p_project_id: input.projectId || null,
    p_client_id: input.clientId || null,
  });
  throwIf(error, "start conversation", "Unable to start this conversation.");
  const row = firstRow(data);
  if (!row) throw new AgencyDbError("Unable to start this conversation.");
  return row;
}

export async function sendMessage(conversationId: string, body: string): Promise<MessageRow> {
  const client = db();
  const { data, error } = await client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: body.trim(),
  });
  throwIf(error, "send message", "Unable to send this message.");
  const row = firstRow(data);
  if (!row) throw new AgencyDbError("Unable to send this message.");
  return row;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("mark_conversation_read", { p_conversation_id: conversationId });
  throwIf(error, "mark conversation read", "Unable to update read status.");
}

export async function setConversationStatus(conversationId: string, status: "open" | "closed"): Promise<ConversationRow> {
  const client = db();
  const { data, error } = await client.rpc("set_conversation_status", {
    p_conversation_id: conversationId,
    p_status: status,
  });
  throwIf(error, "update conversation", "Unable to update this conversation.");
  const row = firstRow(data);
  if (!row) throw new AgencyDbError("Unable to update this conversation.");
  return row;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("mark_notification_read", { p_notification_id: notificationId });
  throwIf(error, "mark notification read", "Unable to update notifications.");
}

export async function markAllNotificationsRead(): Promise<void> {
  const client = db();
  const { error } = await client.rpc("mark_all_notifications_read", {});
  throwIf(error, "mark notifications read", "Unable to update notifications.");
}

export async function clearNotifications(): Promise<void> {
  const client = db();
  const { error } = await client.rpc("clear_notifications", {});
  throwIf(error, "clear notifications", "Unable to clear notifications.");
}

export function subscribeMessaging(handlers: {
  userId: string;
  clientId: string | null;
  role: "admin" | "staff" | "client";
  onConversationsChange: () => void;
  onNotificationsChange: () => void;
}): () => void {
  const client = getSupabase();
  if (!client) return () => undefined;

  const conversationFilter = handlers.role === "client" && handlers.clientId ? `client_id=eq.${handlers.clientId}` : undefined;
  const conversationsChannel = client
    .channel(`ms-conversations:${handlers.userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "conversations",
        ...(conversationFilter ? { filter: conversationFilter } : {}),
      },
      () => handlers.onConversationsChange(),
    )
    .subscribe();

  const notificationsChannel = client
    .channel(`ms-notifications:${handlers.userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${handlers.userId}` },
      () => handlers.onNotificationsChange(),
    )
    .subscribe();

  return () => {
    void client.removeChannel(conversationsChannel);
    void client.removeChannel(notificationsChannel);
  };
}

export function subscribeConversationMessages(
  conversationId: string,
  onChange: (row: MessageRow, event: "INSERT" | "UPDATE" | "DELETE") => void,
): () => void {
  const client = getSupabase();
  if (!client) return () => undefined;
  const channel = client
    .channel(`ms-messages:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        const event = payload.eventType;
        if (event === "DELETE") return;
        const row = payload.new as MessageRow | undefined;
        if (!row?.id) return;
        onChange(row, event === "UPDATE" ? "UPDATE" : "INSERT");
      },
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
