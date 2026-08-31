import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClientConfirmDialog } from "@/components/client/ClientConfirmDialog";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { useUnsavedNavigation } from "@/components/documents/UnsavedChangesDialog";
import {
  draftFromBrief,
  emptyScopeDraft,
  needsComplexityNote,
  scopeStatus,
  scopeStatusLabel,
  validateScopeBrief,
  SCOPE_FEATURE_OPTIONS,
  SCOPE_PACKAGE_INCLUDED,
  SCOPE_PAGE_OPTIONS,
  SCOPE_STYLE_OPTIONS,
  type ScopeBriefDraft,
  type ScopeStatus,
} from "@/data/scopeBriefs";
import { fetchClientScopeBrief, saveClientScopeBrief } from "@/data/scopeBriefsRepository";
import { formatClientDate } from "@/data/agencyClients";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

const fieldClass =
  "mt-2 w-full rounded-lg border border-[var(--client-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]";

function draftSnapshot(draft: ScopeBriefDraft) {
  return JSON.stringify(draft);
}

export function ClientScope() {
  const { client } = usePortalSession();
  const [draft, setDraft] = useState<ScopeBriefDraft>(emptyScopeDraft);
  const [status, setStatus] = useState<ScopeStatus>("not_started");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<"draft" | "submit" | null>(null);
  const [dirty, setDirty] = useState(false);
  const snapshotRef = useRef(draftSnapshot(emptyScopeDraft()));
  const blocker = useUnsavedNavigation(dirty);

  function remember(next: ScopeBriefDraft) {
    snapshotRef.current = draftSnapshot(next);
    setDirty(false);
  }

  useEffect(() => {
    if (!client?.id) {
      setLoading(false);
      return;
    }
    let active = true;
    void fetchClientScopeBrief(client.id)
      .then((brief) => {
        if (!active) return;
        const next = brief ? draftFromBrief(brief) : emptyScopeDraft();
        setDraft(next);
        setStatus(scopeStatus(brief));
        setSubmittedAt(brief?.submittedAt ?? null);
        remember(next);
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

  function patch(next: Partial<ScopeBriefDraft>) {
    setNotice(null);
    setError(null);
    setDraft((current) => {
      const merged = { ...current, ...next };
      setDirty(draftSnapshot(merged) !== snapshotRef.current);
      return merged;
    });
  }

  function toggle(key: "pages" | "features" | "styles", label: string) {
    const list = draft[key];
    patch({
      [key]: list.includes(label) ? list.filter((item) => item !== label) : [...list, label],
    });
  }

  async function persist(submit: boolean) {
    if (!client?.id || busy) return;
    if (submit) {
      const invalid = validateScopeBrief(draft);
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    setBusy(submit ? "submit" : "draft");
    setError(null);
    try {
      const brief = await saveClientScopeBrief(client.id, draft, { submit });
      const next = draftFromBrief(brief);
      setDraft(next);
      setStatus(scopeStatus(brief));
      setSubmittedAt(brief.submittedAt);
      setNotice(submit ? "submit" : "draft");
      remember(next);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to save this form.");
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await persist(true);
  }

  const submitted = status === "submitted";

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">Website Scope</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--client-muted)]">
          Tell us what you want your website to include and what you want it to do. This helps MotiveScripts plan your
          project and prepare an accurate proposal.
        </p>
      </header>

      {!loading ? (
        <section
          className={cn(
            "rounded-[var(--client-radius)] border bg-[var(--client-card)] p-5 md:p-6",
            submitted ? "border-[var(--client-line)]" : "border-[rgb(0_80_240_/_0.22)]",
          )}
        >
          {submitted ? (
            <>
              <p className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">
                Scope Submitted ✓
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
                Thanks! We’ve received your website requirements. MotiveScripts will review your scope and use it to
                plan your project and prepare your proposal.
              </p>
              <p className="mt-3 text-sm text-[var(--client-ink)]">
                Status: <span className="font-heading font-semibold">Submitted</span>
                {submittedAt ? (
                  <span className="text-[var(--client-muted)]"> · {formatClientDate(submittedAt)}</span>
                ) : null}
              </p>
            </>
          ) : (
            <>
              <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">
                Status: {scopeStatusLabel(status)}
              </p>
              <p className="mt-1 text-sm text-[var(--client-muted)]">
                {status === "in_progress"
                  ? "Your scope is saved as a draft. You can come back and finish it later."
                  : "Tell us what you want your website to include."}
              </p>
            </>
          )}
        </section>
      ) : null}

      {loading ? (
        <div className="h-64 animate-pulse rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)]" />
      ) : (
        <form
          className="space-y-8 rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6"
          onSubmit={onSubmit}
        >
          {submitted ? (
            <p className="text-sm text-[var(--client-muted)]">
              You can update this if something changes. We still keep one scope record for your account.
            </p>
          ) : null}

          <section>
            <h2 className="font-heading text-sm font-semibold text-[var(--client-ink)]">Included in your website package</h2>
            <ul className="mt-3 space-y-2">
              {SCOPE_PACKAGE_INCLUDED.map((item) => (
                <li key={item} className="text-sm font-medium text-[var(--client-ink)]">
                  ✓ {item}
                </li>
              ))}
            </ul>
          </section>

          <fieldset>
            <legend className="font-heading text-sm font-semibold text-[var(--client-ink)]">What pages do you need?</legend>
            <p className="mt-1 text-[12px] text-[var(--client-muted)]">
              Select any additional pages you’d like included in the first build.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SCOPE_PAGE_OPTIONS.map((item) => (
                <Chip key={item} label={item} on={draft.pages.includes(item)} onClick={() => toggle("pages", item)} />
              ))}
            </div>
            {draft.pages.includes("Other") ? (
              <label className="mt-3 block">
                <span className="text-[12px] font-semibold text-[var(--client-ink)]">Describe another page</span>
                <input
                  value={draft.otherPages}
                  onChange={(event) => patch({ otherPages: event.target.value })}
                  className={fieldClass}
                  placeholder="Events calendar, menu, shop locator…"
                />
              </label>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="font-heading text-sm font-semibold text-[var(--client-ink)]">What should your website do?</legend>
            <p className="mt-1 text-[12px] text-[var(--client-muted)]">Select the features or functionality you need.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SCOPE_FEATURE_OPTIONS.map((item) => (
                <Chip key={item} label={item} on={draft.features.includes(item)} onClick={() => toggle("features", item)} />
              ))}
            </div>
            {draft.features.includes("Other") ? (
              <label className="mt-3 block">
                <span className="text-[12px] font-semibold text-[var(--client-ink)]">Describe the functionality</span>
                <input
                  value={draft.otherFeatures}
                  onChange={(event) => patch({ otherFeatures: event.target.value })}
                  className={fieldClass}
                  placeholder="Member directory, inventory search…"
                />
              </label>
            ) : null}
            {needsComplexityNote(draft) ? (
              <p className="mt-3 text-[12px] leading-relaxed text-[var(--client-muted)]">
                Some features may require additional development or services. MotiveScripts will review your requirements
                and include applicable costs in your proposal.
              </p>
            ) : null}
          </fieldset>

          <label className="block">
            <span className="font-heading text-sm font-semibold text-[var(--client-ink)]">
              What is your website for?{" "}
              <span className="font-medium text-[var(--client-muted)]">(required to submit)</span>
            </span>
            <p className="mt-1 text-[12px] text-[var(--client-muted)]">
              Tell us briefly about your business, who the website is for, and what you want visitors to do.
            </p>
            <textarea
              rows={4}
              maxLength={2000}
              value={draft.goal}
              onChange={(event) => patch({ goal: event.target.value })}
              className={fieldClass}
              placeholder="We’re a landscaping company serving homeowners in Winston-Salem. We want visitors to learn about our services and request a free quote."
            />
          </label>

          <fieldset>
            <legend className="font-heading text-sm font-semibold text-[var(--client-ink)]">
              Do you currently have a website?{" "}
              <span className="font-medium text-[var(--client-muted)]">(required to submit)</span>
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip label="Yes" on={draft.hasExistingWebsite === true} onClick={() => patch({ hasExistingWebsite: true })} />
              <Chip
                label="No"
                on={draft.hasExistingWebsite === false}
                onClick={() => patch({ hasExistingWebsite: false, currentWebsiteUrl: "", currentWebsiteNotes: "" })}
              />
            </div>
            {draft.hasExistingWebsite ? (
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="font-heading text-sm font-semibold text-[var(--client-ink)]">Current website</span>
                  <input
                    type="text"
                    inputMode="url"
                    value={draft.currentWebsiteUrl}
                    onChange={(event) => patch({ currentWebsiteUrl: event.target.value })}
                    className={fieldClass}
                    placeholder="https://example.com"
                  />
                </label>
                <label className="block">
                  <span className="font-heading text-sm font-semibold text-[var(--client-ink)]">What would you like to improve?</span>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={draft.currentWebsiteNotes}
                    onChange={(event) => patch({ currentWebsiteNotes: event.target.value })}
                    className={fieldClass}
                    placeholder="Tell us what you like, dislike, or want to change about your current website."
                  />
                </label>
              </div>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="font-heading text-sm font-semibold text-[var(--client-ink)]">What style are you looking for?</legend>
            <p className="mt-1 text-[12px] text-[var(--client-muted)]">You can select more than one.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SCOPE_STYLE_OPTIONS.map((item) => (
                <Chip key={item} label={item} on={draft.styles.includes(item)} onClick={() => toggle("styles", item)} />
              ))}
            </div>
            {draft.styles.includes("Other") ? (
              <label className="mt-3 block">
                <span className="text-[12px] font-semibold text-[var(--client-ink)]">Describe the style</span>
                <input
                  value={draft.otherStyle}
                  onChange={(event) => patch({ otherStyle: event.target.value })}
                  className={fieldClass}
                  placeholder="Warm, photo-heavy, like a local magazine…"
                />
              </label>
            ) : null}
            <label className="mt-4 block">
              <span className="font-heading text-sm font-semibold text-[var(--client-ink)]">
                Websites you like <span className="font-medium text-[var(--client-muted)]">(optional)</span>
              </span>
              <p className="mt-1 text-[12px] text-[var(--client-muted)]">
                Share links to websites whose design or functionality you like.
              </p>
              <textarea
                rows={2}
                maxLength={1000}
                value={draft.likedWebsites}
                onChange={(event) => patch({ likedWebsites: event.target.value })}
                className={fieldClass}
                placeholder="https://…"
              />
            </label>
          </fieldset>

          <label className="block">
            <span className="font-heading text-sm font-semibold text-[var(--client-ink)]">
              Anything else? <span className="font-medium text-[var(--client-muted)]">(optional)</span>
            </span>
            <p className="mt-1 text-[12px] text-[var(--client-muted)]">
              Is there anything else we should know about your website project?
            </p>
            <textarea
              rows={3}
              maxLength={2000}
              value={draft.additionalNotes}
              onChange={(event) => patch({ additionalNotes: event.target.value })}
              className={fieldClass}
            />
          </label>

          <p className="text-[12px] leading-relaxed text-[var(--client-muted)]">
            Your selections help us understand your requirements. We’ll review your scope and include the appropriate
            work in your proposal. Selecting an option does not mean it is already priced or included.
          </p>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {notice === "draft" ? (
            <p className="text-sm text-[var(--client-ink)]">
              Draft saved ✓ Your scope has been saved. You can come back and finish it later.
            </p>
          ) : null}
          {notice === "submit" ? (
            <p className="text-sm text-[var(--client-ink)]">
              Scope submitted ✓ Thanks! We’ve received your website requirements. MotiveScripts will review your scope
              and use it to plan your project and prepare your proposal.
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            {!submitted ? (
              <button
                type="button"
                disabled={Boolean(busy) || !client}
                onClick={() => void persist(false)}
                className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-hover)] disabled:opacity-60"
              >
                {busy === "draft" ? "Saving…" : "Save Draft"}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={Boolean(busy) || !client}
              className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)] disabled:opacity-60"
            >
              {busy === "submit" ? "Submitting…" : submitted ? "Update scope" : "Submit Scope"}
            </button>
          </div>
        </form>
      )}

      <ClientConfirmDialog
        open={blocker.state === "blocked"}
        title="Unsaved changes"
        body="You have unsaved changes. Save your draft before leaving?"
        confirmLabel="Leave without saving"
        cancelLabel="Stay"
        onConfirm={blocker.proceed}
        onCancel={blocker.reset}
      />
    </div>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
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
      {on ? `${label} ✓` : `+ ${label}`}
    </button>
  );
}
