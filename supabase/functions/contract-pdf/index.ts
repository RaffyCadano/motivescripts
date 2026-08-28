import { authorizeOwnedDocument, requirePdfUser } from "../_shared/pdfAuth.ts";
import { pdfFail, pdfFileResponse } from "../_shared/pdfLayout.ts";
import { generateContractPdf, contractPdfFilename } from "../_shared/contractPdf.ts";
import { loadContractPdfModel } from "../_shared/loadContractPdf.ts";

Deno.serve(async (req) => {
  const auth = await requirePdfUser(req);
  if (!auth.ok) return auth.response;

  let contractId = "";
  try {
    const body = (await req.json()) as { contractId?: string };
    contractId = (body.contractId ?? "").trim();
  } catch {
    return pdfFail("invalid_action", req);
  }
  if (!contractId) return pdfFail("invalid_action", req);

  const { data: contract } = await auth.admin
    .from("contracts")
    .select("id, client_id, published_revision_id")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return pdfFail("not_found", req);

  const denied = await authorizeOwnedDocument(
    req,
    auth.userClient,
    auth.profile,
    contract.client_id,
    Boolean(contract.published_revision_id),
    "contracts.view",
  );
  if (denied) return denied;

  const audience = auth.profile.role === "client" ? "client" : "admin";
  try {
    const model = await loadContractPdfModel(auth.admin, contract.id, audience);
    if (!model) return pdfFail("not_found", req);
    const bytes = await generateContractPdf(model);
    console.log("contract-pdf generated", { contract_id: contract.id });
    return pdfFileResponse(bytes, contractPdfFilename(model.number), req);
  } catch (caught) {
    console.error("contract-pdf failed", caught instanceof Error ? caught.message : "unknown");
    return pdfFail("pdf_failed", req, 500);
  }
});
