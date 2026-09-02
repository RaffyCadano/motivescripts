import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { ClientConfirmDialog } from "@/components/client/ClientConfirmDialog";
import { useUnsavedNavigation } from "@/components/documents/UnsavedChangesDialog";
import { formatClientDate } from "@/data/agencyClients";
import {
  DISCOVERY_MAIN_GOAL_OPTIONS,
  DISCOVERY_SECTIONS,
  DISCOVERY_VISITOR_ACTION_OPTIONS,
  DISCOVERY_WEBSITE_FEEL_OPTIONS,
  allDiscoveryFeatureOptions,
  discoveryFormFromClient,
  discoverySectionProgress,
  emptyDiscoveryFormData,
  mergeDiscoveryFormData,
  scopeFeaturesForDiscovery,
  scopePagesForDiscovery,
  type DiscoveryFormData,
  type DiscoveryIntakeFile,
  type DiscoveryServiceEntry,
} from "@/data/discoveryIntake";
import {
  fetchDiscoveryIntakeByProject,
  fetchDiscoveryIntakeFiles,
  insertDiscoveryIntakeFile,
  saveDiscoveryIntakeDraft,
  submitDiscoveryIntake,
} from "@/data/discoveryIntakeRepository";
import { fetchClientScopeBrief } from "@/data/scopeBriefsRepository";
import { uploadDiscoveryIntakeFile, signedUrlForPath } from "@/data/fileStorage";
import { fileExtension } from "@/data/fileUploadConfig";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

const fieldClass =
  "mt-2 w-full rounded-lg border border-[var(--client-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]";

const SECTION_LABELS: Record<string, string> = {
  business: "Business",
  goals: "Goals",
  pages: "Pages",
  content: "Content",
  branding: "Branding",
  features: "Features",
  domain: "Domain",
  review: "Review",
};

function formSnapshot(form: DiscoveryFormData) {
  return JSON.stringify(form);
}

