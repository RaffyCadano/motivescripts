import { Link } from "react-router-dom";
import { adminBlueBtn } from "@/components/admin/adminActionStyles";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { MessagingWorkspace } from "@/components/messaging/MessagingWorkspace";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { useMessaging } from "@/providers/MessagingProvider";

export function AdminMessages() {
  const { profile } = useAuth();
  const { conversations } = useMessaging();
  const canManage = hasPermission(profile, "messages.manage");
  const unreadConversations = conversations.filter((item) => item.unreadCount > 0).length;

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <AdminPageHeader
        title="Messages"
        description="Client questions that do not belong to a proposal, contract, invoice, review, or file."
        action={
          canManage ? (
            <Link to="/admin/messages?compose=new" className={`${adminBlueBtn} justify-center`}>
              + New Message
            </Link>
          ) : undefined
        }
      />
      <AdminStatGrid columns={2}>
        <AdminStatCard label="Unread conversations" value={unreadConversations} />
        <AdminStatCard label="Total conversations" value={conversations.length} />
      </AdminStatGrid>
      <MessagingWorkspace tone="admin" basePath="/admin/messages" showHeading={false} />
    </div>
  );
}
