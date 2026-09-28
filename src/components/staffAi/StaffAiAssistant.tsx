import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useTeamWork } from "@/components/team/useTeamWork";
import {
  buildAccountingAiContext,
  buildSalesAiContext,
  buildStaffTaskContext,
  isStaffAiTemplate,
  type StaffAiContractInput,
  type StaffAiInvoiceInput,
  type StaffAiLeadInput,
  type StaffAiProposalInput,
  type StaffAiTaskInput,
} from "@/data/staffAiContext";
import { fetchContractSummaries, fetchProposalSummaries } from "@/data/documentsRepository";
import { fetchInvoiceSummaries } from "@/data/invoicesRepository";
import { askStaffAi, STAFF_AI_MAX_MESSAGE_CHARS, type AskStaffAiFailure, type StaffAiChatMessage } from "@/data/staffAiAssistant";
import { cn } from "@/lib/cn";

type ChatEntry = { id: number; role: "user" | "assistant"; content: string };

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-blue)]";

const SUGGESTIONS_BY_ROLE: Record<string, readonly string[]> = {
  developer: ["What needs to be done today?", "What's blocked right now?", "How do I mark a task Blocked?"],
  designer: ["What needs to be done today?", "What's blocked right now?", "How do design checkpoints work?"],
  content_writer: ["What needs to be done today?", "What's blocked right now?", "How do I submit a draft for review?"],
  team_member: ["What needs to be done today?", "What's blocked right now?", "How do QA reviews work?"],
  project_manager: ["What needs my attention?", "What's overdue across my projects?", "How do I reassign a task?"],
  sales: ["Which leads need follow-up?", "What proposals are waiting on a client?", "How do I send a proposal?"],
  accounting: ["What invoices are overdue?", "What's due this week?", "How do I record a payment?"],
  admin: ["What's blocked or overdue company-wide?", "What needs attention today?", "How do I remove someone from a project?"],
};

