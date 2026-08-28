import { Link } from "react-router-dom";
import { formatConversationTime, type ConversationSummary, type MessagingTone } from "@/data/messaging";
import { messagingClasses, unreadDotClass } from "@/components/messaging/messagingTheme";
import { cn } from "@/lib/cn";

type ConversationListProps = {
  tone: MessagingTone;
  basePath: string;
  conversations: ConversationSummary[];
  activeId?: string;
  loading: boolean;
  emptyLabel: string;
  showClient: boolean;
  onNew: () => void;
};

export function ConversationList({
  tone,
  basePath,
  conversations,
  activeId,
  loading,
  emptyLabel,
  showClient,
  onNew,
}: ConversationListProps) {
  const styles = messagingClasses(tone);

  return (
    <aside className={cn("flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r", styles.line)}>
      <div className={cn("flex items-center justify-between gap-2 border-b px-4 py-3", styles.line)}>
        <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", styles.muted)}>Conversations</p>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center rounded-lg px-2.5 font-heading text-[12px] font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
            styles.blueBtn,
          )}
          onClick={onNew}
        >
          New
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {loading ? (
          <p className={cn("px-2 py-6 text-sm", styles.muted)}>Loading conversations…</p>
        ) : conversations.length === 0 ? (
          <p className={cn("px-2 py-6 text-sm", styles.muted)}>{emptyLabel}</p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((item) => {
              const active = item.id === activeId;
              return (
                <li key={item.id}>
                  <Link
                    to={`${basePath}/${item.id}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex gap-2 rounded-xl px-3 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                      active ? styles.active : styles.hover,
                    )}
                  >
                    <span className="mt-1.5 w-2 shrink-0">
                      {item.unreadCount > 0 ? (
                        <span className={unreadDotClass(tone)} aria-hidden="true" />
                      ) : (
                        <span className="sr-only">Read</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className={cn("truncate font-heading text-sm font-semibold", styles.ink)}>
                          {showClient ? item.clientName || "Client" : item.subject}
                        </span>
                        <span className={cn("shrink-0 text-[11px]", styles.muted)}>
                          {formatConversationTime(item.lastMessageAt)}
                        </span>
                      </span>
                      {showClient ? (
                        <span className={cn("mt-0.5 block truncate text-[12px] font-medium", styles.ink)}>
                          {item.subject}
                        </span>
                      ) : null}
                      <span className={cn("mt-0.5 block truncate text-[12px]", styles.muted)}>
                        {item.projectName ? `${item.projectName} · ` : ""}
                        {item.lastMessagePreview || "No messages yet"}
                      </span>
                      {item.unreadCount > 0 ? (
                        <span className={cn("mt-1 block text-[11px] font-medium", styles.ink)}>
                          {item.unreadCount} unread
                        </span>
                      ) : null}
                      {item.status === "closed" ? (
                        <span className={cn("mt-1 block text-[11px]", styles.muted)}>Closed</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
