import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { Button } from "@/components/Button";
import {
  AI_MAX_MESSAGE_CHARS,
  askMotiveScriptsAi,
  type AiChatMessage,
  type AskAiFailure,
} from "@/data/aiAssistant";
import { site } from "@/data/site";
import { cn } from "@/lib/cn";

const SUGGESTIONS = [
  "How much does a website cost?",
  "What services do you offer?",
  "How does your process work?",
  "How do I start a project?",
] as const;

/** Marketing pages only: never the client portal, admin, login, invite, or the Start a Project form itself. */
const MARKETING_PATHS = new Set(["/", "/services", "/work", "/process", "/pricing", "/about"]);

function isMarketingPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return MARKETING_PATHS.has(path) || path.startsWith("/work/");
}

type ChatEntry = { id: number; role: "user" | "assistant"; content: string; cta?: boolean };

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ms-focus)]";

function TypingIndicator() {
  return (
    <div className="flex justify-start" role="status">
      <span className="sr-only">MotiveScripts AI is typing</span>
      <div
        className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-[var(--color-line)] bg-white px-4 py-3.5"
        aria-hidden="true"
      >
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-blue/60 motion-reduce:animate-none"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function ErrorNotice({ reason, onRetry }: { reason: AskAiFailure; onRetry: () => void }) {
  const message =
    reason === "rate_limited"
      ? "You're sending messages quickly. Please wait a moment and try again."
      : reason === "too_long"
        ? "That message was too long. Try a shorter question."
        : "MotiveScripts AI isn't available right now.";

  return (
    <div
      role="alert"
      className="rounded-2xl border border-[rgb(220_38_38_/_0.25)] bg-[rgb(220_38_38_/_0.05)] px-4 py-3 text-sm text-ink"
    >
      <p>{message}</p>
      {reason === "unavailable" ? (
        <p className="mt-1.5 text-[13px] text-muted-strong">
          You can email{" "}
          <a className="font-semibold underline underline-offset-2" href={`mailto:${site.email}`}>
            {site.email}
          </a>{" "}
          or use{" "}
          <Link className="font-semibold underline underline-offset-2" to="/start-a-project">
            Start a Project
          </Link>
          .
        </p>
      ) : null}
      {reason !== "too_long" ? (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "mt-2.5 inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-white px-3.5 font-heading text-[13px] font-semibold text-ink hover:border-[rgb(0_80_240_/_0.45)]",
            focusRing,
          )}
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function AiAssistant() {
  const { pathname } = useLocation();
  const visible = isMarketingPath(pathname);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AskAiFailure | null>(null);
  // Once the page has scrolled the launcher shrinks to its icon, so it stays out of the way of the content and the main buttons.
  const [compact, setCompact] = useState(false);

  const nextId = useRef(1);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();

  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);

  useEffect(() => {
    const update = () => setCompact(window.scrollY > 160);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  // Leaving the marketing pages (e.g. via the Start a Project button) closes the panel.
  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  // Move focus into the panel when it opens. On devices with a mouse or keyboard that is the question
  // box; on touch devices it is the dialog itself, so the on-screen keyboard doesn't pop up over the
  // suggestions. The panel is `visibility: hidden` for the first frame of its open transition, and a
  // hidden element can't take focus, so retry across a few frames.
  useEffect(() => {
    if (!open) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    let frame = 0;
    let tries = 0;
    const focusIn = () => {
      const target = fine ? inputRef.current : panelRef.current;
      if (!target) return;
      target.focus({ preventScroll: true });
      if (document.activeElement !== target && tries++ < 12) frame = requestAnimationFrame(focusIn);
    };
    frame = requestAnimationFrame(focusIn);
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, loading, error, open]);

  const request = useCallback(async (history: ChatEntry[]) => {
    setLoading(true);
    setError(null);
    const payload: AiChatMessage[] = history.map(({ role, content }) => ({ role, content }));
    const result = await askMotiveScriptsAi(payload);
    setLoading(false);
    if (result.ok) {
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: "assistant", content: result.reply, cta: result.cta === "start_project" },
      ]);
    } else {
      setError(result.reason);
    }
  }, []);

  function send(text: string) {
    const content = text.trim().slice(0, AI_MAX_MESSAGE_CHARS);
    if (!content || loading) return;
    const next: ChatEntry[] = [...messages, { id: nextId.current++, role: "user", content }];
    setMessages(next);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "";
    void request(next);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    send(input);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(input);
    }
  }

  function onInputChange(value: string, el: HTMLTextAreaElement) {
    setInput(value);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  if (!visible) return null;

  const showSuggestions = messages.length === 0 && !loading;
  const nearLimit = input.length >= AI_MAX_MESSAGE_CHARS - 100;

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={openPanel}
        aria-label="Ask MotiveScripts AI"
        aria-expanded={open}
        aria-controls={panelId}
        inert={open}
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
        className={cn(
          "group fixed right-4 z-40 inline-flex h-11 w-11 items-center justify-center gap-2 rounded-full border border-[var(--color-line-strong)] bg-white/95 font-heading text-sm font-semibold text-ink shadow-[0_6px_18px_rgb(0_16_48_/_0.12)] backdrop-blur transition-[background-color,border-color,opacity,transform] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:border-[rgb(0_80_240_/_0.45)] hover:bg-white active:translate-y-px motion-reduce:transition-none sm:right-6",
          compact ? "sm:hover:w-auto sm:hover:pl-4 sm:hover:pr-5 sm:focus-visible:w-auto sm:focus-visible:pl-4 sm:focus-visible:pr-5" : "sm:w-auto sm:pl-4 sm:pr-5",
          focusRing,
          open && "pointer-events-none invisible opacity-0",
        )}
      >
        <Sparkles size={17} strokeWidth={2.2} aria-hidden="true" className="text-blue" />
        {/* Icon-only on a phone, where a wide pill would cover the page as it scrolls; the button's
            aria-label already names it for screen readers. */}
        <span className={compact ? "sr-only sm:group-hover:not-sr-only sm:group-focus-visible:not-sr-only" : "sr-only sm:not-sr-only"}>Ask MotiveScripts AI</span>
      </button>

      <section
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-labelledby={titleId}
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        className={cn(
          "outline-none fixed bottom-3 left-3 right-3 z-[70] flex h-[min(80dvh,42rem)] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line-strong)] bg-white shadow-[0_24px_64px_rgb(0_16_48_/_0.28)] transition-[opacity,transform,visibility] duration-[var(--duration-base)] ease-[var(--ease-out)] motion-reduce:transition-none sm:bottom-6 sm:left-auto sm:right-6 sm:w-[26rem]",
          open ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-3 opacity-0",
        )}
      >
        <header className="flex items-center gap-3 bg-navy px-4 py-3.5 text-white">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#0038c8,#0068ff_55%,#00c8ff)]">
            <Sparkles size={17} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-heading text-[0.95rem] font-bold leading-tight tracking-tight text-white">
              MotiveScripts AI
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/70">
              <span className="size-1.5 rounded-full bg-[#34d399]" aria-hidden="true" />
              Online
            </p>
          </div>
          <button
            type="button"
            onClick={closePanel}
            aria-label="Close chat"
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white",
              focusRing,
            )}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label="Conversation with MotiveScripts AI"
          className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-bg-card px-4 py-4"
        >
          <div className="flex justify-start">
            <p className="max-w-[88%] rounded-2xl rounded-bl-md border border-[var(--color-line)] bg-white px-4 py-3 text-sm leading-relaxed text-ink">
              Hi! I&apos;m the MotiveScripts AI assistant. Ask me anything about our websites, services, pricing, or
              process.
            </p>
          </div>

          {showSuggestions ? (
            <div className="flex flex-wrap gap-2 pt-1" aria-label="Suggested questions">
              {SUGGESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => send(question)}
                  className={cn(
                    "rounded-full border border-[rgb(0_80_240_/_0.25)] bg-white px-3.5 py-2 text-left text-[13px] font-medium text-blue transition-colors hover:border-[rgb(0_80_240_/_0.55)] hover:bg-[rgb(0_80_240_/_0.06)]",
                    focusRing,
                  )}
                >
                  {question}
                </button>
              ))}
            </div>
          ) : null}

          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-blue px-4 py-2.5 text-sm leading-relaxed text-white">
                  <span className="sr-only">You: </span>
                  {message.content}
                </p>
              </div>
            ) : (
              <div key={message.id} className="flex flex-col items-start gap-2">
                <p className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-[var(--color-line)] bg-white px-4 py-3 text-sm leading-relaxed text-ink">
                  <span className="sr-only">MotiveScripts AI: </span>
                  {message.content}
                </p>
                {message.cta ? (
                  <div className="max-w-[88%] rounded-2xl border border-[rgb(0_80_240_/_0.2)] bg-[rgb(0_80_240_/_0.05)] p-3.5">
                    <p className="font-heading text-[13px] font-semibold text-ink">Ready to discuss your project?</p>
                    <Button to="/start-a-project" size="md" className="mt-2.5 w-full">
                      Start a Project
                    </Button>
                  </div>
                ) : null}
              </div>
            ),
          )}

          {loading ? <TypingIndicator /> : null}
          {error ? <ErrorNotice reason={error} onRetry={() => void request(messages)} /> : null}
        </div>

        <form onSubmit={onSubmit} className="border-t border-[var(--color-line)] bg-white px-3 pb-2.5 pt-3">
          <div className="flex items-end gap-2">
            <label htmlFor={`${panelId}-input`} className="sr-only">
              Ask a question
            </label>
            <textarea
              ref={inputRef}
              id={`${panelId}-input`}
              value={input}
              rows={1}
              maxLength={AI_MAX_MESSAGE_CHARS}
              placeholder="Ask a question…"
              onChange={(event) => onInputChange(event.target.value, event.target)}
              onKeyDown={onInputKeyDown}
              className={cn(
                "max-h-[120px] min-h-11 flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-white px-3.5 py-2.5 text-base leading-snug text-ink outline-none placeholder:text-faint focus:border-[rgb(0_80_240_/_0.55)] sm:text-sm",
              )}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-navy text-white transition-[background-color,opacity] hover:bg-blue disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-navy",
                focusRing,
              )}
            >
              <ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 px-1 text-xs leading-snug text-faint">
            {nearLimit ? (
              <span className="font-semibold text-muted-strong">
                {input.length}/{AI_MAX_MESSAGE_CHARS} characters.{" "}
              </span>
            ) : null}
            AI can make mistakes. Websites start at the price shown on our pricing page; your final quote comes from a
            project proposal.
          </p>
        </form>
      </section>
    </>
  );
}
