import {
  documentErrorMessage,
  draftsFromItems,
  effectiveDocumentStatus,
  itemsFromSnapshot,
  rpcErrorCode,
  type LineItemDraft,
  type SnapshotItem,
} from "@/data/documents";
import { downloadAuthenticatedPdf } from "@/data/pdfDownload";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  ContractAdminNoteRow,
  ContractRevisionRow,
  ContractRow,
  DocumentStatus,
  ProposalAdminNoteRow,
  ProposalItemRow,
  ProposalRevisionRow,
  ProposalRow,
} from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type ProposalSummary = {
  id: string;
  clientId: string;
  projectId: string | null;
  number: string;
  title: string;
  status: DocumentStatus;
  effectiveStatus: DocumentStatus;
  investmentCents: number;
  revisionNumber: number;
  createdAt: string;
  validUntil: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
};

export type ContractSummary = {
  id: string;
  clientId: string;
  projectId: string | null;
  proposalId: string | null;
  number: string;
  title: string;
  status: DocumentStatus;
  effectiveStatus: DocumentStatus;
  revisionNumber: number;
  createdAt: string;
  effectiveDate: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
};

export type ProposalDetail = {
  proposal: ProposalRow;
  working: ProposalRevisionRow;
  published: ProposalRevisionRow | null;
  items: ProposalItemRow[];
  snapshotItems: SnapshotItem[];
  adminNotes: string;
};

export type ContractDetail = {
  contract: ContractRow;
  working: ContractRevisionRow;
  published: ContractRevisionRow | null;
  adminNotes: string;
};

function db(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new AgencyDbError("Supabase is not configured.");
  }
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  throw new AgencyDbError(documentErrorMessage(rpcErrorCode(message)) || friendlyDbError(error, fallback), error);
}

function throwIf(error: unknown, context: string, fallback: string) {
  if (error) fail(context, error, fallback);
}

function firstId(data: string | string[] | null | undefined): string | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function toProposalSummary(proposal: ProposalRow, revision: ProposalRevisionRow): ProposalSummary {
  const status = revision.status;
  return {
    id: proposal.id,
    clientId: proposal.client_id,
    projectId: proposal.project_id,
    number: proposal.proposal_number,
    title: revision.title,
    status,
    effectiveStatus: effectiveDocumentStatus(status, revision.valid_until),
    investmentCents: revision.investment_cents,
    revisionNumber: revision.revision_number,
    createdAt: proposal.created_at,
    validUntil: revision.valid_until,
    sentAt: revision.sent_at,
    acceptedAt: revision.accepted_at,
  };
}

function toContractSummary(contract: ContractRow, revision: ContractRevisionRow): ContractSummary {
  const status = revision.status;
  return {
    id: contract.id,
    clientId: contract.client_id,
    projectId: contract.project_id,
    proposalId: contract.proposal_id,
    number: contract.contract_number,
    title: revision.title,
    status,
    effectiveStatus: effectiveDocumentStatus(status, revision.expires_at),
    revisionNumber: revision.revision_number,
    createdAt: contract.created_at,
    effectiveDate: revision.effective_date,
    expiresAt: revision.expires_at,
    sentAt: revision.sent_at,
    acceptedAt: revision.accepted_at,
  };
}

