import { asCents } from "./money.ts";
import { agencyEmail, asInt, asText, clientMayAccessPublished, documentStatusLabel, effectiveDocumentStatus } from "./documentStatus.ts";
import type { ProposalPdfItem, ProposalPdfModel } from "./proposalPdf.ts";

export { clientMayAccessPublished };

function itemsFromUnknown(value: unknown): ProposalPdfItem[] {
  if (!Array.isArray(value)) return [];
  return [...value]
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const name =
        (typeof row.name === "string" && row.name.trim()) ||
        (typeof row.description === "string" && row.description.trim()) ||
        "Item";
      return {
        name,
        description: typeof row.description === "string" ? row.description : "",
        quantity: Math.max(1, asInt(row.quantity, 1)),
        unit_price_cents: asCents(row.unit_price_cents),
        total_cents: asCents(row.total_cents),
        sort_order: typeof row.sort_order === "number" ? row.sort_order : index,
      };
    })
    .filter((item): item is ProposalPdfItem & { sort_order: number } => item != null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(({ sort_order: _s, ...item }) => item);
}

export async function loadProposalPdfModel(
  // deno-lint-ignore no-explicit-any
  admin: { from: (table: string) => any },
  proposalId: string,
  audience: "admin" | "client",
): Promise<ProposalPdfModel | null> {
  const { data: proposal } = await admin
    .from("proposals")
    .select("id, client_id, project_id, proposal_number, working_revision_id, published_revision_id, created_at")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return null;

  const publishedId = asText(proposal.published_revision_id) || null;
  const workingId = asText(proposal.working_revision_id) || null;
  if (audience === "client") {
    if (!publishedId) return null;
  }
  const revisionId = audience === "client" ? publishedId : publishedId || workingId;
  if (!revisionId) return null;

  const { data: revision } = await admin.from("proposal_revisions").select("*").eq("id", revisionId).maybeSingle();
  if (!revision) return null;
  if (audience === "client" && !clientMayAccessPublished(asText(revision.status))) return null;

  const snapshot = itemsFromUnknown(revision.snapshot_items);
  let items = snapshot;
  if (items.length === 0) {
    const { data: itemRows } = await admin
      .from("proposal_items")
      .select("name, description, quantity, unit_price_cents, total_cents, sort_order")
      .eq("revision_id", revision.id)
      .order("sort_order", { ascending: true });
    items = itemsFromUnknown(itemRows ?? []);
  }

  const { data: clientRow } = await admin
    .from("clients")
    .select("business_name, contact_name, email, phone")
    .eq("id", proposal.client_id)
    .maybeSingle();

  let projectName: string | null = null;
  if (proposal.project_id) {
    const { data: projectRow } = await admin.from("projects").select("name").eq("id", proposal.project_id).maybeSingle();
    if (typeof projectRow?.name === "string" && projectRow.name.trim()) projectName = projectRow.name.trim();
  }

  const investment = asCents(revision.investment_cents);
  const lineSum = items.reduce((sum, item) => sum + item.total_cents, 0);
  const effective = effectiveDocumentStatus(asText(revision.status), asText(revision.valid_until) || null);
  const issueSource = asText(revision.sent_at) || asText(proposal.created_at);

  return {
    number: asText(proposal.proposal_number),
    title: asText(revision.title) || "Proposal",
    statusLabel: documentStatusLabel(effective, audience),
    revisionNumber: asInt(revision.revision_number, 1),
    issueDate: issueSource,
    validUntil: asText(revision.valid_until) || null,
    companyName: asText(clientRow?.business_name) || "Client",
    contactName: asText(clientRow?.contact_name),
    email: asText(clientRow?.email),
    phone: asText(clientRow?.phone),
    projectName,
    introduction: asText(revision.introduction),
    overview: asText(revision.overview),
    scope: asText(revision.scope),
    deliverables: asText(revision.deliverables_text),
    timeline: asText(revision.timeline),
    paymentTerms: asText(revision.payment_terms),
    terms: asText(revision.terms),
    notes: asText(revision.notes),
    items,
    subtotal_cents: lineSum,
    investment_cents: investment,
    acceptedAt: asText(revision.accepted_at) || null,
    acceptedEmail: asText(revision.accepted_email) || null,
    agencyEmail: agencyEmail(),
  };
}
