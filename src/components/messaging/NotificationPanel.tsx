import { Link } from "react-router-dom";
import { formatConversationTime, notificationHref, type AppNotification, type MessagingTone } from "@/data/messaging";
import { messagingClasses, unreadDotClass } from "@/components/messaging/messagingTheme";
import { cn } from "@/lib/cn";

type NotificationPanelProps = {
  tone: MessagingTone;
  role: "admin" | "staff" | "client";
  open: boolean;
  id: string;
  notifications: AppNotification[];
  loading: boolean;
  onClose: () => void;
  onOpen: (item: AppNotification) => void;
  onMarkAllRead: () => void;
};

export function NotificationPanel({
  tone,
  role,
  open,
  id,
  notifications,
  loading,
  onClose,
  onOpen,
  onMarkAllRead,
}: NotificationPanelProps) {
  const styles = messagingClasses(tone);
  if (!open) return null;
  const unread = notifications.some((item) => !item.readAt);

  return (
    <div
      id={id}
      role="dialog"
      aria-label="Notifications"
      className={cn(
        "absolute right-0 z-50 mt-1.5 w-[min(22rem,calc(100vw-2rem))] overflow-hidden border py-1 shadow-[0_12px_32px_rgb(7_17_31_/_0.08)]",
        styles.radius,
        styles.line,
        styles.card,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <p className={cn("font-heading text-[13px] font-semibold", styles.ink)}>Notifications</p>
        {unread ? (
          <button
            type="button"
            className={cn("text-[12px] font-medium underline-offset-2 hover:underline", styles.muted)}
            onClick={onMarkAllRead}
          >
            Mark all as read
          </button>
        ) : null}
      </div>
      {loading ? (
        <p className={cn("px-4 py-3 text-sm", styles.muted)}>Loading notifications…</p>
      ) : notifications.length === 0 ? (
        <p className={cn("px-4 py-3 text-sm", styles.muted)}>No notifications yet.</p>
      ) : (
        <ul className="max-h-[min(24rem,60svh)] overflow-auto">
          {notifications.map((item) => (
            <li key={item.id}>
              <Link
                to={notificationHref(item, role)}
                className={cn("flex gap-2 px-4 py-3", styles.hover)}
                onClick={() => {
                  onOpen(item);
                  onClose();
                }}
              >
                <span className="mt-1.5 w-2 shrink-0">
                  {!item.readAt ? <span className={unreadDotClass(tone)} aria-hidden="true" /> : null}
                </span>
                <span className="min-w-0">
                  <span className={cn("block font-heading text-[13px] font-semibold", styles.ink)}>{item.title}</span>
                  {item.body ? <span className={cn("mt-0.5 block text-[12px] leading-relaxed", styles.muted)}>{item.body}</span> : null}
                  <span className={cn("mt-1 block text-[11px]", styles.muted)}>{formatConversationTime(item.createdAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