export async function fetchProposalSummaries(clientId?: string): Promise<ProposalSummary[]> {
  const client = db();
  let query = client.from("proposals").select("*").order("created_at", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  throwIf(error, "load proposals", "Unable to load proposals.");
  const rows = (data ?? []) as ProposalRow[];
  if (rows.length === 0) return [];
  const revisionIds = [
    ...new Set(rows.flatMap((row) => [row.working_revision_id, row.published_revision_id].filter(Boolean) as string[])),
  ];
  const { data: revisions, error: revError } = await client.from("proposal_revisions").select("*").in("id", revisionIds);
  throwIf(revError, "load proposals", "Unable to load proposals.");
  const byId = new Map(((revisions ?? []) as ProposalRevisionRow[]).map((row) => [row.id, row]));
  return rows
    .map((row) => {
      const revision =
        (row.working_revision_id ? byId.get(row.working_revision_id) : undefined) ??
        (row.published_revision_id ? byId.get(row.published_revision_id) : undefined);
      return revision ? toProposalSummary(row, revision) : null;
    })
    .filter((row): row is ProposalSummary => Boolean(row));
}

export async function fetchClientProposalSummaries(): Promise<ProposalSummary[]> {
  const client = db();
  const { data, error } = await client.from("proposals").select("*").order("created_at", { ascending: false });
  throwIf(error, "load proposals", "Unable to load proposals.");
  const rows = (data ?? []) as ProposalRow[];
  const ids = rows.map((row) => row.published_revision_id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];
  const { data: revisions, error: revError } = await client.from("proposal_revisions").select("*").in("id", ids);
  throwIf(revError, "load proposals", "Unable to load proposals.");
  const byId = new Map(((revisions ?? []) as ProposalRevisionRow[]).map((row) => [row.id, row]));
  return rows
    .map((row) => {
      const revision = row.published_revision_id ? byId.get(row.published_revision_id) : undefined;
      return revision ? toProposalSummary(row, revision) : null;
    })
    .filter((row): row is ProposalSummary => Boolean(row));
}

export async function fetchProposalDetail(id: string): Promise<ProposalDetail | null> {
  const client = db();
  const { data, error } = await client.from("proposals").select("*").eq("id", id).maybeSingle();
  throwIf(error, "load proposal", "Unable to load this proposal.");
  if (!data) return null;
  const proposal = data as ProposalRow;
  const revisionIds = [proposal.working_revision_id, proposal.published_revision_id].filter(Boolean) as string[];
  const { data: revisions, error: revError } = await client.from("proposal_revisions").select("*").in("id", revisionIds);
  throwIf(revError, "load proposal", "Unable to load this proposal.");
  const list = (revisions ?? []) as ProposalRevisionRow[];
  const working = list.find((row) => row.id === proposal.working_revision_id) ?? list[0];
  if (!working) return null;
  const published = proposal.published_revision_id
    ? list.find((row) => row.id === proposal.published_revision_id) ?? null
    : null;
  const { data: items, error: itemError } = await client
    .from("proposal_items")
    .select("*")
    .eq("revision_id", working.id)
    .order("sort_order", { ascending: true });
  if (itemError && !String(itemError.message).toLowerCase().includes("row-level security")) {
    throwIf(itemError, "load proposal", "Unable to load this proposal.");
  }
  const { data: notes } = await client.from("proposal_admin_notes").select("*").eq("revision_id", working.id).maybeSingle();
  return {
    proposal,
    working,
    published,
    items: ((items ?? []) as ProposalItemRow[]) ?? [],
    snapshotItems: itemsFromSnapshot(published?.snapshot_items ?? working.snapshot_items),
    adminNotes: (notes as ProposalAdminNoteRow | null)?.notes ?? "",
  };
}

export async function createProposal(clientId: string, projectId: string | null, title: string): Promise<string> {
  const client = db();
  const { data, error } = await client.rpc("create_proposal", {
    p_client_id: clientId,
    p_project_id: projectId,
    p_title: title.trim() || "Website proposal",
  });
  throwIf(error, "create proposal", "Unable to create this proposal.");
  const id = firstId(data);
  if (!id) throw new AgencyDbError("Unable to create this proposal.");
  return id;
}

export async function saveProposalDraft(input: {
  revisionId: string;
  title: string;
  introduction: string;
  overview: string;
  scope: string;
  deliverablesText: string;
  timeline: string;
  paymentTerms: string;
  terms: string;
  notes: string;
  validUntil: string | null;
  items: LineItemDraft[];
  adminNotes: string;
}): Promise<void> {
  const client = db();
  const { error } = await client
    .from("proposal_revisions")
    .update({
      title: input.title.trim(),
      introduction: input.introduction.trim(),
      overview: input.overview.trim(),
      scope: input.scope.trim(),
      deliverables_text: input.deliverablesText.trim(),
      timeline: input.timeline.trim(),
      payment_terms: input.paymentTerms.trim(),
      terms: input.terms.trim(),
      notes: input.notes.trim(),
      valid_until: input.validUntil,
    })
    .eq("id", input.revisionId)
    .eq("status", "draft");
  throwIf(error, "save proposal", "Unable to save this proposal.");

  const { error: deleteError } = await client.from("proposal_items").delete().eq("revision_id", input.revisionId);
  throwIf(deleteError, "save proposal", "Unable to save this proposal.");

  const rows = input.items
    .map((item, index) => ({
      revision_id: input.revisionId,
      name: item.name.trim(),
      description: item.description.trim(),
      quantity: Math.max(1, Math.floor(item.quantity) || 1),
      unit_price_cents: Math.max(0, Math.floor(item.unitPriceCents) || 0),
      sort_order: index,
    }))
    .filter((item) => item.name.length > 0);
  if (rows.length > 0) {
    const { error: insertError } = await client.from("proposal_items").insert(rows);
    throwIf(insertError, "save proposal", "Unable to save this proposal.");
  }

  const { error: noteError } = await client.from("proposal_admin_notes").upsert({
    revision_id: input.revisionId,
    notes: input.adminNotes.trim(),
  });
  throwIf(noteError, "save proposal", "Unable to save this proposal.");
}

async function invokeDocumentEmail(kind: "proposal" | "contract", id: string): Promise<void> {
  const client = db();
  const { data, error } = await client.functions.invoke("document-email", { body: { kind, id } });
  if (error) {
    const message = (error.message ?? "").toLowerCase();
    if (message.includes("failed to fetch") || message.includes("network")) {
      throw new AgencyDbError(documentErrorMessage("network"), error);
    }
    throw new AgencyDbError(documentErrorMessage("email_failed"), error);
  }
  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) {
    throw new AgencyDbError(documentErrorMessage(payload?.error ?? "email_failed"));
  }
}