function TypingIndicator() {
  return (
    <div className="flex justify-start" role="status">
      <span className="sr-only">Assistant is typing</span>
      <div
        className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-[var(--admin-line)] bg-white px-4 py-3.5"
        aria-hidden="true"
      >
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-[var(--admin-blue)]/60 motion-reduce:animate-none"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function ErrorNotice({ reason, onRetry }: { reason: AskStaffAiFailure; onRetry: () => void }) {
  const message =
    reason === "rate_limited"
      ? "You're sending messages quickly. Please wait a moment and try again."
      : reason === "too_long"
        ? "That message was too long. Try a shorter question."
        : reason === "not_allowed"
          ? "You don't have access to this assistant."
          : "The assistant isn't available right now.";
  return (
    <div role="alert" className="rounded-2xl border border-[rgb(220_38_38_/_0.25)] bg-[rgb(220_38_38_/_0.05)] px-4 py-3 text-sm text-[var(--admin-ink)]">
      <p>{message}</p>
      {reason !== "too_long" && reason !== "not_allowed" ? (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "mt-2.5 inline-flex h-9 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3.5 font-heading text-[13px] font-semibold text-[var(--admin-ink)] hover:border-[rgb(0_80_240_/_0.45)]",
            focusRing,
          )}
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

/**
 * Floating chat launcher, one per signed-in staff/admin person, covering every role (see
 * isStaffAiTemplate). Renders nothing for a role it doesn't recognize. Mounted in both AdminLayout
 * (PM, sales, accounting, and admin's own workspace) and TeamLayout (developer, designer, content
 * writer, and QA/team_member's); only one of those two shells is ever active for a given person.
 */
export function StaffAiAssistant() {
  const { profile } = useAuth();
  const { leads, clients, projects } = useLeads();
  const { tasks: myTasks, myProjects } = useTeamWork();

  // An admin with no staff_profiles row of their own (confirmed to actually happen -- e.g. an
  // account created directly rather than through the invite flow) has templateKey: null, so
  // profile.role is checked first and wins whenever it says admin, same as the edge function does.
  const role = profile?.role === "admin" ? "admin" : isStaffAiTemplate(profile?.templateKey) ? profile.templateKey : null;

  // Sales and accounting need records useTeamWork()/useLeads() don't carry (proposals, contracts,
  // invoices) -- fetched once, only for those two roles, the same repository functions their own
  // dashboards already use. RLS narrows the result to what this person can already see.
  const [salesRecords, setSalesRecords] = useState<{ proposals: StaffAiProposalInput[]; contracts: StaffAiContractInput[] } | null>(null);
  const [invoices, setInvoices] = useState<StaffAiInvoiceInput[] | null>(null);

  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client.businessName])), [clients]);

  useEffect(() => {
    if (role !== "sales") return;
    let active = true;
    void Promise.all([fetchProposalSummaries(), fetchContractSummaries()])
      .then(([proposals, contracts]) => {
        if (!active) return;
        setSalesRecords({
          proposals: proposals.map((p) => ({
            id: p.id,
            number: p.number,
            clientName: clientsById.get(p.clientId) ?? "Client",
            effectiveStatus: p.effectiveStatus,
            sentAt: p.sentAt,
            validUntil: p.validUntil,
            createdAt: p.createdAt,
          })),
          contracts: contracts.map((c) => ({
            id: c.id,
            number: c.number,
            clientName: clientsById.get(c.clientId) ?? "Client",
            effectiveStatus: c.effectiveStatus,
            agencySigned: c.agencySigned,
            sentAt: c.sentAt,
            acceptedAt: c.acceptedAt,
            createdAt: c.createdAt,
          })),
        });
      })
      .catch(() => {
        if (active) setSalesRecords({ proposals: [], contracts: [] });
      });
    return () => {
      active = false;
    };
  }, [clientsById, role]);

  useEffect(() => {
    if (role !== "accounting") return;
    let active = true;
    void fetchInvoiceSummaries()
      .then((rows) => {
        if (!active) return;
        setInvoices(
          rows.map((invoice) => ({
            id: invoice.id,
            number: invoice.number,
            clientName: clientsById.get(invoice.clientId) ?? "Client",
            effectiveStatus: invoice.effectiveStatus,
            amountDueCents: invoice.amountDueCents,
            dueDate: invoice.dueDate,
            createdAt: invoice.createdAt,
          })),
        );
      })
      .catch(() => {
        if (active) setInvoices([]);
      });
    return () => {
      active = false;
    };
  }, [clientsById, role]);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AskStaffAiFailure | null>(null);

  const nextId = useRef(1);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();

  const contextSummary = useMemo(() => {
    if (!role) return "";
    if (role === "sales") {
      if (!salesRecords) return "Still loading your pipeline…";
      const leadInputs: StaffAiLeadInput[] = leads.map((lead) => ({
        id: lead.id,
        clientLabel: lead.businessName || lead.name,
        status: lead.status,
        createdAt: lead.createdAt,
        convertedClientId: lead.convertedClientId,
      }));
      return buildSalesAiContext({ leads: leadInputs, proposals: salesRecords.proposals, contracts: salesRecords.contracts });
    }
    if (role === "accounting") {
      if (!invoices) return "Still loading your invoices…";
      return buildAccountingAiContext(invoices);
    }

    // Developer/designer/content_writer/team_member: their own assigned tasks. Project manager:
    // every task across the projects they coordinate (rarely has tasks assigned to themself
    // personally, so their own queue alone would be a near-useless answer). Admin: every task
    // company-wide (useLeads()'s projects is the full, unfiltered list for an admin).
    const taskProjects = role === "admin" ? projects.filter((project) => !project.archived) : myProjects;
    const projectNames = taskProjects.map((project) => project.name);
    if (role === "project_manager" || role === "admin") {
      const teamTasks: StaffAiTaskInput[] = taskProjects.flatMap((project) =>
        project.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          projectName: project.name,
          status: task.status,
          dueDate: task.dueDate,
          blockedReason: task.blockedReason,
          description: task.description,
        })),
      );
      return buildStaffTaskContext(teamTasks, projectNames);
    }
    const ownTasks: StaffAiTaskInput[] = myTasks.map((task) => ({
      id: task.id,
      title: task.title,
      projectName: task.projectName,
      status: task.status,
      dueDate: task.dueDate,
      blockedReason: task.blockedReason,
      description: task.description,
    }));
    return buildStaffTaskContext(ownTasks, projectNames);
  }, [invoices, leads, myProjects, myTasks, projects, role, salesRecords]);

  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

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
    const el = listRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, loading, error, open]);

  const request = useCallback(
    async (history: ChatEntry[]) => {
      if (!role) return;
      setLoading(true);
      setError(null);
      const payload: StaffAiChatMessage[] = history.map(({ role: entryRole, content }) => ({ role: entryRole, content }));
      const result = await askStaffAi(contextSummary, payload);
      setLoading(false);
      if (result.ok) {
        setMessages((current) => [...current, { id: nextId.current++, role: "assistant", content: result.reply }]);
      } else {
        setError(result.reason);
      }
    },
    [contextSummary, role],
  );

  function send(text: string) {
    const content = text.trim().slice(0, STAFF_AI_MAX_MESSAGE_CHARS);
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

  if (!role) return null;

  const suggestions = SUGGESTIONS_BY_ROLE[role] ?? [];
  const showSuggestions = messages.length === 0 && !loading;
  const nearLimit = input.length >= STAFF_AI_MAX_MESSAGE_CHARS - 100;

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={openPanel}
        aria-label="Ask the staff assistant"
        aria-expanded={open}
        aria-controls={panelId}
        inert={open}
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
        className={cn(
          "group fixed right-4 z-40 inline-flex h-11 w-11 items-center justify-center gap-2 rounded-full border border-[var(--admin-line)] bg-white/95 font-heading text-sm font-semibold text-[var(--admin-ink)] shadow-[0_6px_18px_rgb(7_17_31_/_0.16)] backdrop-blur transition-[background-color,border-color,opacity,transform] duration-150 ease-out hover:border-[rgb(0_80_240_/_0.45)] hover:bg-white active:translate-y-px motion-reduce:transition-none sm:right-6 sm:w-auto sm:pl-4 sm:pr-5",
          focusRing,
          open && "pointer-events-none invisible opacity-0",
        )}
      >
        <Sparkles size={17} strokeWidth={2.2} aria-hidden="true" className="text-[var(--admin-blue)]" />
        <span className="sr-only sm:not-sr-only">Ask the assistant</span>
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
          "outline-none fixed bottom-3 left-3 right-3 z-[70] flex h-[min(80dvh,42rem)] flex-col overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white shadow-[0_24px_64px_rgb(7_17_31_/_0.28)] transition-[opacity,transform,visibility] duration-150 ease-out motion-reduce:transition-none sm:bottom-6 sm:left-auto sm:right-6 sm:w-[26rem]",
          open ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-3 opacity-0",
        )}
      >
        <header className="flex items-center gap-3 bg-[var(--admin-navy)] px-4 py-3.5 text-white">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#0038c8,#0068ff_55%,#00c8ff)]">
            <Sparkles size={17} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-heading text-[0.95rem] font-bold leading-tight tracking-tight text-white">
              Staff assistant
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/70">
              <span className="size-1.5 rounded-full bg-[#34d399]" aria-hidden="true" />
              Sees only your own work
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
          aria-label="Conversation with the staff assistant"
          className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[var(--admin-bg)] px-4 py-4"
        >
          <div className="flex justify-start">
            <p className="max-w-[88%] rounded-2xl rounded-bl-md border border-[var(--admin-line)] bg-white px-4 py-3 text-sm leading-relaxed text-[var(--admin-ink)]">
              Hi! Ask me what needs your attention, or how to do something in the app.
            </p>
          </div>

          {showSuggestions && suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1" aria-label="Suggested questions">
              {suggestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => send(question)}
                  className={cn(
                    "rounded-full border border-[rgb(0_80_240_/_0.25)] bg-white px-3.5 py-2 text-left text-[13px] font-medium text-[var(--admin-blue)] transition-colors hover:border-[rgb(0_80_240_/_0.55)] hover:bg-[rgb(0_80_240_/_0.06)]",
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
                <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[var(--admin-blue)] px-4 py-2.5 text-sm leading-relaxed text-white">
                  <span className="sr-only">You: </span>
                  {message.content}
                </p>
              </div>
            ) : (
              <div key={message.id} className="flex justify-start">
                <p className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-[var(--admin-line)] bg-white px-4 py-3 text-sm leading-relaxed text-[var(--admin-ink)]">
                  <span className="sr-only">Assistant: </span>
                  {message.content}
                </p>
              </div>
            ),
          )}

          {loading ? <TypingIndicator /> : null}
          {error ? <ErrorNotice reason={error} onRetry={() => void request(messages)} /> : null}
        </div>

        <form onSubmit={onSubmit} className="border-t border-[var(--admin-line)] bg-white px-3 pb-2.5 pt-3">
          <div className="flex items-end gap-2">
            <label htmlFor={`${panelId}-input`} className="sr-only">
              Ask a question
            </label>
            <textarea
              ref={inputRef}
              id={`${panelId}-input`}
              value={input}
              rows={1}
              maxLength={STAFF_AI_MAX_MESSAGE_CHARS}
              placeholder="Ask a question…"
              onChange={(event) => onInputChange(event.target.value, event.target)}
              onKeyDown={onInputKeyDown}
              className="max-h-[120px] min-h-11 flex-1 resize-none rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3.5 py-2.5 text-base leading-snug text-[var(--admin-ink)] outline-none placeholder:text-[var(--admin-muted)] focus:border-[rgb(0_80_240_/_0.55)] sm:text-sm"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] text-white transition-[background-color,opacity] hover:bg-[var(--admin-blue)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--admin-navy)]",
                focusRing,
              )}
            >
              <ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 px-1 text-xs leading-snug text-[var(--admin-muted)]">
            {nearLimit ? (
              <span className="font-semibold">
                {input.length}/{STAFF_AI_MAX_MESSAGE_CHARS} characters.{" "}
              </span>
            ) : null}
            AI can make mistakes — it can't change anything for you, only tell you where to.
          </p>
        </form>
      </section>
    </>
  );
}
