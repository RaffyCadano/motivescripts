import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { MessageComposer } from "@/components/messaging/MessageComposer";
import { messagingClasses } from "@/components/messaging/messagingTheme";
import {
  displaySenderLabel,
  formatMessageTime,
  mapMessageRow,
  mergeById,
  sortMessages,
  type ConversationMessage,
  type ConversationSummary,
  type MessagingTone,
} from "@/data/messaging";
import { fetchMessagesPage, subscribeConversationMessages } from "@/data/messagingRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

type ConversationThreadProps = {
  tone: MessagingTone;
  basePath: string;
  conversation: ConversationSummary;
  currentUserId: string;
  sending: boolean;
  onSend: (body: string) => Promise<ConversationMessage | null>;
  onMarkRead: () => Promise<void>;
  onCloseConversation?: () => void;
  onReopenConversation?: () => void;
};

export function ConversationThread({
  tone,
  basePath,
  conversation,
  currentUserId,
  sending,
  onSend,
  onMarkRead,
  onCloseConversation,
  onReopenConversation,
}: ConversationThreadProps) {
  const styles = messagingClasses(tone);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDraft("");
    void fetchMessagesPage(conversation.id)
      .then((page) => {
        if (cancelled) return;
        setMessages(page.messages);
        setHasOlder(page.hasOlder);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof AgencyDbError ? caught.message : "Unable to load this conversation.");
        setMessages([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversation.id]);

  useEffect(() => {
    return subscribeConversationMessages(conversation.id, (row) => {
      setMessages((current) => sortMessages(mergeById(current, mapMessageRow(row))));
      if (liveRef.current && row.sender_user_id !== currentUserId) {
        liveRef.current.textContent = "New message received";
      }
    });
  }, [conversation.id, currentUserId]);

  const markReadRef = useRef(onMarkRead);
  markReadRef.current = onMarkRead;
  useEffect(() => {
    void markReadRef.current();
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversation.id]);

  async function loadOlder() {
    const oldest = messages[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await fetchMessagesPage(conversation.id, { before: oldest.createdAt });
      setMessages((current) => sortMessages([...page.messages, ...current]));
      setHasOlder(page.hasOlder);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    const created = await onSend(body);
    if (!created) return;
    setDraft("");
    setMessages((current) => sortMessages(mergeById(current, created)));
  }

  const title = tone === "admin" ? conversation.clientName || conversation.subject : conversation.subject;
  const subtitle = [
    tone === "admin" ? conversation.subject : "MotiveScripts",
    conversation.projectName,
    conversation.status === "closed" ? "Closed" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={cn("flex items-start justify-between gap-3 border-b px-4 py-3", styles.line)}>
        <div className="min-w-0">
          <Link
            to={basePath}
            className={cn(
              "mb-2 inline-flex items-center gap-1 text-[12px] font-medium lg:hidden",
              tone === "admin" ? "text-[var(--admin-blue)]" : "text-[var(--client-blue)]",
            )}
          >
            <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
            Back
          </Link>
          <p className={cn("truncate font-heading text-sm font-semibold", styles.ink)}>{title}</p>
          <p className={cn("truncate text-[12px]", styles.muted)}>{subtitle}</p>
        </div>
        {onCloseConversation && conversation.status === "open" ? (
          <button
            type="button"
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-lg border px-3 font-heading text-[12px] font-semibold",
              styles.controlBorder,
              styles.ink,
              styles.hover,
            )}
            onClick={onCloseConversation}
          >
            Close
          </button>
        ) : null}
        {onReopenConversation && conversation.status === "closed" ? (
          <button
            type="button"
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-lg border px-3 font-heading text-[12px] font-semibold",
              styles.controlBorder,
              styles.ink,
              styles.hover,
            )}
            onClick={onReopenConversation}
          >
            Reopen
          </button>
        ) : null}
      </div>

      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        {loading ? (
          <p className={cn("py-8 text-sm", styles.muted)}>Loading messages…</p>
        ) : error ? (
          <p className={cn("py-8 text-sm", styles.muted)}>{error}</p>
        ) : (
          <>
            {hasOlder ? (
              <div className="mb-4 text-center">
                <button
                  type="button"
                  disabled={loadingOlder}
                  className={cn("font-heading text-[12px] font-semibold underline-offset-2 hover:underline", styles.ink)}
                  onClick={() => void loadOlder()}
                >
                  {loadingOlder ? "Loading…" : "Load older messages"}
                </button>
              </div>
            ) : null}
            {messages.length === 0 ? (
              <p className={cn("py-8 text-sm", styles.muted)}>No messages in this conversation yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {messages.map((message) => {
                  const mine = message.senderUserId === currentUserId;
                  return (
                    <li key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[min(28rem,90%)] rounded-2xl px-4 py-3",
                          mine ? cn(styles.navy, "text-white") : cn(styles.bg, styles.ink),
                        )}
                      >
                        <p className={cn("text-[11px] font-medium", mine ? "text-white/70" : styles.muted)}>
                          {displaySenderLabel(message, currentUserId, tone)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                        <p className={cn("mt-1.5 text-[11px]", mine ? "text-white/55" : styles.muted)}>
                          {formatMessageTime(message.createdAt)}
                          {mine && message.readAt ? " · Read" : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {conversation.status === "closed" ? (
        <p className={cn("border-t px-4 py-2 text-[12px]", styles.line, styles.muted)}>
          This conversation is closed. Sending a message will reopen it.
        </p>
      ) : null}

      <MessageComposer
        tone={tone}
        value={draft}
        sending={sending}
        onChange={setDraft}
        onSend={() => void handleSend()}
      />
    </section>
  );
}
