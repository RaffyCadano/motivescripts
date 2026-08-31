import { formatInvoiceDate, formatTimestamp } from "./money.ts";
import {
  BLUE,
  INK,
  MARGIN,
  MUTED,
  PAGE_W,
  brandedPdfFilename,
  createPdfCtx,
  drawBody,
  drawSection,
  drawText,
  ensureSpace,
  finishPdf,
  wrapLine,
} from "./pdfLayout.ts";

export type ContractPdfModel = {
  number: string;
  title: string;
  statusLabel: string;
  revisionNumber: number;
  issueDate: string;
  effectiveDate: string | null;
  expiresAt: string | null;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  projectName: string | null;
  proposalNumber: string | null;
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
  acceptedAt: string | null;
  acceptedEmail: string | null;
  agencySignedAt: string | null;
  agencySignedName: string | null;
  agencySignedEmail: string | null;
  agencyEmail: string;
};

export function contractPdfFilename(contractNumber: string): string {
  return brandedPdfFilename("Contract", contractNumber);
}

export async function generateContractPdf(model: ContractPdfModel): Promise<Uint8Array> {
  const ctx = await createPdfCtx({
    title: `Contract ${model.number}`,
    subject: model.title,
    kind: "CONTRACT",
    agencyEmail: model.agencyEmail,
  });
  const { font, bold } = ctx;

  drawText(ctx.page, model.number, MARGIN, ctx.y, bold, 18, INK);
  const statusWidth = bold.widthOfTextAtSize(model.statusLabel, 10);
  drawText(ctx.page, model.statusLabel, PAGE_W - MARGIN - statusWidth, ctx.y + 4, bold, 10, BLUE);
  ctx.y -= 20;
  const titleLines = wrapLine(model.title || "Agreement", bold, 13, PAGE_W - MARGIN * 2);
  for (const line of titleLines) {
    ensureSpace(ctx, 16);
    drawText(ctx.page, line, MARGIN, ctx.y, bold, 13, INK);
    ctx.y -= 16;
  }
  drawText(ctx.page, `Revision ${model.revisionNumber}`, MARGIN, ctx.y, font, 9, MUTED);
  ctx.y -= 16;
  drawText(ctx.page, `Date  ${formatInvoiceDate(model.issueDate)}`, MARGIN, ctx.y, font, 10, MUTED);
  if (model.expiresAt) {
    const until = `Valid until  ${formatInvoiceDate(model.expiresAt)}`;
    drawText(ctx.page, until, PAGE_W - MARGIN - font.widthOfTextAtSize(until, 10), ctx.y, font, 10, MUTED);
  }
  ctx.y -= 18;
  if (model.effectiveDate) {
    drawText(ctx.page, `Effective  ${formatInvoiceDate(model.effectiveDate)}`, MARGIN, ctx.y, font, 10, MUTED);
    ctx.y -= 16;
  }

  drawText(ctx.page, "PREPARED FOR", MARGIN, ctx.y, bold, 8, MUTED);
  ctx.y -= 14;
  const companyLines = wrapLine(model.companyName, bold, 11, PAGE_W - MARGIN * 2);
  for (const line of companyLines) {
    ensureSpace(ctx, 14);
    drawText(ctx.page, line, MARGIN, ctx.y, bold, 11, INK);
    ctx.y -= 14;
  }
  if (model.contactName && model.contactName !== model.companyName) {
    drawText(ctx.page, model.contactName, MARGIN, ctx.y, font, 10, INK);
    ctx.y -= 13;
  }
  if (model.email) {
    drawText(ctx.page, model.email, MARGIN, ctx.y, font, 10, MUTED);
    ctx.y -= 13;
  }
  if (model.phone) {
    drawText(ctx.page, model.phone, MARGIN, ctx.y, font, 10, MUTED);
    ctx.y -= 13;
  }
  if (model.proposalNumber) {
    drawText(ctx.page, `Linked proposal  ${model.proposalNumber}`, MARGIN, ctx.y, font, 10, MUTED);
    ctx.y -= 13;
  }
  if (model.projectName) {
    drawText(ctx.page, `Project  ${model.projectName}`, MARGIN, ctx.y, font, 10, MUTED);
    ctx.y -= 13;
  }
  ctx.y -= 8;

  ensureSpace(ctx, 36);
  drawBody(
    ctx,
    "This is a workflow agreement in the MotiveScripts portal. It is not legal advice and is not a qualified digital signature.",
    9,
    MUTED,
    12,
  );
  ctx.y -= 8;

  drawSection(ctx, "Parties", model.parties);
  drawSection(ctx, "Scope", model.scope);
  drawSection(ctx, "Responsibilities", model.responsibilities);
  drawSection(ctx, "Timeline", model.timeline);
  drawSection(ctx, "Compensation", model.compensation);
  drawSection(ctx, "Payment terms", model.paymentTerms);
  drawSection(ctx, "Confidentiality", model.confidentiality);
  drawSection(ctx, "Intellectual property", model.intellectualProperty);
  drawSection(ctx, "Revisions", model.revisionsPolicy);
  drawSection(ctx, "Termination", model.termination);
  drawSection(ctx, "General terms", model.generalTerms);

  ctx.y -= 4;
  ensureSpace(ctx, 132);
  drawText(ctx.page, "SIGNATURES", MARGIN, ctx.y, bold, 8, MUTED);
  ctx.y -= 14;
  drawBody(
    ctx,
    "The Client signs this agreement by accepting it while signed in to the MotiveScripts portal. That records their agreement to these terms. It is not a qualified digital signature and is not a DocuSign, Adobe Sign, or similar e-signature.",
    8,
    MUTED,
    11,
  );
  ctx.y -= 10;

  const gap = 24;
  const colW = (PAGE_W - MARGIN * 2 - gap) / 2;
  const rightX = MARGIN + colW + gap;
  ensureSpace(ctx, 90);

  function drawSignatureColumn(x: number, heading: string, name: string, detail: string, status: string) {
    drawText(ctx.page, heading, x, ctx.y, bold, 8, MUTED);
    ctx.page.drawLine({
      start: { x, y: ctx.y - 28 },
      end: { x: x + colW, y: ctx.y - 28 },
      thickness: 0.75,
      color: INK,
    });
    if (status) {
      drawText(ctx.page, status, x, ctx.y - 24, bold, 9, INK);
    }
    drawText(ctx.page, name, x, ctx.y - 42, font, 10, INK);
    if (detail) {
      drawText(ctx.page, detail, x, ctx.y - 55, font, 9, MUTED);
    }
  }

  const clientAccepted = Boolean(model.acceptedAt || model.acceptedEmail);
  const agencySigned = Boolean(model.agencySignedAt || model.agencySignedName);
  const clientDetail = [
    model.contactName && model.contactName !== model.companyName ? model.contactName : null,
    clientAccepted ? model.acceptedEmail : null,
    clientAccepted && model.acceptedAt ? formatTimestamp(model.acceptedAt) : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const agencyDetail = [
    agencySigned ? model.agencySignedName || "Authorized representative" : "Authorized representative",
    agencySigned ? model.agencySignedEmail : null,
    agencySigned && model.agencySignedAt ? formatTimestamp(model.agencySignedAt) : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  drawSignatureColumn(
    MARGIN,
    "CLIENT",
    model.companyName,
    clientDetail || "Signed in the client portal",
    clientAccepted ? "Accepted in portal" : "",
  );
  drawSignatureColumn(
    rightX,
    "AGENCY",
    "MotiveScripts",
    agencyDetail,
    agencySigned ? "Signed" : "",
  );
  ctx.y -= 80;

  return await finishPdf(ctx);
}