export function ClientDiscovery() {
  const { projectId } = useParams();
  const session = usePortalSession();
  const project = projectId
    ? (session.projects.find((item) => item.id === projectId) ?? null)
    : session.project;
  const client = session.client;

  const [form, setForm] = useState<DiscoveryFormData>(emptyDiscoveryFormData());
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<DiscoveryIntakeFile[]>([]);
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("not_started");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [followUpMessage, setFollowUpMessage] = useState<string | null>(null);
  const [scopeBrief, setScopeBrief] = useState<Awaited<ReturnType<typeof fetchClientScopeBrief>>>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"draft" | "submit" | "upload" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const snapshotRef = useRef(formSnapshot(emptyDiscoveryFormData()));
  const blocker = useUnsavedNavigation(dirty);

  const brief = scopeBrief;
  const scopePages = useMemo(() => scopePagesForDiscovery(brief), [brief]);
  const scopeFeatures = useMemo(() => scopeFeaturesForDiscovery(brief), [brief]);
  const featureOptions = useMemo(() => allDiscoveryFeatureOptions(brief), [brief]);

  const editable =
    status === "awaiting_client" || status === "more_information_needed";
  const readOnly = !editable;
  const progress = discoverySectionProgress(form);

  function remember(next: DiscoveryFormData) {
    snapshotRef.current = formSnapshot(next);
    setDirty(false);
  }

  function patchForm(next: Partial<DiscoveryFormData> | ((current: DiscoveryFormData) => DiscoveryFormData)) {
    setNotice(null);
    setError(null);
    setForm((current) => {
      const merged = typeof next === "function" ? next(current) : { ...current, ...next };
      setDirty(formSnapshot(merged) !== snapshotRef.current);
      return merged;
    });
  }

  useEffect(() => {
    if (!project?.id || !client?.id) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const intake = await fetchDiscoveryIntakeByProject(project.id, { includeInternal: false });
        if (!active) return;
        if (!intake) {
          setLoading(false);
          return;
        }
        const briefRow = await fetchClientScopeBrief(client.id).catch(() => null);
        if (!active) return;
        setScopeBrief(briefRow);
        setIntakeId(intake.id);
        setStatus(intake.status);
        setSubmittedAt(intake.submittedAt);
        setFollowUpMessage(intake.followUp?.message ?? null);
        const merged = mergeDiscoveryFormData(intake.formData);
        const hasData = merged.business.businessName.trim() || merged.goals.mainGoals.length > 0;
        const seeded = hasData ? merged : discoveryFormFromClient(client);
        setForm(seeded);
        remember(seeded);
        const loadedFiles = await fetchDiscoveryIntakeFiles(intake.id);
        if (active) setFiles(loadedFiles);
      } catch (caught) {
        if (active) {
          setError(caught instanceof AgencyDbError ? caught.message : "Unable to load discovery form.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [project?.id, client?.id]);

  async function persist(submit: boolean) {
    if (!project?.id || busy) return;
    setBusy(submit ? "submit" : "draft");
    setError(null);
    try {
      const briefForSave = brief ?? (client ? await fetchClientScopeBrief(client.id) : null);
      const result = submit
        ? await submitDiscoveryIntake(project.id, form, briefForSave)
        : await saveDiscoveryIntakeDraft(project.id, form, briefForSave);
      setStatus(result.status);
      setSubmittedAt(result.submittedAt);
      const next = mergeDiscoveryFormData(result.formData);
      setForm(next);
      remember(next);
      setNotice(submit ? "Discovery submitted." : "Progress saved.");
      if (submit) setStep(DISCOVERY_SECTIONS.length - 1);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to save discovery form.");
    } finally {
      setBusy(null);
    }
  }

  async function onUpload(category: DiscoveryIntakeFile["category"], fileList: FileList | null) {
    if (!project?.id || !intakeId || !client?.id || !fileList?.length || busy) return;
    const file = fileList[0];
    setBusy("upload");
    setError(null);
    try {
      const fileId = crypto.randomUUID();
      const storagePath = await uploadDiscoveryIntakeFile({
        projectId: project.id,
        intakeId,
        fileId,
        file,
      });
      const row = await insertDiscoveryIntakeFile({
        intakeId,
        projectId: project.id,
        clientId: client.id,
        category,
        fileName: file.name,
        fileType: fileExtension(file.name).toUpperCase() || "Other",
        fileSize: file.size,
        storagePath,
      });
      setFiles((current) => [row, ...current]);
      setNotice("File uploaded.");
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to upload file.");
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await persist(true);
  }

  if (!project) {
    return (
      <div className="w-full">
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight">Project not found</h1>
        <Link to="/client/project" className="mt-4 inline-flex font-heading text-sm font-semibold text-[var(--client-blue)] hover:underline">
          Back to project
        </Link>
      </div>
    );
  }

  if (!loading && status === "not_started") {
    return (
      <div className="w-full space-y-4">
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">Project Discovery</h1>
        <p className="text-sm text-[var(--client-muted)]">
          Your project manager will send the discovery intake when it is ready.
        </p>
        <Link to={`/client/project/${project.id}`} className="font-heading text-sm font-semibold text-[var(--client-blue)] hover:underline">
          Back to project
        </Link>
      </div>
    );
  }

  const sectionId = DISCOVERY_SECTIONS[step];

  return (
    <div className="w-full space-y-6">
      <header>
        <Link to={`/client/project/${project.id}`} className="font-heading text-[12px] font-semibold text-[var(--client-blue)] hover:underline">
          ← Back to project
        </Link>
        <h1 className="mt-3 font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">Project Discovery</h1>
        <p className="mt-1 text-sm text-[var(--client-muted)]">{project.name}</p>
        <p className="mt-2 max-w-2xl text-sm text-[var(--client-muted)]">
          Let&apos;s get everything our team needs to build your website.
        </p>
      </header>

      {readOnly ? (
        <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
          <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">
            {status === "complete" ? "Discovery complete ✓" : "Discovery submitted"}
          </p>
          {submittedAt ? (
            <p className="mt-2 text-sm text-[var(--client-muted)]">Submitted {formatClientDate(submittedAt)}</p>
          ) : null}
          <p className="mt-2 text-sm text-[var(--client-muted)]">
            {status === "complete"
              ? "Your project manager approved discovery. Production can proceed."
              : "Thanks! Your information has been sent to the MotiveScripts team. We'll review everything and contact you if we need anything else."}
          </p>
        </section>
      ) : null}

      {editable && status === "more_information_needed" && followUpMessage ? (
        <section className="rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[var(--client-card)] p-5 md:p-6">
          <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">Follow-up required</p>
          <p className="mt-2 text-sm text-[var(--client-muted)]">
            Your project manager needs a little more information before we can finalize your website requirements.
          </p>
          <p className="mt-3 rounded-lg border border-[var(--client-line)] bg-white px-3 py-2 text-sm text-[var(--client-muted)]">
            {followUpMessage}
          </p>
        </section>
      ) : null}

      {loading ? (
        <div className="h-64 animate-pulse rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)]" />
      ) : (
        <form onSubmit={onSubmit}>
        <fieldset disabled={readOnly} className="min-w-0 space-y-6 rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6 disabled:opacity-100">
          <div className="flex flex-wrap gap-2">
            {DISCOVERY_SECTIONS.map((id, index) => (
              <button
                key={id}
                type="button"
                onClick={() => setStep(index)}
                className={cn(
                  "rounded-full px-3 py-1 font-heading text-[11px] font-semibold",
                  step === index
                    ? "bg-[var(--client-blue)] text-white"
                    : "bg-[var(--client-hover)] text-[var(--client-muted)]",
                )}
              >
                {index + 1}. {SECTION_LABELS[id]}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 text-sm text-[var(--client-muted)]">
            <span>{progress}% complete</span>
            {notice ? <span className="text-[var(--client-ink)]">{notice}</span> : null}
          </div>
          {error ? <p className="text-sm text-[#b45309]">{error}</p> : null}

          {sectionId === "business" ? (
            <div className="space-y-4">
              <h2 className="font-heading text-sm font-semibold text-[var(--client-ink)]">Business & Contact</h2>
              <p className="text-sm text-[var(--client-muted)]">We pre-filled what we already know. Update anything that changed.</p>
              <label className="block text-sm font-medium">Business name *
                <input required className={fieldClass} value={form.business.businessName} onChange={(e) => patchForm({ business: { ...form.business, businessName: e.target.value } })} />
              </label>
              <label className="block text-sm font-medium">Primary contact *
                <input required className={fieldClass} value={form.business.contactName} onChange={(e) => patchForm({ business: { ...form.business, contactName: e.target.value } })} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">Email *
                  <input required type="email" className={fieldClass} value={form.business.email} onChange={(e) => patchForm({ business: { ...form.business, email: e.target.value } })} />
                </label>
                <label className="block text-sm font-medium">Phone
                  <input className={fieldClass} value={form.business.phone} onChange={(e) => patchForm({ business: { ...form.business, phone: e.target.value } })} />
                </label>
              </div>
              <label className="block text-sm font-medium">Address / service area
                <input className={fieldClass} value={form.business.address} onChange={(e) => patchForm({ business: { ...form.business, address: e.target.value } })} />
              </label>
              <label className="block text-sm font-medium">Business hours
                <input className={fieldClass} value={form.business.businessHours} onChange={(e) => patchForm({ business: { ...form.business, businessHours: e.target.value } })} />
              </label>
            </div>
          ) : null}

          {sectionId === "goals" ? (
            <div className="space-y-4">
              <h2 className="font-heading text-sm font-semibold text-[var(--client-ink)]">Website goals</h2>
              <p className="text-sm text-[var(--client-muted)]">What should this website accomplish for your business?</p>
              <ChipGroup
                options={DISCOVERY_MAIN_GOAL_OPTIONS}
                selected={form.goals.mainGoals}
                onToggle={(label) => {
                  const list = form.goals.mainGoals;
                  patchForm({
                    goals: {
                      ...form.goals,
                      mainGoals: list.includes(label) ? list.filter((item) => item !== label) : [...list, label],
                    },
                  });
                }}
              />
              {form.goals.mainGoals.includes("Other") ? (
                <input className={fieldClass} placeholder="Other goal" value={form.goals.mainGoalOther} onChange={(e) => patchForm({ goals: { ...form.goals, mainGoalOther: e.target.value } })} />
              ) : null}
              <p className="text-sm font-medium text-[var(--client-ink)]">What should visitors do after visiting?</p>
              <ChipGroup
                options={DISCOVERY_VISITOR_ACTION_OPTIONS}
                selected={form.goals.visitorActions}
                onToggle={(label) => {
                  const list = form.goals.visitorActions;
                  patchForm({
                    goals: {
                      ...form.goals,
                      visitorActions: list.includes(label) ? list.filter((item) => item !== label) : [...list, label],
                    },
                  });
                }}
              />
            </div>
          ) : null}

          {sectionId === "pages" ? (
            <div className="space-y-4">
              <h2 className="font-heading text-sm font-semibold text-[var(--client-ink)]">Sitemap & pages</h2>
              <div className="rounded-lg border border-[var(--client-line)] bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Requested pages</p>
                <ul className="mt-2 space-y-1 text-sm text-[var(--client-ink)]">
                  {scopePages.map((page) => (
                    <li key={page}>✓ {page}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px] text-[var(--client-muted)]">These pages were included in your approved project scope.</p>
              </div>
              <label className="block text-sm font-medium">Page clarifications (optional)
                <textarea rows={4} className={fieldClass} value={form.pages.clarification} onChange={(e) => patchForm({ pages: { ...form.pages, clarification: e.target.value } })} />
              </label>
              <label className="block text-sm font-medium">Additional pages (outside approved scope)
                <input className={fieldClass} placeholder="e.g. Careers page" value={form.pages.additionalPages[0] ?? ""} onChange={(e) => patchForm({ pages: { ...form.pages, additionalPages: e.target.value.trim() ? [e.target.value] : [] } })} />
              </label>
              <p className="text-[12px] text-[var(--client-muted)]">Additional pages are flagged for your project manager — they are not automatically added to your project.</p>
            </div>
          ) : null}

          {sectionId === "content" ? (
            <div className="space-y-4">
              <h2 className="font-heading text-sm font-semibold text-[var(--client-ink)]">Services & content</h2>
              <ServiceEditor
                services={form.services}
                onChange={(services) => patchForm({ services })}
              />
              <div>
                <p className="text-sm font-medium text-[var(--client-ink)]">Upload assets</p>
                <p className="mt-1 text-[12px] text-[var(--client-muted)]">Logos, photos, videos, PDFs, and marketing materials.</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <UploadButton label="Logo" busy={busy === "upload"} onPick={(files) => onUpload("logo", files)} />
                  <UploadButton label="Photos" busy={busy === "upload"} onPick={(files) => onUpload("photo", files)} />
                  <UploadButton label="Documents" busy={busy === "upload"} onPick={(files) => onUpload("document", files)} />
                </div>
                {files.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {files.map((file) => (
                      <li key={file.id} className="flex items-center justify-between gap-2 text-sm">
                        <span>{file.fileName}</span>
                        <button type="button" className="font-heading text-[12px] font-semibold text-[var(--client-blue)] hover:underline" onClick={() => void signedUrlForPath(file.storagePath).then((url) => window.open(url, "_blank"))}>
                          View
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}

          {sectionId === "branding" ? (
            <div className="space-y-4">
              <h2 className="font-heading text-sm font-semibold text-[var(--client-ink)]">Branding & design</h2>
              <label className="block text-sm font-medium">Brand colors
                <input className={fieldClass} value={form.branding.brandColors} onChange={(e) => patchForm({ branding: { ...form.branding, brandColors: e.target.value } })} />
              </label>
              <label className="block text-sm font-medium">Fonts (if known)
                <input className={fieldClass} value={form.branding.brandFonts} onChange={(e) => patchForm({ branding: { ...form.branding, brandFonts: e.target.value } })} />
              </label>
              <label className="block text-sm font-medium">Brand guidelines notes
                <textarea rows={3} className={fieldClass} value={form.branding.brandGuidelinesNotes} onChange={(e) => patchForm({ branding: { ...form.branding, brandGuidelinesNotes: e.target.value } })} />
              </label>
              <p className="text-sm font-medium">Design style preferences</p>
              <ChipGroup
                options={DISCOVERY_WEBSITE_FEEL_OPTIONS}
                selected={form.branding.designStyles}
                onToggle={(label) => {
                  const list = form.branding.designStyles;
                  patchForm({
                    branding: {
                      ...form.branding,
                      designStyles: list.includes(label) ? list.filter((item) => item !== label) : [...list, label],
                    },
                  });
                }}
              />
              <label className="block text-sm font-medium">Websites you like
                <textarea rows={2} className={fieldClass} value={form.branding.likedWebsites} onChange={(e) => patchForm({ branding: { ...form.branding, likedWebsites: e.target.value } })} />
              </label>
              <label className="block text-sm font-medium">Websites you dislike
                <textarea rows={2} className={fieldClass} value={form.branding.dislikedWebsites} onChange={(e) => patchForm({ branding: { ...form.branding, dislikedWebsites: e.target.value } })} />
              </label>
              <label className="block text-sm font-medium">How should your website feel?
                <input className={fieldClass} value={form.branding.websiteFeel} onChange={(e) => patchForm({ branding: { ...form.branding, websiteFeel: e.target.value } })} />
              </label>
            </div>
          ) : null}

          {sectionId === "features" ? (
            <div className="space-y-4">
              <h2 className="font-heading text-sm font-semibold text-[var(--client-ink)]">Website features</h2>
              <div className="rounded-lg border border-[var(--client-line)] bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Included in scope</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {scopeFeatures.length ? scopeFeatures.map((f) => <li key={f}>✓ {f}</li>) : <li className="text-[var(--client-muted)]">No features listed in scope.</li>}
                </ul>
              </div>
              <label className="block text-sm font-medium">Feature clarifications (optional)
                <textarea rows={3} className={fieldClass} value={form.features.clarification} onChange={(e) => patchForm({ features: { ...form.features, clarification: e.target.value } })} />
              </label>
              <p className="text-sm font-medium">Request additional features</p>
              <ChipGroup
                options={featureOptions}
                selected={form.features.requestedFeatures}
                onToggle={(label) => {
                  const inScope = scopeFeatures.some((item) => item.toLowerCase() === label.toLowerCase());
                  if (inScope) return;
                  const list = form.features.requestedFeatures;
                  patchForm({
                    features: {
                      ...form.features,
                      requestedFeatures: list.includes(label) ? list.filter((item) => item !== label) : [...list, label],
                    },
                  });
                }}
              />
              <p className="text-[12px] text-[var(--client-muted)]">Features outside your approved scope are flagged for review — they are not automatically added.</p>
            </div>
          ) : null}

          {sectionId === "domain" ? (
            <div className="space-y-4">
              <h2 className="font-heading text-sm font-semibold text-[var(--client-ink)]">Domain & existing website</h2>
              <p className="text-sm text-[var(--client-muted)]">Do not share passwords here. We never ask for passwords in this form.</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={cn("rounded-lg border px-4 py-2 text-sm font-semibold", form.domain.ownsDomain === true ? "border-[var(--client-blue)] bg-[rgb(0_80_240_/_0.08)]" : "border-[var(--client-line)]")} onClick={() => patchForm({ domain: { ...form.domain, ownsDomain: true } })}>Yes, we own a domain</button>
                <button type="button" className={cn("rounded-lg border px-4 py-2 text-sm font-semibold", form.domain.ownsDomain === false ? "border-[var(--client-blue)] bg-[rgb(0_80_240_/_0.08)]" : "border-[var(--client-line)]")} onClick={() => patchForm({ domain: { ...form.domain, ownsDomain: false } })}>No domain yet</button>
              </div>
              <label className="block text-sm font-medium">Domain name
                <input className={fieldClass} value={form.domain.domainName} onChange={(e) => patchForm({ domain: { ...form.domain, domainName: e.target.value } })} />
              </label>
              <label className="block text-sm font-medium">Existing website URL
                <input className={fieldClass} value={form.domain.existingWebsiteUrl} onChange={(e) => patchForm({ domain: { ...form.domain, existingWebsiteUrl: e.target.value } })} />
              </label>
              <label className="block text-sm font-medium">Hosting provider / platform
                <input className={fieldClass} value={form.domain.hostingProvider} onChange={(e) => patchForm({ domain: { ...form.domain, hostingProvider: e.target.value } })} />
              </label>
            </div>
          ) : null}

          {sectionId === "review" ? (
            <div className="space-y-4">
              <h2 className="font-heading text-sm font-semibold text-[var(--client-ink)]">Review & submit</h2>
              <p className="text-sm text-[var(--client-muted)]">Review your answers, then submit for your project manager.</p>
              <label className="block text-sm font-medium">Anything else our team should know?
                <textarea rows={4} className={fieldClass} value={form.finalNotes} onChange={(e) => patchForm({ finalNotes: e.target.value })} />
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--client-line)] pt-4">
            <button
              type="button"
              disabled={step === 0}
              className="inline-flex h-10 items-center rounded-lg border border-[var(--client-line)] px-4 font-heading text-sm font-semibold disabled:opacity-40"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              Back
            </button>
            <div className="flex flex-wrap gap-2">
              {editable ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  className="inline-flex h-10 items-center rounded-lg border border-[var(--client-line)] px-4 font-heading text-sm font-semibold"
                  onClick={() => void persist(false)}
                >
                  {busy === "draft" ? "Saving…" : "Save progress"}
                </button>
              ) : null}
              {step < DISCOVERY_SECTIONS.length - 1 ? (
                <button type="button" className="inline-flex h-10 items-center rounded-lg bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white" onClick={() => setStep((current) => Math.min(DISCOVERY_SECTIONS.length - 1, current + 1))}>
                  Continue
                </button>
              ) : editable ? (
                <button type="submit" disabled={busy !== null} className="inline-flex h-10 items-center rounded-lg bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60">
                  {busy === "submit" ? "Submitting…" : "Submit discovery"}
                </button>
              ) : null}
            </div>
          </div>
        </fieldset>
        </form>
      )}

      <ClientConfirmDialog
        open={blocker.state === "blocked"}
        title="Unsaved changes"
        body="You have unsaved changes. Save your progress before leaving?"
        confirmLabel="Leave without saving"
        cancelLabel="Stay"
        onConfirm={blocker.proceed}
        onCancel={blocker.reset}
      />
    </div>
  );
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[] | string[];
  selected: string[];
  onToggle: (label: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((label) => {
        const active = selected.includes(label);
        return (
          <button
            key={label}
            type="button"
            onClick={() => onToggle(label)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-semibold",
              active ? "border-[var(--client-blue)] bg-[rgb(0_80_240_/_0.08)] text-[var(--client-ink)]" : "border-[var(--client-line)] text-[var(--client-muted)]",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ServiceEditor({
  services,
  onChange,
}: {
  services: DiscoveryServiceEntry[];
  onChange: (services: DiscoveryServiceEntry[]) => void;
}) {
  function addService() {
    onChange([
      ...services,
      {
        id: crypto.randomUUID(),
        name: "",
        shortDescription: "",
        detailedDescription: "",
        pricing: "",
        provideLater: false,
      },
    ]);
  }

  return (
    <div className="space-y-4">
      {services.map((service, index) => (
        <div key={service.id} className="rounded-lg border border-[var(--client-line)] p-4 space-y-3">
          <label className="block text-sm font-medium">Service name
            <input className={fieldClass} value={service.name} onChange={(e) => onChange(services.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} />
          </label>
          <label className="block text-sm font-medium">Short description
            <textarea rows={2} className={fieldClass} value={service.shortDescription} onChange={(e) => onChange(services.map((item, i) => i === index ? { ...item, shortDescription: e.target.value } : item))} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={service.provideLater} onChange={(e) => onChange(services.map((item, i) => i === index ? { ...item, provideLater: e.target.checked } : item))} />
            We&apos;ll provide this later
          </label>
        </div>
      ))}
      <button type="button" className="font-heading text-sm font-semibold text-[var(--client-blue)] hover:underline" onClick={addService}>
        + Add service
      </button>
    </div>
  );
}

function UploadButton({
  label,
  busy,
  onPick,
}: {
  label: string;
  busy: boolean;
  onPick: (files: FileList | null) => void;
}) {
  return (
    <label className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-[var(--client-line)] px-4 font-heading text-[12px] font-semibold hover:bg-[var(--client-hover)]">
      {busy ? "Uploading…" : label}
      <input type="file" className="hidden" onChange={(e) => onPick(e.target.files)} />
    </label>
  );
}
