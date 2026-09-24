import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, CircleCheck, ExternalLink, Globe, Heart, LayoutTemplate, Package, Palette, Puzzle, Plus, StickyNote, Target, type LucideIcon } from "lucide-react";
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
  SCOPE_PACKAGE_INCLUDED,
  SCOPE_STYLE_OPTIONS,
  type ScopeBriefDraft,
  type ScopeStatus,
} from "@/data/scopeBriefs";
import { fetchClientScopeBrief, saveClientScopeBrief, type ScopeCatalogAllowList } from "@/data/scopeBriefsRepository";
import { fetchActiveFeatureCatalog } from "@/data/featureCatalogRepository";
import type { FeatureCatalogItem } from "@/data/featureCatalog";
import {
  applyFeatureRecommendations,
  applyPageRecommendations,
  recommendedScopeFeatures,
  recommendedScopePages,
} from "@/data/scopeRecommendations";
import { formatClientDate } from "@/data/agencyClients";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";
import { ScopeRecommendPanel } from "@/components/client/ScopeRecommendPanel";
import { ScopePackageChooser } from "@/components/client/ScopePackageChooser";
import { pricingTiers } from "@/data/pricing";
import { projectPackageLabels } from "@/data/projectPackages";
import { displayHttpHost, safeHttpHref } from "@/lib/safeUrl";
import { scopePackageHint } from "@/data/scopePackageHint";

/** The scope form's steps. The last one is the review; the one before it holds what's required to submit. */
const SCOPE_STEPS = ["Package", "Pages & features", "Your project", "Review"] as const;

const fieldClass =
  "mt-2 w-full rounded-lg border border-[var(--client-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]";

function draftSnapshot(draft: ScopeBriefDraft) {
  return JSON.stringify(draft);
}

function catalogAllowList(items: FeatureCatalogItem[]): ScopeCatalogAllowList {
  return {
    pages: new Set(items.filter((item) => item.category === "page").map((item) => item.name)),
    features: new Set(items.filter((item) => item.category === "feature").map((item) => item.name)),
  };
}

