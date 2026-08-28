import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { LineItemsEditor } from "@/components/documents/LineItemsEditor";
import { ProposalDocumentView } from "@/components/documents/ProposalDocumentView";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { effectiveDocumentStatus, lineItemsTotalCents, type LineItemDraft } from "@/data/documents";
import {
  cancelProposal,
  createContract,
  createProposalRevision,
  downloadProposalPdf,
  fetchProposalDetail,
  proposalLineDrafts,
  saveProposalDraft,
  sendProposal,
  type ProposalDetail,
} from "@/data/documentsRepository";
import { formatUsdFromCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)] disabled:bg-[var(--admin-bg)]";

export function AdminProposalDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, projects, notify, reload } = useLeads();
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    introduction: "",
    overview: "",
    scope: "",
    deliverablesText: "",
    timeline: "",
    paymentTerms: "",
    terms: "",
    notes: "",
    validUntil: "",
    adminNotes: "",
  });
  const [items, setItems] = useState<LineItemDraft[]>([]);

  async function load() {
    if (!id) return;
    const next = await fetchProposalDetail(id);
    setDetail(next);
    if (next) {
      setForm({
        title: next.working.title,
        introduction: next.working.introduction,
        overview: next.working.overview,
        scope: next.working.scope,
        deliverablesText: next.working.deliverables_text,
        timeline: next.working.timeline,
        paymentTerms: next.working.payment_terms,
        terms: next.working.terms,
        notes: next.working.notes,
        validUntil: next.working.valid_until ?? "",
        adminNotes: next.adminNotes,
      });
      setItems(proposalLineDrafts(next));
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    void load()
      .catch((error) => notify(error instanceof AgencyDbError ? error.message : "Unable to load this proposal."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />;
  }
  if (!detail || !id) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-semibold">Proposal not found</h1>
        <Link to="/admin/proposals" className="mt-3 inline-flex text-sm font-semibold text-[var(--admin-blue)]">
          Back to proposals
        </Link>
      </div>
    );
  }

  const client = clients.find((item) => item.id === detail.proposal.client_id);
  const project = projects.find((item) => item.id === detail.proposal.project_id);
  const isDraft = detail.working.status === "draft";
  const status = effectiveDocumentStatus(detail.working.status, detail.working.valid_until);
  const publishedStatus = detail.published
    ? effectiveDocumentStatus(detail.published.status, detail.published.valid_until)
    : null;
  const current = detail;

  async function persist() {
    if (!isDraft) return;
    await saveProposalDraft({
      revisionId: current.working.id,
      ...form,
      validUntil: form.validUntil || null,
      items,
      adminNotes: form.adminNotes,
    });
  }

  async function onSave() {
    setBusy(true);
    try {
      await persist();
      notify("Proposal saved.");
      await load();
      await reload();
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to save this proposal.");
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    setBusy(true);
    try {
      await persist();
      const result = await sendProposal(current.proposal.id);
      notify(result.emailed ? "Proposal sent." : "Proposal sent. The email could not be delivered.");
      setSendOpen(false);
      await load();
      await reload();
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to send this proposal.");
    } finally {
      setBusy(false);
    }
  }

  const previewItems = isDraft
    ? items
        .filter((item) => item.name.trim())
        .map((item, index) => ({
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: item.unitPriceCents,
          total_cents: item.quantity * item.unitPriceCents,
          sort_order: index,
        }))
    : detail.snapshotItems;

  return (
    <div className="space-y-6">
      <Link to="/admin/proposals" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Proposals
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">{detail.proposal.proposal_number}</h1>
            <DocumentStatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            {client?.businessName ?? "Client"} · Revision {detail.working.revision_number}
            {project ? ` · ${project.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || pdfBusy}
            className={secondaryBtn}
            onClick={async () => {
              setPdfBusy(true);
              try {
                await downloadProposalPdf(current.proposal.id);
              } catch (error) {
                notify(error instanceof AgencyDbError ? error.message : "Unable to generate the proposal PDF. Please try again.");
              } finally {
                setPdfBusy(false);
              }
            }}
          >
            {pdfBusy ? "Generating PDF..." : "Download PDF"}
          </button>
          {isDraft ? (
            <>
              <button type="button" disabled={busy} className={secondaryBtn} onClick={() => void onSave()}>
                {busy ? "Saving…" : "Save draft"}
              </button>
              <button type="button" disabled={busy} className={primaryBtn} onClick={() => setSendOpen(true)}>
                Send Proposal
              </button>
            </>
          ) : null}
          {publishedStatus === "accepted" && !project ? (
            <Link
              to={`/admin/clients/${detail.proposal.client_id}`}
              className={`${secondaryBtn} hover:bg-[var(--admin-bg)]`}
            >
              Create project
            </Link>
          ) : null}
          {publishedStatus === "accepted" ? (
            <button
              type="button"
              disabled={busy}
              className={primaryBtn}
              onClick={async () => {
                setBusy(true);
                try {
                  const contractId = await createContract({
                    clientId: current.proposal.client_id,
                    projectId: current.proposal.project_id,
                    proposalId: current.proposal.id,
                  });
                  notify("Contract created.");
                  navigate(`/admin/contracts/${contractId}`);
                } catch (error) {
                  notify(error instanceof AgencyDbError ? error.message : "Unable to create a contract.");
                  setBusy(false);
                }
              }}
            >
              Create Contract
            </button>
          ) : null}
          {!isDraft && status !== "accepted" && status !== "cancelled" ? (
            <button
              type="button"
              disabled={busy}
              className={secondaryBtn}
              onClick={async () => {
                setBusy(true);
                try {
                  await createProposalRevision(current.proposal.id);
                  notify("New revision created.");
                  await load();
                } catch (error) {
                  notify(error instanceof AgencyDbError ? error.message : "Unable to create a revision.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              New revision
            </button>
          ) : null}
          {status !== "accepted" && status !== "cancelled" ? (
            <button type="button" disabled={busy} className={secondaryBtn} onClick={() => setCancelOpen(true)}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <form className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold">Proposal content</h2>
          <Field label="Title" value={form.title} disabled={!isDraft} onChange={(value) => setForm({ ...form, title: value })} />
          <Area label="Introduction" value={form.introduction} disabled={!isDraft} onChange={(value) => setForm({ ...form, introduction: value })} />
          <Area label="Project overview" value={form.overview} disabled={!isDraft} onChange={(value) => setForm({ ...form, overview: value })} />
          <Area label="Scope of work" value={form.scope} disabled={!isDraft} onChange={(value) => setForm({ ...form, scope: value })} />
          <Area label="Deliverables" value={form.deliverablesText} disabled={!isDraft} onChange={(value) => setForm({ ...form, deliverablesText: value })} />
          <Area label="Timeline" value={form.timeline} disabled={!isDraft} onChange={(value) => setForm({ ...form, timeline: value })} />
          <div>
            <p className="text-sm font-semibold">Line items</p>
            <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Totals are calculated from quantity × unit price in cents.</p>
            <div className="mt-3">
              <LineItemsEditor items={items} disabled={!isDraft} onChange={setItems} />
            </div>
          </div>
          <Area label="Payment terms" value={form.paymentTerms} disabled={!isDraft} onChange={(value) => setForm({ ...form, paymentTerms: value })} />
          <Area label="Terms & conditions" value={form.terms} disabled={!isDraft} onChange={(value) => setForm({ ...form, terms: value })} />
          <Area label="Notes" value={form.notes} disabled={!isDraft} onChange={(value) => setForm({ ...form, notes: value })} />
          <label className="block text-sm font-semibold">
            Valid until
            <input
              type="date"
              disabled={!isDraft}
              value={form.validUntil}
              onChange={(event) => setForm({ ...form, validUntil: event.target.value })}
              className={fieldClass}
            />
          </label>
          <Area
            label="Internal notes (not shown to the client)"
            value={form.adminNotes}
            disabled={!isDraft}
            onChange={(value) => setForm({ ...form, adminNotes: value })}
          />
          <p className="text-sm text-[var(--admin-muted)]">
            Calculated investment {formatUsdFromCents(isDraft ? lineItemsTotalCents(items) : detail.working.investment_cents)}
          </p>
        </form>

        <ProposalDocumentView
          document={{
            number: detail.proposal.proposal_number,
            title: form.title,
            revisionNumber: detail.working.revision_number,
            companyName: client?.businessName ?? "Client",
            introduction: form.introduction,
            overview: form.overview,
            scope: form.scope,
            deliverables: form.deliverablesText,
            timeline: form.timeline,
            paymentTerms: form.paymentTerms,
            terms: form.terms,
            notes: form.notes,
            validUntil: form.validUntil || null,
            items: previewItems,
            investmentCents: isDraft ? lineItemsTotalCents(items) : detail.working.investment_cents,
          }}
        />
      </div>

      <ConfirmDocumentModal
        open={sendOpen}
        busy={busy}
        title="Send this proposal to the client?"
        description="They’ll be able to review the exact version you’re sending. After it’s sent, this revision can’t be silently edited."
        actionLabel="Send Proposal"
        onClose={() => setSendOpen(false)}
        onConfirm={() => void onSend()}
      />
      <ConfirmDocumentModal
        open={cancelOpen}
        busy={busy}
        title="Cancel this proposal?"
        description="The client will no longer be able to accept this revision."
        actionLabel="Cancel proposal"
        onClose={() => setCancelOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await cancelProposal(current.proposal.id);
            notify("Proposal cancelled.");
            setCancelOpen(false);
            await load();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to cancel this proposal.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function Field({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={fieldClass} />
    </label>
  );
}

function Area({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <textarea value={value} disabled={disabled} rows={4} onChange={(event) => onChange(event.target.value)} className={fieldClass} />
    </label>
  );
}

const primaryBtn =
  "inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60";
const secondaryBtn =
  "inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-4 font-heading text-sm font-semibold disabled:opacity-60";
