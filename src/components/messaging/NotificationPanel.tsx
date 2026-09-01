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
  onClearAll?: () => void;
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
  onClearAll,
}: NotificationPanelProps) {
  const styles = messagingClasses(tone);
  if (!open) return null;
  const unread = notifications.some((item) => !item.readAt);
  const underHeader =
    tone === "admin"
      ? "top-[calc(var(--admin-header)+0.5rem)] max-h-[min(28rem,calc(100svh-var(--admin-header)-1rem))]"
      : "top-[calc(var(--client-header)+0.5rem)] max-h-[min(28rem,calc(100svh-var(--client-header)-1rem))]";

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-[rgb(7_17_31_/_0.22)] sm:hidden"
        aria-label="Close notifications"
        onClick={onClose}
      />
      <div
        id={id}
        role="dialog"
        aria-label="Notifications"
        className={cn(
          "z-50 flex w-auto flex-col overflow-hidden border py-1 shadow-[0_12px_32px_rgb(7_17_31_/_0.08)]",
          "fixed inset-x-3",
          underHeader,
          "sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-1.5 sm:w-[min(22rem,calc(100vw-2rem))]",
          styles.radius,
          styles.line,
          styles.card,
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-2">
          <p className={cn("font-heading text-[13px] font-semibold", styles.ink)}>Notifications</p>
          {unread ? (
            <button
              type="button"
              className={cn("shrink-0 text-[12px] font-medium underline-offset-2 hover:underline", styles.muted)}
              onClick={onMarkAllRead}
            >
              Mark all as read
            </button>
          ) : notifications.length > 0 && onClearAll ? (
            <button
              type="button"
              className={cn("shrink-0 text-[12px] font-medium underline-offset-2 hover:underline", styles.muted)}
              onClick={onClearAll}
            >
              Clear all
            </button>
          ) : null}
        </div>
        {loading ? (
          <p className={cn("px-4 py-3 text-sm", styles.muted)}>Loading notifications…</p>
        ) : notifications.length === 0 ? (
          <p className={cn("px-4 py-3 text-sm", styles.muted)}>No notifications yet.</p>
        ) : (
          <ul className="min-h-0 flex-1 overflow-auto overscroll-contain">
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
                  <span className="min-w-0 break-words">
                    <span className={cn("block font-heading text-[13px] font-semibold", styles.ink)}>{item.title}</span>
                    {item.body ? (
                      <span className={cn("mt-0.5 block text-[12px] leading-relaxed", styles.muted)}>{item.body}</span>
                    ) : null}
                    <span className={cn("mt-1 block text-[11px]", styles.muted)}>
                      {formatConversationTime(item.createdAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
