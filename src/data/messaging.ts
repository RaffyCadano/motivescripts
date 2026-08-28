import { formatLeadDate, formatLeadTimestamp } from "@/data/leads";
import type {
  ConversationRow,
  ConversationStatus,
  MessageRow,
  MessageSenderRole,
  NotificationRow,
  NotificationType,
} from "@/types/database";

export const MESSAGE_MAX_LENGTH = 4000;
export const SUBJECT_MAX_LENGTH = 120;
export const CONVERSATION_LIST_LIMIT = 100;
export const MESSAGE_PAGE_SIZE = 50;
export const NOTIFICATION_LIST_LIMIT = 40;

export type MessagingTone = "admin" | "client";

export type ConversationSummary = {
  id: string;
  clientId: string;
  projectId: string | null;
  subject: string;
  status: ConversationStatus;
  lastMessagePreview: string;
  lastMessageAt: string;
  createdAt: string;
  unreadCount: number;
  clientName: string;
  contactName: string;
  projectName: string | null;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderRole: MessageSenderRole;
  senderLabel: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  conversationId: string | null;
  messageId: string | null;
  projectId: string | null;
  deliverableId: string | null;
  proposalId: string | null;
  contractId: string | null;
  invoiceId: string | null;
  readAt: string | null;
  createdAt: string;
};

export function mapConversationRow(
  row: ConversationRow,
  unreadCount: number,
  names: { clientName?: string; contactName?: string; projectName?: string | null },
): ConversationSummary {
  return {
    id: row.id,
    clientId: row.client_id,
    projectId: row.project_id,
    subject: row.subject,
    status: row.status === "closed" ? "closed" : "open",
    lastMessagePreview: row.last_message_preview,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    unreadCount,
    clientName: names.clientName ?? "",
    contactName: names.contactName ?? "",
    projectName: names.projectName ?? null,
  };
}

export function mapMessageRow(row: MessageRow): ConversationMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderUserId: row.sender_user_id,
    senderRole: row.sender_role === "admin" ? "admin" : "client",
    senderLabel: row.sender_label,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export function mapNotificationRow(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    projectId: row.project_id,
    deliverableId: row.deliverable_id,
    proposalId: row.proposal_id,
    contractId: row.contract_id,
    invoiceId: row.invoice_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export function formatConversationTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return formatLeadDate(iso);
}

export function formatMessageTime(iso: string): string {
  return formatLeadTimestamp(iso);
}

export function notificationHref(item: AppNotification, role: "admin" | "staff" | "client"): string {
  const agency = role === "admin" || role === "staff";
  switch (item.type) {
    case "new_message":
      if (agency) {
        return item.conversationId ? `/admin/messages/${item.conversationId}` : "/admin/messages";
      }
      return item.conversationId ? `/client/messages/${item.conversationId}` : "/client/messages";
    case "feedback_received":
    case "changes_requested":
    case "version_approved":
      if (agency) {
        return item.projectId ? `/admin/projects/${item.projectId}` : "/admin/projects";
      }
      return item.projectId ? `/client/project/${item.projectId}` : "/client/project";
    case "version_ready_for_review":
      if (role === "client") {
        return item.deliverableId ? `/client/files/${item.deliverableId}` : "/client/files";
      }
      return item.projectId ? `/admin/projects/${item.projectId}` : "/admin/files";
    case "project_update":
      if (agency) {
        return item.projectId ? `/admin/projects/${item.projectId}` : "/admin/projects";
      }
      return item.projectId ? `/client/project/${item.projectId}` : "/client/project";
    case "proposal_ready":
    case "proposal_viewed":
    case "proposal_accepted":
    case "proposal_declined":
      if (agency) {
        return item.proposalId ? `/admin/proposals/${item.proposalId}` : "/admin/proposals";
      }
      return item.proposalId ? `/client/proposals/${item.proposalId}` : "/client/proposals";
    case "contract_ready":
    case "contract_viewed":
    case "contract_accepted":
    case "contract_declined":
      if (agency) {
        return item.contractId ? `/admin/contracts/${item.contractId}` : "/admin/contracts";
      }
      return item.contractId ? `/client/contracts/${item.contractId}` : "/client/contracts";
    case "invoice_ready":
    case "invoice_viewed":
    case "payment_recorded":
    case "payment_received":
    case "invoice_paid":
    case "invoice_overdue":
      if (agency) {
        return item.invoiceId ? `/admin/invoices/${item.invoiceId}` : "/admin/invoices";
      }
      return item.invoiceId ? `/client/invoices/${item.invoiceId}` : "/client/invoices";
    default:
      return agency ? "/admin/messages" : "/client/messages";
  }
}

export function mergeById<T extends { id: string }>(current: T[], incoming: T): T[] {
  const index = current.findIndex((item) => item.id === incoming.id);
  if (index === -1) return [...current, incoming];
  const next = [...current];
  next[index] = incoming;
  return next;
}

export function sortMessages(items: ConversationMessage[]): ConversationMessage[] {
  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function displaySenderLabel(message: ConversationMessage, currentUserId: string, tone: MessagingTone): string {
  if (message.senderUserId === currentUserId) return tone === "client" ? "You" : message.senderLabel || "You";
  if (tone === "client" && message.senderRole === "admin") return "MotiveScripts";
  return message.senderLabel || (message.senderRole === "admin" ? "MotiveScripts" : "Client");
}
