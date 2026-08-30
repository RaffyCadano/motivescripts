import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { adminPrimaryBtn, adminGhostBtn } from "@/components/admin/adminActionStyles";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { ContractDocumentView } from "@/components/documents/ContractDocumentView";
import { ContractDraftForm, emptyContractDraft, type ContractDraftFormValue } from "@/components/documents/ContractDraftForm";
import { UnsavedChangesDialog, useUnsavedNavigation } from "@/components/documents/UnsavedChangesDialog";
import {
  calendarDateOrNull,
  DEFAULT_CONTRACT_VALID_DAYS,
  defaultProposalValidUntil,
  documentMailRecipientCopy,
  documentMailRecipients,
  websiteContractTemplate,
} from "@/data/documents";
import {
  createContract,
  fetchContractDetail,
  fetchProposalDetail,
  fetchProposalSummaries,
  saveContractDraft,
  sendContract,
} from "@/data/documentsRepository";
import { formatUsdFromCents } from "@/data/money";
import { fetchAgencySettings } from "@/data/settingsRepository";
import { isoCalendarDate } from "@/data/invoices";
import { AgencyDbError } from "@/lib/dbErrors";

const selectClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]";

function formKey(value: ContractDraftFormValue) {
  return JSON.stringify(value);
}

export function AdminContractNew() {
  const { clients, projects, notify, portalAccounts } = useLeads();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetClient = searchParams.get("client") ?? "";
  const presetProject = searchParams.get("project") ?? "";
  const presetProposal = searchParams.get("proposal") ?? "";
  const lockedClient = Boolean(presetClient) && (clients.length === 0 || clients.some((client) => client.id === presetClient));
  const [clientId, setClientId] = useState(presetClient);
  const [projectId, setProjectId] = useState(presetProject);
  const [proposalId, setProposalId] = useState(presetProposal);
  const [accepted, setAccepted] = useState<{ id: string; number: string; clientId: string; projectId: string | null }[]>([]);
  const [form, setForm] = useState<ContractDraftFormValue>(emptyContractDraft);
  const [baseline, setBaseline] = useState(formKey(emptyContractDraft()));
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const dirty = edited && formKey(form) !== baseline;
  const blocker = useUnsavedNavigation(dirty);

  useEffect(() => {
    void fetchProposalSummaries().then((rows) => {
      setAccepted(
        rows
          .filter((row) => row.effectiveStatus === "accepted")
          .map((row) => ({ id: row.id, number: row.number, clientId: row.clientId, projectId: row.projectId })),
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
  const mailRecipients = documentMailRecipients(
    client?.email,
    portalAccounts.filter((account) => account.clientId === clientId).map((account) => account.email),
  );

  async function persist() {
    if (!clientId) {
      notify("Select a client first.");
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
      <Link to="/admin/contracts" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Contracts
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">New contract</h1>
        {clients.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className={adminGhostBtn} onClick={() => void onSaveDraft()}>
              {busy ? "Saving…" : "Save draft"}
            </button>
            <button type="button" disabled={busy} className={adminPrimaryBtn} onClick={() => setSendOpen(true)}>
              Send Contract
            </button>
          </div>
        ) : null}
      </div>
      <p className="max-w-xl text-sm text-[var(--admin-muted)]">
        Nothing is saved until you click Save draft or Keep changes. Prefer an accepted proposal so the scope and
        investment stay connected.
      </p>
      {clients.length === 0 ? (
        <p className="text-sm text-[var(--admin-muted)]">Add a client before creating a contract.</p>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <form className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
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
              Accepted proposal
              <select
                disabled={busy}
                value={proposalId}
                onChange={(event) => setProposalId(event.target.value)}
                className={selectClass}
              >
                <option value="">None</option>
                {clientProposals.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.number}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Project <span className="font-medium text-[var(--admin-muted)]">(optional)</span>
              <select
                disabled={busy}
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className={selectClass}
              >
                <option value="">No project yet</option>
                {clientProjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <ContractDraftForm
              value={form}
              disabled={busy || !clientId}
              onChange={(next) => {
                setEdited(true);
                setForm(next);
              }}
            />
          </form>
          <ContractDocumentView
            document={{
              number: "MS-CON-DRAFT",
              revisionNumber: 1,
              companyName: client?.businessName || "—",
              contactName: client?.contactName,
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
      )}
      <ConfirmDocumentModal
        open={sendOpen}
        busy={busy}
        title="Send this contract to the client?"
        description={`${documentMailRecipientCopy(mailRecipients, { companyName: client?.businessName, action: "send" })} They’ll review this revision in the client portal and can accept it electronically. This is not a qualified digital signature.`}
        actionLabel="Send Contract"
        onClose={() => setSendOpen(false)}
        onConfirm={async () => {
          if (busy) return;
          setBusy(true);
          try {
            const id = await persist();
            if (!id) {
              setBusy(false);
              return;
            }
            const result = await sendContract(id);
            notify(result.emailed ? "Contract sent." : "Contract sent. The email could not be delivered.");
            setSendOpen(false);
            navigate(`/admin/contracts/${id}`);
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to send this contract.");
            setBusy(false);
          }
        }}
      />
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
          ? `Investment: ${formatUsdFromCents(source.investment_cents)}`
          : next.compensation,
      };
    }
  }

  return next;
}
