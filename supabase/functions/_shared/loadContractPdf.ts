import { agencyEmail, asText, clientMayAccessPublished, documentStatusLabel, effectiveDocumentStatus } from "./documentStatus.ts";
import type { ContractPdfModel } from "./contractPdf.ts";

export { clientMayAccessPublished };

function snapshotOrField(snapshot: Record<string, unknown> | null, key: string, fallback: unknown): string {
  if (snapshot && typeof snapshot[key] === "string") return snapshot[key] as string;
  return asText(fallback);
}

export async function loadContractPdfModel(
  // deno-lint-ignore no-explicit-any
  admin: { from: (table: string) => any },
  contractId: string,
  audience: "admin" | "client",
): Promise<ContractPdfModel | null> {
  const { data: contract } = await admin
    .from("contracts")
    .select(
      "id, client_id, project_id, proposal_id, contract_number, working_revision_id, published_revision_id, created_at",
    )
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return null;

  const publishedId = asText(contract.published_revision_id) || null;
  const workingId = asText(contract.working_revision_id) || null;
  if (audience === "client" && !publishedId) return null;
  const revisionId = audience === "client" ? publishedId : publishedId || workingId;
  if (!revisionId) return null;

  const { data: revision } = await admin.from("contract_revisions").select("*").eq("id", revisionId).maybeSingle();
  if (!revision) return null;
  if (audience === "client" && !clientMayAccessPublished(asText(revision.status))) return null;

  const snapshot =
    revision.snapshot && typeof revision.snapshot === "object" && !Array.isArray(revision.snapshot)
      ? (revision.snapshot as Record<string, unknown>)
      : null;

  const { data: clientRow } = await admin
    .from("clients")
    .select("business_name, contact_name, email, phone")
    .eq("id", contract.client_id)
    .maybeSingle();

  let projectName: string | null = null;
  if (contract.project_id) {
    const { data: projectRow } = await admin.from("projects").select("name").eq("id", contract.project_id).maybeSingle();
    if (typeof projectRow?.name === "string" && projectRow.name.trim()) projectName = projectRow.name.trim();
  }

  let proposalNumber: string | null = null;
  if (contract.proposal_id) {
    const { data: proposalRow } = await admin
      .from("proposals")
      .select("proposal_number")
      .eq("id", contract.proposal_id)
      .maybeSingle();
    if (typeof proposalRow?.proposal_number === "string") proposalNumber = proposalRow.proposal_number;
  }

  const effectiveDate = snapshotOrField(snapshot, "effective_date", revision.effective_date) || null;
  const expiresAt = snapshotOrField(snapshot, "expires_at", revision.expires_at) || null;
  const effective = effectiveDocumentStatus(asText(revision.status), expiresAt);

  return {
    number: asText(contract.contract_number),
    title: snapshotOrField(snapshot, "title", revision.title) || "Agreement",
    statusLabel: documentStatusLabel(effective, audience),
    revisionNumber: typeof revision.revision_number === "number" ? revision.revision_number : 1,
    issueDate: asText(revision.sent_at) || asText(contract.created_at),
    effectiveDate: effectiveDate || null,
    expiresAt: expiresAt || null,
    companyName: asText(clientRow?.business_name) || "Client",
    contactName: asText(clientRow?.contact_name),
    email: asText(clientRow?.email),
    phone: asText(clientRow?.phone),
    projectName,
    proposalNumber,
    parties: snapshotOrField(snapshot, "parties", revision.parties),
    scope: snapshotOrField(snapshot, "scope", revision.scope),
    responsibilities: snapshotOrField(snapshot, "responsibilities", revision.responsibilities),
    timeline: snapshotOrField(snapshot, "timeline", revision.timeline),
    compensation: snapshotOrField(snapshot, "compensation", revision.compensation),
    paymentTerms: snapshotOrField(snapshot, "payment_terms", revision.payment_terms),
    confidentiality: snapshotOrField(snapshot, "confidentiality", revision.confidentiality),
    intellectualProperty: snapshotOrField(snapshot, "intellectual_property", revision.intellectual_property),
    revisionsPolicy: snapshotOrField(snapshot, "revisions_policy", revision.revisions_policy),
    termination: snapshotOrField(snapshot, "termination", revision.termination),
    generalTerms: snapshotOrField(snapshot, "general_terms", revision.general_terms),
    acceptedAt: asText(revision.accepted_at) || null,
    acceptedEmail: asText(revision.accepted_email) || null,
    agencyEmail: agencyEmail(),
  };
}