export async function sendProposal(proposalId: string): Promise<{ emailed: boolean }> {
  const client = db();
  const { error } = await client.rpc("send_proposal", { p_proposal_id: proposalId });
  throwIf(error, "send proposal", "Unable to send this proposal.");
  try {
    await invokeDocumentEmail("proposal", proposalId);
    return { emailed: true };
  } catch {
    return { emailed: false };
  }
}

export async function markProposalViewed(proposalId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("mark_proposal_viewed", { p_proposal_id: proposalId });
  throwIf(error, "view proposal", "Unable to open this proposal.");
}

export async function acceptProposal(proposalId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("accept_proposal", { p_proposal_id: proposalId });
  throwIf(error, "accept proposal", "Unable to accept this proposal.");
}

export async function declineProposal(proposalId: string, reason: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("decline_proposal", { p_proposal_id: proposalId, p_reason: reason });
  throwIf(error, "decline proposal", "Unable to decline this proposal.");
}

export async function cancelProposal(proposalId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("cancel_proposal", { p_proposal_id: proposalId });
  throwIf(error, "cancel proposal", "Unable to cancel this proposal.");
}

export async function createProposalRevision(proposalId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("create_proposal_revision", { p_proposal_id: proposalId });
  throwIf(error, "revise proposal", "Unable to create a new revision.");
}

