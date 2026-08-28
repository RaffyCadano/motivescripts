import { authorizeOwnedDocument, requirePdfUser } from "../_shared/pdfAuth.ts";
import { pdfFail, pdfFileResponse } from "../_shared/pdfLayout.ts";
import { generateProposalPdf, proposalPdfFilename } from "../_shared/proposalPdf.ts";
import { loadProposalPdfModel } from "../_shared/loadProposalPdf.ts";

Deno.serve(async (req) => {
  const auth = await requirePdfUser(req);
  if (!auth.ok) return auth.response;

  let proposalId = "";
  try {
    const body = (await req.json()) as { proposalId?: string };
    proposalId = (body.proposalId ?? "").trim();
  } catch {
    return pdfFail("invalid_action", req);
  }
  if (!proposalId) return pdfFail("invalid_action", req);

  const { data: proposal } = await auth.admin
    .from("proposals")
    .select("id, client_id, published_revision_id")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return pdfFail("not_found", req);

  const denied = await authorizeOwnedDocument(
    req,
    auth.userClient,
    auth.profile,
    proposal.client_id,
    Boolean(proposal.published_revision_id),
    "proposals.view",
  );
  if (denied) return denied;

  const audience = auth.profile.role === "client" ? "client" : "admin";
  try {
    const model = await loadProposalPdfModel(auth.admin, proposal.id, audience);
    if (!model) return pdfFail("not_found", req);
    const bytes = await generateProposalPdf(model);
    console.log("proposal-pdf generated", { proposal_id: proposal.id });
    return pdfFileResponse(bytes, proposalPdfFilename(model.number), req);
  } catch (caught) {
    console.error("proposal-pdf failed", caught instanceof Error ? caught.message : "unknown");
    return pdfFail("pdf_failed", req, 500);
  }
});
