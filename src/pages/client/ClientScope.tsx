import { useEffect, useState, type FormEvent } from "react";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import {
  defaultScopePages,
  SCOPE_BRIEF_INCLUDED,
  SCOPE_BRIEF_OPTIONAL,
  validateScopeBrief,
} from "@/data/scopeBriefs";
import { fetchClientScopeBrief, saveClientScopeBrief } from "@/data/scopeBriefsRepository";
import { formatClientDate } from "@/data/agencyClients";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

export function ClientScope() {
  const { client } = usePortalSession();
  const [pages, setPages] = useState<string[]>(defaultScopePages);
  const [goal, setGoal] = useState("");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!client?.id) {
      setLoading(false);
      return;
    }
    let active = true;
    void fetchClientScopeBrief(client.id)
      .then((brief) => {
        if (!active || !brief) return;
        setPages(brief.selectedPages);
        setGoal(brief.goal);
        setSubmittedAt(brief.submittedAt);
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof AgencyDbError ? caught.message : "Unable to load this form.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client?.id]);

  function toggle(page: string) {
    setSaved(false);
    setError(null);
    setPages((current) => (current.includes(page) ? current.filter((item) => item !== page) : [...current, page]));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!client?.id || busy) return;
    const invalid = validateScopeBrief(pages, goal);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const brief = await saveClientScopeBrief(client.id, pages, goal);
      setPages(brief.selectedPages);
      setGoal(brief.goal);
      setSubmittedAt(brief.submittedAt);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to save this form.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">Scope</h1>
        <p className="mt-1 text-sm text-[var(--client-muted)]">
          This is not the proposal. It tells MotiveScripts which pages to plan and what the site should do.
        </p>
      </header>

      {submittedAt && !loading ? (
        <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
          <p className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">Scope submitted ✓</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
            Thanks. We’ve received your website requirements. MotiveScripts will review your scope and prepare your
            project and proposal.
          </p>
          <p className="mt-3 text-sm text-[var(--client-ink)]">
            Status: <span className="font-heading font-semibold">Scope Submitted</span>
            <span className="text-[var(--client-muted)]"> · {formatClientDate(submittedAt)}</span>
          </p>
        </section>
      ) : !loading && !submittedAt ? (
        <section className="rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[var(--client-card)] p-5 md:p-6">
          <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">Scope form</p>
          <p className="mt-1 text-sm text-[var(--client-muted)]">Not completed</p>
        </section>
      ) : null}

      {loading ? (
        <div className="h-64 animate-pulse rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)]" />
      ) : (
        <form
          className="space-y-6 rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6"
          onSubmit={onSubmit}
        >
          {submittedAt ? (
            <p className="text-sm text-[var(--client-muted)]">
              Submitted {formatClientDate(submittedAt)}. You can update this if something changes.
            </p>
          ) : null}

          <fieldset>
            <legend className="font-heading text-sm font-semibold text-[var(--client-ink)]">Included with the website</legend>
            <p className="mt-1 text-[12px] text-[var(--client-muted)]">These start selected. Click to remove one.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SCOPE_BRIEF_INCLUDED.map((item) => (
                <Chip key={item} label={item} on={pages.includes(item)} included onClick={() => toggle(item)} />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-heading text-sm font-semibold text-[var(--client-ink)]">Add pages and setup</legend>
            <p className="mt-1 text-[12px] text-[var(--client-muted)]">Choose anything else you want on the first build.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SCOPE_BRIEF_OPTIONAL.map((item) => (
                <Chip key={item} label={item} on={pages.includes(item)} onClick={() => toggle(item)} />
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="font-heading text-sm font-semibold text-[var(--client-ink)]">What should this website do?</span>
            <p className="mt-1 text-[12px] text-[var(--client-muted)]">
              A few sentences is enough — who it’s for, and what visitors should do.
            </p>
            <textarea
              required
              rows={5}
              maxLength={2000}
              value={goal}
              onChange={(event) => {
                setGoal(event.target.value);
                setSaved(false);
                setError(null);
              }}
              className="mt-3 w-full rounded-lg border border-[var(--client-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            />
          </label>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {saved ? (
            <p className="text-sm text-[var(--client-ink)]">
              Saved. MotiveScripts will use this to prepare your project and proposal.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !client}
            className="inline-flex h-11 items-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)] disabled:opacity-60"
          >
            {busy ? "Saving…" : submittedAt ? "Update scope" : "Submit scope"}
          </button>
        </form>
      )}
    </div>
  );
}

function Chip({
  label,
  on,
  included = false,
  onClick,
}: {
  label: string;
  on: boolean;
  included?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 font-heading text-[12px] font-semibold",
        on
          ? "border-[var(--client-navy)] bg-[var(--client-navy)] text-white"
          : "border-[var(--client-line)] bg-white text-[var(--client-ink)] hover:border-[rgb(0_80_240_/_0.35)] hover:bg-[var(--client-hover)]",
      )}
    >
      {on ? (included ? `${label} · Included` : label) : `+ ${label}`}
    </button>
  );
}
