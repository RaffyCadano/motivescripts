import { useEffect, useMemo, useState } from "react";
import { Eye, Save, Send } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { NeedClientEmpty } from "@/components/admin/NeedClientEmpty";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { ContractDocumentView } from "@/components/documents/ContractDocumentView";
import {
  ContractDraftForm,
  emptyContractDraft,
  type ContractDraftFormValue,
  type ContractProposalRef,
} from "@/components/documents/ContractDraftForm";
import { UnsavedChangesDialog, useUnsavedNavigation } from "@/components/documents/UnsavedChangesDialog";
import {
  calendarDateOrNull,
  DEFAULT_CONTRACT_VALID_DAYS,
  defaultProposalValidUntil,
  websiteContractTemplate,
} from "@/data/documents";
import {
  createContract,
  fetchContractDetail,
  fetchProposalDetail,
  fetchProposalSummaries,
  saveContractDraft,
} from "@/data/documentsRepository";
import { formatUsdFromCents } from "@/data/money";
import { fetchAgencySettings } from "@/data/settingsRepository";
import { isoCalendarDate } from "@/data/invoices";
import { AgencyDbError } from "@/lib/dbErrors";

const selectClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)] disabled:bg-[var(--admin-bg)]";

const fieldClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)] disabled:bg-[var(--admin-bg)]";

function formKey(value: ContractDraftFormValue) {
  return JSON.stringify(value);
}

function scrollToContractPreview() {
  const preview = document.getElementById("contract-preview");
  const scroller = document.getElementById("admin-main");
  if (!preview) return;
  const sideBySide = window.matchMedia("(min-width: 1280px)").matches;
  if (!sideBySide && scroller) {
    const previewRect = preview.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const top = scroller.scrollTop + previewRect.top - scrollerRect.top - 12;
    scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }
  preview.classList.add("ring-2", "ring-[var(--admin-blue)]", "ring-offset-2");
  window.setTimeout(() => {
    preview.classList.remove("ring-2", "ring-[var(--admin-blue)]", "ring-offset-2");
  }, 1400);
}