export async function fetchContractSummaries(clientId?: string): Promise<ContractSummary[]> {
  const client = db();
  let query = client.from("contracts").select("*").order("created_at", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  throwIf(error, "load contracts", "Unable to load contracts.");
  const rows = (data ?? []) as ContractRow[];
  if (rows.length === 0) return [];
  const revisionIds = [
    ...new Set(rows.flatMap((row) => [row.working_revision_id, row.published_revision_id].filter(Boolean) as string[])),
  ];
  const { data: revisions, error: revError } = await client.from("contract_revisions").select("*").in("id", revisionIds);
  throwIf(revError, "load contracts", "Unable to load contracts.");
  const byId = new Map(((revisions ?? []) as ContractRevisionRow[]).map((row) => [row.id, row]));
  return rows
    .map((row) => {
      const revision =
        (row.working_revision_id ? byId.get(row.working_revision_id) : undefined) ??
        (row.published_revision_id ? byId.get(row.published_revision_id) : undefined);
      return revision ? toContractSummary(row, revision) : null;
    })
    .filter((row): row is ContractSummary => Boolean(row));
}

export async function fetchClientContractSummaries(): Promise<ContractSummary[]> {
  const client = db();
  const { data, error } = await client.from("contracts").select("*").order("created_at", { ascending: false });
  throwIf(error, "load contracts", "Unable to load contracts.");
  const rows = (data ?? []) as ContractRow[];
  const ids = rows.map((row) => row.published_revision_id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];
  const { data: revisions, error: revError } = await client.from("contract_revisions").select("*").in("id", ids);
  throwIf(revError, "load contracts", "Unable to load contracts.");
  const byId = new Map(((revisions ?? []) as ContractRevisionRow[]).map((row) => [row.id, row]));
  return rows
    .map((row) => {
      const revision = row.published_revision_id ? byId.get(row.published_revision_id) : undefined;
      return revision ? toContractSummary(row, revision) : null;
    })
    .filter((row): row is ContractSummary => Boolean(row));
}

export async function fetchContractDetail(id: string): Promise<ContractDetail | null> {
  const client = db();
  const { data, error } = await client.from("contracts").select("*").eq("id", id).maybeSingle();
  throwIf(error, "load contract", "Unable to load this contract.");
  if (!data) return null;
  const contract = data as ContractRow;
  const revisionIds = [contract.working_revision_id, contract.published_revision_id].filter(Boolean) as string[];
  const { data: revisions, error: revError } = await client.from("contract_revisions").select("*").in("id", revisionIds);
  throwIf(revError, "load contract", "Unable to load this contract.");
  const list = (revisions ?? []) as ContractRevisionRow[];
  const working = list.find((row) => row.id === contract.working_revision_id) ?? list[0];
  if (!working) return null;
  const published = contract.published_revision_id
    ? list.find((row) => row.id === contract.published_revision_id) ?? null
    : null;
  const { data: notes } = await client.from("contract_admin_notes").select("*").eq("revision_id", working.id).maybeSingle();
  return {
    contract,
    working,
    published,
    adminNotes: (notes as ContractAdminNoteRow | null)?.notes ?? "",
  };
}

export async function createContract(input: {
  clientId: string;
  projectId?: string | null;
  proposalId?: string | null;
  title?: string;
}): Promise<string> {
  const client = db();
  const { data, error } = await client.rpc("create_contract", {
    p_client_id: input.clientId,
    p_project_id: input.projectId ?? null,
    p_proposal_id: input.proposalId ?? null,
    p_title: input.title ?? "Website Development Agreement",
  });
  throwIf(error, "create contract", "Unable to create this contract.");
  const id = firstId(data);
  if (!id) throw new AgencyDbError("Unable to create this contract.");
  return id;
}

export async function saveContractDraft(input: {
  revisionId: string;
  title: string;
  parties: string;
  scope: string;
  responsibilities: string;
  timeline: string;
  compensation: string;
  paymentTerms: string;
  confidentiality: string;
  intellectualProperty: string;
  revisionsPolicy: string;
  termination: string;
  generalTerms: string;
  effectiveDate: string | null;
  expiresAt: string | null;
  adminNotes: string;
}): Promise<void> {
  const client = db();
  const { error } = await client
    .from("contract_revisions")
    .update({
      title: input.title.trim(),
      parties: input.parties.trim(),
      scope: input.scope.trim(),
      responsibilities: input.responsibilities.trim(),
      timeline: input.timeline.trim(),
      compensation: input.compensation.trim(),
      payment_terms: input.paymentTerms.trim(),
      confidentiality: input.confidentiality.trim(),
      intellectual_property: input.intellectualProperty.trim(),
      revisions_policy: input.revisionsPolicy.trim(),
      termination: input.termination.trim(),
      general_terms: input.generalTerms.trim(),
      effective_date: input.effectiveDate,
      expires_at: input.expiresAt,
    })
    .eq("id", input.revisionId)
    .eq("status", "draft");
  throwIf(error, "save contract", "Unable to save this contract.");
  const { error: noteError } = await client.from("contract_admin_notes").upsert({
    revision_id: input.revisionId,
    notes: input.adminNotes.trim(),
  });
  throwIf(noteError, "save contract", "Unable to save this contract.");
}

export async function sendContract(contractId: string): Promise<{ emailed: boolean }> {
  const client = db();
  const { error } = await client.rpc("send_contract", { p_contract_id: contractId });
  throwIf(error, "send contract", "Unable to send this contract.");
  try {
    await invokeDocumentEmail("contract", contractId);
    return { emailed: true };
  } catch {
    return { emailed: false };
  }
}

export async function markContractViewed(contractId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("mark_contract_viewed", { p_contract_id: contractId });
  throwIf(error, "view contract", "Unable to open this contract.");
}

export async function acceptContract(contractId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("accept_contract", { p_contract_id: contractId });
  throwIf(error, "accept contract", "Unable to accept this contract.");
}

export async function declineContract(contractId: string, reason: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("decline_contract", { p_contract_id: contractId, p_reason: reason });
  throwIf(error, "decline contract", "Unable to decline this contract.");
}

export async function cancelContract(contractId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("cancel_contract", { p_contract_id: contractId });
  throwIf(error, "cancel contract", "Unable to cancel this contract.");
}

export async function createContractRevision(contractId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("create_contract_revision", { p_contract_id: contractId });
  throwIf(error, "revise contract", "Unable to create a new revision.");
}

export function proposalLineDrafts(detail: ProposalDetail): LineItemDraft[] {
  if (detail.working.status === "draft") return draftsFromItems(detail.items);
  return draftsFromItems(detail.snapshotItems.length > 0 ? detail.snapshotItems : detail.items);
}

export async function downloadProposalPdf(proposalId: string): Promise<void> {
  await downloadAuthenticatedPdf({
    functionName: "proposal-pdf",
    body: { proposalId },
    fallbackFilename: "MotiveScripts-Proposal.pdf",
    notAllowedMessage: documentErrorMessage("not_allowed"),
    networkMessage: documentErrorMessage("network"),
    failedMessage: documentErrorMessage("proposal_pdf_failed"),
  });
}

export async function downloadContractPdf(contractId: string): Promise<void> {
  await downloadAuthenticatedPdf({
    functionName: "contract-pdf",
    body: { contractId },
    fallbackFilename: "MotiveScripts-Contract.pdf",
    notAllowedMessage: documentErrorMessage("not_allowed"),
    networkMessage: documentErrorMessage("network"),
    failedMessage: documentErrorMessage("contract_pdf_failed"),
  });
}