export function ClientScope() {
  const { client } = usePortalSession();
  const [draft, setDraft] = useState<ScopeBriefDraft>(emptyScopeDraft);
  const [status, setStatus] = useState<ScopeStatus>("not_started");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<FeatureCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<"draft" | "submit" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(0);
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
    async function load(clientId: string) {
      const items = await fetchActiveFeatureCatalog();
      if (!active) return;
      setCatalog(items);
      const allowed = catalogAllowList(items);
      const brief = await fetchClientScopeBrief(clientId, allowed);
      if (!active) return;
      const next = brief ? draftFromBrief(brief) : emptyScopeDraft();
      setDraft(next);
      setStatus(scopeStatus(brief));
      setSubmittedAt(brief?.submittedAt ?? null);
      remember(next);
    }
    load(client.id)
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

  const catalogPages = useMemo(() => catalog.filter((item) => item.category === "page"), [catalog]);
  const catalogFeatures = useMemo(() => catalog.filter((item) => item.category === "feature"), [catalog]);

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

  function addRecommendedPages(picks: string[]) {
    const next = applyPageRecommendations(draft, picks);
    patch({ pages: next.pages });
  }

  function addRecommendedFeatures(picks: string[]) {
    const next = applyFeatureRecommendations(draft, picks);
    patch({ features: next.features });
  }

  async function persist(submit: boolean) {
    if (busy) return;
    if (!client?.id) {
      setError("We couldn't identify your account yet. Refresh the page and try again.");
      return;
    }
    if (submit) {
      const invalid = validateScopeBrief(draft);
      if (invalid) {
        setError(invalid);
        // What's required to submit (the goal, and whether they have a website) is on the "Your project" step.
        if (!draft.goal.trim() || draft.hasExistingWebsite === null) setStep(SCOPE_STEPS.length - 2);
        return;
      }
    }
    setBusy(submit ? "submit" : "draft");
    setError(null);
    try {
      const brief = await saveClientScopeBrief(client.id, draft, { submit, allowed: catalogAllowList(catalog) });
      const next = draftFromBrief(brief);
      setDraft(next);
      setStatus(scopeStatus(brief));
      setSubmittedAt(brief.submittedAt);
      setNotice(submit ? "submit" : "draft");
      remember(next);
      if (submit) {
        setEditing(false);
        setStep(0);
      }
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to save this form.");
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    // Enter inside a field on an earlier step means "next", not "submit".
    if (step < SCOPE_STEPS.length - 1) {
      goToStep(step + 1);
      return;
    }
    await persist(true);
  }

  function goToStep(next: number) {
    setError(null);
    setStep(next);
    document.getElementById("client-main")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  const submitted = status === "submitted";
  const formOpen = !submitted || editing;

  function cancelEdit() {
    const next = JSON.parse(snapshotRef.current) as ScopeBriefDraft;
    setDraft(next);
    setDirty(false);
    setEditing(false);
    setStep(0);
    setError(null);
    setNotice(null);
  }

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
              <p className="mt-3 text-sm text-[var(--client-muted)]">
                You can update this if something changes. We still keep one scope record for your account.
              </p>
              {!editing ? (
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setError(null);
                    setEditing(true);
                  }}
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-hover)]"
                >
                  Edit scope
                </button>
              ) : (
                <p className="mt-3 text-sm text-[var(--client-ink)]">You’re editing your submitted scope.</p>
              )}
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
      ) : formOpen ? (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">
              Step {step + 1} of {SCOPE_STEPS.length}
            </p>
            <p className="text-[12px] text-[var(--client-muted)]">Takes about 2 minutes</p>
          </div>
          <ol className="mt-4 flex items-start">
            {SCOPE_STEPS.map((label, index) => {
              const done = index < step;
              const current = index === step;
              return (
                <li key={label} className="flex min-w-0 flex-1 items-start last:flex-none">
                  <button
                    type="button"
                    onClick={() => goToStep(index)}
                    aria-current={current ? "step" : undefined}
                    className="group flex flex-col items-center gap-2 text-center"
                  >
                    <span
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-full border-2 font-heading text-xs font-semibold transition-colors",
                        done && "border-[var(--client-blue)] bg-[var(--client-blue)] text-white",
                        current && "border-[var(--client-blue)] bg-white text-[var(--client-blue)] ring-4 ring-[rgb(0_80_240_/_0.12)]",
                        !done && !current && "border-[var(--client-line)] bg-white text-[var(--client-muted)] group-hover:border-[rgb(0_80_240_/_0.35)]",
                      )}
                    >
                      {done ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : index + 1}
                    </span>
                    <span
                      className={cn(
                        "font-heading text-[12px] font-semibold",
                        current ? "text-[var(--client-ink)]" : "text-[var(--client-muted)]",
                        !current && "hidden sm:block",
                      )}
                    >
                      {label}
                    </span>
                  </button>
                  {index < SCOPE_STEPS.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className={cn("mx-2 mt-4 h-px flex-1", index < step ? "bg-[var(--client-blue)]" : "bg-[var(--client-line)]")}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>

        {submitted ? (
            <p className="text-sm text-[var(--client-muted)]">
              Change only what you need, then save. This still updates the same scope record for your account.
            </p>
          ) : null}

          {step === 0 ? (
          <>
          <FormCard
            icon={Package}
            title="Which package fits you?"
            hint="Pick the closest match. We confirm the package and the price in your proposal, so you can change your mind."
          >
            <ScopePackageChooser
              value={draft.package}
              onChange={(next) => patch({ package: next })}
              hint={scopePackageHint(draft.package, draft.pages, draft.features)}
            />
          </FormCard>

          <FormCard icon={CircleCheck} title="Included with every package">
            <ul className="space-y-2">
              {SCOPE_PACKAGE_INCLUDED.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm font-medium text-[var(--client-ink)]">
                  <Check size={16} strokeWidth={2.6} className="shrink-0 text-[var(--client-blue)]" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </FormCard>
          </>
        ) : null}

        {step === 1 ? (
          <>
          <FormCard
            icon={LayoutTemplate}
            title="What pages do you need?"
            hint="Select any additional pages you’d like included in the first build."
          >
            <div className="flex flex-wrap gap-2">
              {catalogPages.map((item) => (
                <Chip key={item.id} label={item.name} on={draft.pages.includes(item.name)} onClick={() => toggle("pages", item.name)} />
              ))}
            </div>
            {draft.pages.includes("Other") ? (
              <label className="mt-4 block">
                <span className="text-[12px] font-semibold text-[var(--client-ink)]">Describe another page</span>
                <input
                  value={draft.otherPages}
                  onChange={(event) => patch({ otherPages: event.target.value })}
                  className={fieldClass}
                  placeholder="Events calendar, menu, shop locator…"
                />
              </label>
            ) : null}
            <ScopeRecommendPanel
              kind="pages"
              industry={client?.industry}
              suggestions={recommendedScopePages(client?.industry)}
              selected={draft.pages}
              onAdd={addRecommendedPages}
            />
          </FormCard>

          <FormCard icon={Puzzle} title="What should your website do?" hint="Select the features or functionality you need.">
            <div className="flex flex-wrap gap-2">
              {catalogFeatures.map((item) => (
                <Chip key={item.id} label={item.name} on={draft.features.includes(item.name)} onClick={() => toggle("features", item.name)} />
              ))}
            </div>
            {draft.features.includes("Other") ? (
              <label className="mt-4 block">
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
              <p className="mt-4 text-[12px] leading-relaxed text-[var(--client-muted)]">
                Some features may require additional development or services. MotiveScripts will review your requirements
                and include applicable costs in your proposal.
              </p>
            ) : null}
            <ScopeRecommendPanel
              kind="features"
              industry={client?.industry}
              suggestions={recommendedScopeFeatures(client?.industry)}
              selected={draft.features}
              onAdd={addRecommendedFeatures}
            />
          </FormCard>
          </>
        ) : null}

        {step === 2 ? (
          <>
          <FormCard
            icon={Target}
            title="What is your website for?"
            badge="Required to submit"
            hint="Tell us briefly about your business, who the website is for, and what you want visitors to do."
          >
            <textarea
              rows={4}
              maxLength={2000}
              aria-label="What is your website for?"
              value={draft.goal}
              onChange={(event) => patch({ goal: event.target.value })}
              className={cn(fieldClass, "mt-0")}
              placeholder="We’re a landscaping company serving homeowners in Winston-Salem. We want visitors to learn about our services and request a free quote."
            />
          </FormCard>

          <FormCard icon={Globe} title="Do you currently have a website?" badge="Required to submit">
            <div className="flex flex-wrap gap-2">
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
          </FormCard>

          <FormCard icon={Palette} title="What style are you looking for?" hint="You can select more than one.">
            <div className="flex flex-wrap gap-2">
              {SCOPE_STYLE_OPTIONS.map((item) => (
                <Chip key={item} label={item} on={draft.styles.includes(item)} onClick={() => toggle("styles", item)} />
              ))}
            </div>
            {draft.styles.includes("Other") ? (
              <label className="mt-4 block">
                <span className="text-[12px] font-semibold text-[var(--client-ink)]">Describe the style</span>
                <input
                  value={draft.otherStyle}
                  onChange={(event) => patch({ otherStyle: event.target.value })}
                  className={fieldClass}
                  placeholder="Warm, photo-heavy, like a local magazine…"
                />
              </label>
            ) : null}
          </FormCard>

          <FormCard
            icon={Heart}
            title="Websites you like"
            badge="Optional"
            hint="Share links to websites whose design or functionality you like."
          >
            <textarea
              rows={2}
              maxLength={1000}
              aria-label="Websites you like"
              value={draft.likedWebsites}
              onChange={(event) => patch({ likedWebsites: event.target.value })}
              className={cn(fieldClass, "mt-0")}
              placeholder="https://…"
            />
          </FormCard>

          <FormCard
            icon={StickyNote}
            title="Anything else?"
            badge="Optional"
            hint="Is there anything else we should know about your website project?"
          >
            <textarea
              rows={3}
              maxLength={2000}
              aria-label="Anything else?"
              value={draft.additionalNotes}
              onChange={(event) => patch({ additionalNotes: event.target.value })}
              className={cn(fieldClass, "mt-0")}
            />
          </FormCard>
          </>
        ) : null}

        {step === SCOPE_STEPS.length - 1 ? (
          <>
          <ScopeSummary draft={draft} />
          <p className="px-1 text-[12px] leading-relaxed text-[var(--client-muted)]">
            Your selections help us understand your requirements. We’ll review your scope and include the appropriate
            work in your proposal. Selecting an option does not mean it is already priced or included.
          </p>
          </>
        ) : null}

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

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            {step > 0 ? (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => goToStep(step - 1)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-hover)] disabled:opacity-60"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Back
              </button>
            ) : null}
            {submitted ? (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={cancelEdit}
                className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] px-3 font-heading text-sm font-semibold text-[var(--client-muted)] hover:text-[var(--client-ink)] disabled:opacity-60"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                disabled={Boolean(busy) || !client}
                onClick={() => void persist(false)}
                className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] px-3 font-heading text-sm font-semibold text-[var(--client-muted)] hover:text-[var(--client-ink)] disabled:opacity-60"
              >
                {busy === "draft" ? "Saving…" : "Save draft"}
              </button>
            )}
          </div>
          {step < SCOPE_STEPS.length - 1 ? (
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--client-blue)] px-6 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
            >
              Next
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={Boolean(busy) || !client}
              className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-6 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)] disabled:opacity-60"
            >
              {busy === "submit" ? "Submitting…" : submitted ? "Update scope" : "Submit scope"}
            </button>
          )}
        </div>
        
      </form>
      ) : (
        <ScopeSummary draft={draft} onEdit={() => {
          setNotice(null);
          setError(null);
          setEditing(true);
        }} />
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

function ScopeSummary({ draft, onEdit }: { draft: ScopeBriefDraft; onEdit?: () => void }) {
  const tier = draft.package ? pricingTiers.find((item) => item.id === draft.package) : undefined;
  const currentSite = safeHttpHref(draft.currentWebsiteUrl.trim());
  const pages = [
    ...draft.pages.filter((item) => item !== "Other"),
    ...(draft.pages.includes("Other") && draft.otherPages.trim() ? [draft.otherPages.trim()] : []),
  ];
  const features = [
    ...draft.features.filter((item) => item !== "Other"),
    ...(draft.features.includes("Other") && draft.otherFeatures.trim() ? [draft.otherFeatures.trim()] : []),
  ];
  const styles = [
    ...draft.styles.filter((item) => item !== "Other"),
    ...(draft.styles.includes("Other") && draft.otherStyle.trim() ? [draft.otherStyle.trim()] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard icon={Package} title="Your package">
          <p className="font-heading text-2xl font-semibold tracking-tight text-[var(--client-ink)]">
            {draft.package ? projectPackageLabels[draft.package] : "Not sure yet"}
          </p>
          {tier ? (
            <p className="mt-1 font-heading text-sm font-semibold text-[var(--client-blue)]">
              {tier.price.startsWith("$") ? `Starting at ${tier.price}` : tier.price}
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--client-muted)]">We’ll recommend one that fits.</p>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--client-muted)]">
            We confirm the package and the price in your proposal.
          </p>
        </SummaryCard>

        <SummaryCard icon={CircleCheck} title="Included with every package">
          <ul className="space-y-2">
            {SCOPE_PACKAGE_INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm font-medium text-[var(--client-ink)]">
                <Check size={16} strokeWidth={2.6} className="shrink-0 text-[var(--client-blue)]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </SummaryCard>
      </div>

      <SummaryCard icon={Target} title="What your website is for">
        <p className="whitespace-pre-wrap border-l-2 border-[var(--client-blue)] pl-4 text-[15px] leading-relaxed text-[var(--client-ink)]">
          {draft.goal.trim() || "—"}
        </p>
      </SummaryCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard icon={LayoutTemplate} title="Extra pages">
          <TagList items={pages} empty="No additional pages selected." />
        </SummaryCard>
        <SummaryCard icon={Puzzle} title="Features">
          <TagList items={features} empty="No additional features selected." />
        </SummaryCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard icon={Globe} title="Your current website">
          {draft.hasExistingWebsite ? (
            <div className="space-y-2">
              {currentSite ? (
                <a
                  href={currentSite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-heading text-sm font-semibold text-[var(--client-blue)] hover:underline"
                >
                  {displayHttpHost(draft.currentWebsiteUrl)}
                  <ExternalLink size={14} strokeWidth={2.2} aria-hidden="true" />
                </a>
              ) : draft.currentWebsiteUrl.trim() ? (
                <p className="text-sm font-medium text-[var(--client-ink)]">{draft.currentWebsiteUrl}</p>
              ) : null}
              {draft.currentWebsiteNotes.trim() ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--client-muted)]">{draft.currentWebsiteNotes}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--client-muted)]">
              {draft.hasExistingWebsite === false ? "No current website. This will be your first." : "Not answered."}
            </p>
          )}
        </SummaryCard>

        <SummaryCard icon={Palette} title="Style">
          <TagList items={styles} empty="No style selected." />
        </SummaryCard>
      </div>

      {draft.likedWebsites.trim() ? (
        <SummaryCard icon={Heart} title="Websites you like">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--client-ink)]">{draft.likedWebsites}</p>
        </SummaryCard>
      ) : null}

      {draft.additionalNotes.trim() ? (
        <SummaryCard icon={StickyNote} title="Anything else">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--client-ink)]">{draft.additionalNotes}</p>
        </SummaryCard>
      ) : null}

      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
        >
          Edit scope
        </button>
      ) : null}
    </div>
  );
}

function SummaryCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5">
      <h2 className="flex items-center gap-2.5 font-heading text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--client-muted)]">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--client-blue)]">
          <Icon size={15} strokeWidth={2} aria-hidden="true" />
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TagList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-[var(--client-muted)]">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(0_80_240_/_0.07)] px-3 py-1.5 font-heading text-[12px] font-semibold text-[var(--client-ink)]"
        >
          <Check size={12} strokeWidth={3} className="text-[var(--client-blue)]" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** A form section as a card: an icon, the question, an optional hint and a "required" / "optional" tag. */
function FormCard({
  icon: Icon,
  title,
  hint,
  badge,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  badge?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      role="group"
      aria-labelledby={headingId}
      className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={headingId} className="flex items-center gap-2.5 font-heading text-[15px] font-semibold text-[var(--client-ink)]">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--client-blue)]">
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
          </span>
          {title}
        </h2>
        {badge ? (
          <span className="shrink-0 rounded-full bg-[var(--client-bg)] px-2.5 py-1 font-heading text-[11px] font-semibold text-[var(--client-muted)]">
            {badge}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-[12px] leading-relaxed text-[var(--client-muted)]">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 font-heading text-[12px] font-semibold transition-colors",
        on
          ? "border-[rgb(0_80_240_/_0.35)] bg-[rgb(0_80_240_/_0.08)] text-[var(--client-ink)]"
          : "border-[var(--client-line)] bg-white text-[var(--client-muted)] hover:border-[rgb(0_80_240_/_0.35)] hover:bg-[var(--client-hover)] hover:text-[var(--client-ink)]",
      )}
    >
      {on ? (
        <Check size={13} strokeWidth={3} className="text-[var(--client-blue)]" aria-hidden="true" />
      ) : (
        <Plus size={13} strokeWidth={2.6} aria-hidden="true" />
      )}
      {label}
    </button>
  );
}