export function AdminContractNew() {
  const { clients, projects, notify } = useLeads();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetClient = searchParams.get("client") ?? "";
  const presetProject = searchParams.get("project") ?? "";
  const presetProposal = searchParams.get("proposal") ?? "";
  const fromProposal = Boolean(presetProposal);
  const lockedClient =
    fromProposal ||
    (Boolean(presetClient) && (clients.length === 0 || clients.some((client) => client.id === presetClient)));
  const [clientId, setClientId] = useState(presetClient);
  const [projectId, setProjectId] = useState(presetProject);
  const [proposalId, setProposalId] = useState(presetProposal);
  const [accepted, setAccepted] = useState<
    { id: string; number: string; clientId: string; projectId: string | null; revisionNumber: number; investmentCents: number }[]
  >([]);
  const [form, setForm] = useState<ContractDraftFormValue>(emptyContractDraft);
  const [baseline, setBaseline] = useState(formKey(emptyContractDraft()));
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = edited && formKey(form) !== baseline;
  const blocker = useUnsavedNavigation(dirty);

  useEffect(() => {
    void fetchProposalSummaries().then((rows) => {
      setAccepted(
        rows
          .filter((row) => row.effectiveStatus === "accepted")
          .map((row) => ({
            id: row.id,
            number: row.number,
            clientId: row.clientId,
            projectId: row.projectId,
            revisionNumber: row.revisionNumber,
            investmentCents: row.investmentCents,
          })),
      );
    });
  }, []);

  useEffect(() => {
    if (!presetProposal) return;
    const match = accepted.find((row) => row.id === presetProposal);
    if (!match) return;
    setClientId(match.clientId);
    setProposalId(match.id);
    setProjectId((current) => current || match.projectId || "");
  }, [accepted, presetProposal]);

  useEffect(() => {
    if (edited) return;
    let active = true;
    const companyName = clients.find((item) => item.id === clientId)?.businessName ?? "";
    void seedDraft(clientId, companyName, proposalId)
      .then((next) => {
        if (!active) return;
        setForm(next);
        setBaseline(formKey(next));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [clientId, clients, edited, proposalId]);

  const clientProjects = projects.filter((project) => project.clientId === clientId && !project.archived);
  const clientProposals = useMemo(
    () => accepted.filter((row) => row.clientId === clientId),
    [accepted, clientId],
  );
  const client = clients.find((item) => item.id === clientId);
  const selectedProject = projects.find((item) => item.id === projectId);
  const selectedProposal = accepted.find((row) => row.id === proposalId) ?? null;
  const proposalRef: ContractProposalRef | null = selectedProposal
    ? {
        id: selectedProposal.id,
        number: selectedProposal.number,
        revisionNumber: selectedProposal.revisionNumber,
        investmentCents: selectedProposal.investmentCents,
      }
    : null;
  const mismatch = Boolean(
    selectedProposal &&
      (selectedProposal.clientId !== clientId ||
        (selectedProposal.projectId && projectId && selectedProposal.projectId !== projectId)),
  );

  async function persist() {
    if (!clientId) {
      notify("Select a client first.");
      return null;
    }
    if (mismatch) {
      notify("The selected proposal belongs to a different client or project. Match them before saving.");
      return null;
    }
    const id = await createContract({
      clientId,
      projectId: projectId || null,
      proposalId: proposalId || null,
      title: form.title,
    });
    const detail = await fetchContractDetail(id);
    if (detail) {
      await saveContractDraft({
        revisionId: detail.working.id,
        ...form,
        effectiveDate: calendarDateOrNull(form.effectiveDate),
        expiresAt: calendarDateOrNull(form.expiresAt) || defaultProposalValidUntil(undefined, DEFAULT_CONTRACT_VALID_DAYS),
      });
    }
    setBaseline(formKey(form));
    return id;
  }

  async function onSaveDraft() {
    if (busy) return;
    setBusy(true);
    try {
      const id = await persist();
      if (!id) {
        setBusy(false);
        return;
      }
      notify("Contract saved as a draft.");
      navigate(`/admin/contracts/${id}`);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to save this contract.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Link to="/admin/contracts" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
          Contracts
        </Link>
        {fromProposal && presetProposal ? (
          <Link
            to={`/admin/proposals/${presetProposal}`}
            className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline"
          >
            Proposal
          </Link>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">
            {fromProposal ? "Contract Setup" : "New contract"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
            {fromProposal
              ? "This contract is based on the accepted proposal. Scope, investment, and project details are carried forward so the agreement stays connected to the approved proposal."
              : "Nothing is saved until you click Save Draft or Keep changes. Prefer an accepted proposal so the scope and investment stay connected."}
          </p>
        </div>
        {clients.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className={adminGhostBtn} onClick={() => void onSaveDraft()}>
              <Save className="mr-2 h-4 w-4" />
              {busy ? "Saving…" : "Save Draft"}
            </button>
            <button type="button" className={adminGhostBtn} onClick={scrollToContractPreview}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </button>
            <button
              type="button"
              disabled
              title="Agency signature required before sending."
              className={adminPrimaryBtn}
            >
              <Send className="mr-2 h-4 w-4" />
              Send Contract
            </button>
          </div>
        ) : null}
      </div>
      {clients.length > 0 ? (
        <p className="text-sm text-[var(--admin-muted)]">
          Agency signature required before sending. Save the draft, then sign as MotiveScripts on the contract page.
        </p>
      ) : null}
      {clients.length === 0 ? (
        <NeedClientEmpty document="contract" />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="space-y-6">
            <section className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
              <div>
                <h2 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Contract Setup</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">
                  {fromProposal
                    ? "Client, project, and proposal are locked to the accepted proposal so this agreement is not created for the wrong account."
                    : "Link an accepted proposal when you can so scope and investment stay aligned."}
                </p>
              </div>
              {mismatch ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                  The selected proposal belongs to a different client or project. Match them before saving so this
                  contract is not created for the wrong work.
                </p>
              ) : null}
              <label className="block text-sm font-semibold">
                Client
                <select
                  required
                  disabled={lockedClient || busy}
                  value={clientId}
                  onChange={(event) => {
                    setClientId(event.target.value);
                    setProjectId("");
                    setProposalId("");
                  }}
                  className={selectClass}
                >
                  <option value="">Select a client</option>
                  {clients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.businessName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Project {fromProposal ? null : <span className="font-medium text-[var(--admin-muted)]">(optional)</span>}
                <select
                  disabled={fromProposal || busy}
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className={selectClass}
                >
                  {fromProposal ? null : <option value="">No project yet</option>}
                  {(fromProposal
                    ? projects.filter((item) => item.id === projectId || item.id === presetProject)
                    : clientProjects
                  ).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                {fromProposal ? "Based on accepted proposal" : "Accepted proposal"}
                <select
                  disabled={fromProposal || busy}
                  value={proposalId}
                  onChange={(event) => setProposalId(event.target.value)}
                  className={selectClass}
                >
                  {fromProposal ? null : <option value="">None</option>}
                  {(fromProposal ? accepted.filter((row) => row.id === presetProposal) : clientProposals).map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.number}
                      {row.revisionNumber ? ` · Revision ${row.revisionNumber}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {selectedProposal ? (
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-[12px] text-[var(--admin-muted)]">Based on accepted proposal</dt>
                    <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                      {selectedProposal.number}
                      {selectedProposal.revisionNumber ? ` · Revision ${selectedProposal.revisionNumber}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[12px] text-[var(--admin-muted)]">Investment</dt>
                    <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                      {formatUsdFromCents(selectedProposal.investmentCents)}
                    </dd>
                  </div>
                </dl>
              ) : null}
              <label className="block text-sm font-semibold">
                Contract title
                <input
                  value={form.title}
                  disabled={busy || !clientId}
                  onChange={(event) => {
                    setEdited(true);
                    setForm({ ...form, title: event.target.value });
                  }}
                  className={fieldClass}
                />
              </label>
            </section>
            <ContractDraftForm
              value={form}
              disabled={busy || !clientId}
              includeTitle={false}
              proposal={proposalRef}
              onChange={(next) => {
                setEdited(true);
                setForm(next);
              }}
            />
          </div>
          <div id="contract-preview" className="rounded-[var(--admin-radius)] transition-shadow xl:sticky xl:top-4">
            <p className="mb-3 font-heading text-sm font-semibold text-[var(--admin-ink)]">Client preview</p>
            <p className="mb-4 text-[12px] leading-5 text-[var(--admin-muted)]">
              This is what the client sees. Internal notes and editing controls are not included.
            </p>
            <ContractDocumentView
              document={{
                number: "MS-CON-DRAFT",
                revisionNumber: 1,
                companyName: client?.businessName || "—",
                contactName: client?.contactName,
                projectName: selectedProject?.name,
                proposalNumber: selectedProposal?.number,
                investmentCents: selectedProposal?.investmentCents,
                revision: {
                  title: form.title,
                  parties: form.parties,
                  scope: form.scope,
                  responsibilities: form.responsibilities,
                  timeline: form.timeline,
                  compensation: form.compensation,
                  payment_terms: form.paymentTerms,
                  confidentiality: form.confidentiality,
                  intellectual_property: form.intellectualProperty,
                  revisions_policy: form.revisionsPolicy,
                  termination: form.termination,
                  general_terms: form.generalTerms,
                  effective_date: calendarDateOrNull(form.effectiveDate),
                  expires_at: calendarDateOrNull(form.expiresAt),
                },
              }}
            />
          </div>
        </div>
      )}
      <UnsavedChangesDialog
        open={blocker.state === "blocked"}
        busy={busy}
        description="This contract is not saved as a draft yet. Keep your changes, keep editing, or leave without saving."
        onKeepEditing={() => blocker.reset?.()}
        onDiscard={() => blocker.proceed?.()}
        onKeepChanges={async () => {
          if (busy) return;
          setBusy(true);
          try {
            const id = await persist();
            if (!id) {
              setBusy(false);
              return;
            }
            notify("Contract saved as a draft.");
            blocker.proceed?.();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to save this contract.");
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

async function seedDraft(clientId: string, companyName: string, proposalId: string): Promise<ContractDraftFormValue> {
  if (!clientId) return emptyContractDraft();
  const tmpl = websiteContractTemplate(companyName);
  let next: ContractDraftFormValue = {
    ...emptyContractDraft(),
    ...tmpl,
    effectiveDate: isoCalendarDate(),
    expiresAt: defaultProposalValidUntil(undefined, DEFAULT_CONTRACT_VALID_DAYS),
  };

  const settings = await fetchAgencySettings().catch(() => null);
  if (settings?.defaultContractTerms.trim()) {
    next = { ...next, generalTerms: settings.defaultContractTerms.trim() };
  }

  if (proposalId) {
    const detail = await fetchProposalDetail(proposalId).catch(() => null);
    const source = detail?.published ?? detail?.working;
    if (source) {
      next = {
        ...next,
        scope: source.scope.trim() || next.scope,
        timeline: source.timeline.trim() || next.timeline,
        paymentTerms: source.payment_terms.trim() || next.paymentTerms,
        compensation: source.investment_cents
          ? `Total Project Investment: ${formatUsdFromCents(source.investment_cents)}`
          : next.compensation,
      };
    }
  }

  return next;
}
