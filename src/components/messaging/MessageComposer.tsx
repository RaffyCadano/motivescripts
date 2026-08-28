import { useId, type KeyboardEvent } from "react";
import { MESSAGE_MAX_LENGTH, type MessagingTone } from "@/data/messaging";
import { messagingClasses } from "@/components/messaging/messagingTheme";
import { cn } from "@/lib/cn";

type MessageComposerProps = {
  tone: MessagingTone;
  value: string;
  sending: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
};

export function MessageComposer({ tone, value, sending, disabled, onChange, onSend }: MessageComposerProps) {
  const inputId = useId();
  const styles = messagingClasses(tone);
  const trimmed = value.trim();
  const tooLong = value.length > MESSAGE_MAX_LENGTH;
  const canSend = Boolean(trimmed) && !sending && !disabled && !tooLong;

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (canSend) onSend();
  }

  return (
    <form
      className={cn("border-t p-4", styles.line)}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        Write a message
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <textarea
          id={inputId}
          rows={2}
          value={value}
          disabled={sending || disabled}
          maxLength={MESSAGE_MAX_LENGTH + 20}
          placeholder="Write a message…"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          className={cn(
            styles.control,
            styles.controlBorder,
            styles.ink,
            "min-h-[2.75rem] resize-none placeholder:opacity-60 disabled:opacity-60",
          )}
        />
        <button
          type="submit"
          disabled={!canSend}
          className={cn(
            "inline-flex h-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] px-4 font-heading text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(0_80_240)] disabled:opacity-50",
            styles.blueBtn,
          )}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
      <p className={cn("mt-1.5 text-[11px]", tooLong ? "text-red-600" : styles.muted)}>
        {tooLong
          ? `Messages can be at most ${MESSAGE_MAX_LENGTH} characters.`
          : "Enter to send · Shift+Enter for a new line"}
      </p>
    </form>
  );
}
