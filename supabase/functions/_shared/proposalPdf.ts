import { formatInvoiceDate, formatMoneyFromCents, formatTimestamp } from "./money.ts";
import {
  BLUE,
  INK,
  LINE,
  MARGIN,
  MUTED,
  PAGE_W,
  brandedPdfFilename,
  createPdfCtx,
  drawNumberedSection,
  drawSection,
  drawText,
  ensureSpace,
  finishPdf,
  wrapLine,
} from "./pdfLayout.ts";

export type ProposalPdfItem = {
  name: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
};

export type ProposalPdfModel = {
  number: string;
  title: string;
  statusLabel: string;
  revisionNumber: number;
  issueDate: string;
  validUntil: string | null;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  projectName: string | null;
  introduction: string;
  overview: string;
  scope: string;
  deliverables: string;
  timeline: string;
  paymentTerms: string;
  terms: string;
  notes: string;
  items: ProposalPdfItem[];
  subtotal_cents: number;
  investment_cents: number;
  acceptedAt: string | null;
  acceptedEmail: string | null;
  agencyEmail: string;
};

export function proposalPdfFilename(proposalNumber: string): string {
  return brandedPdfFilename("Proposal", proposalNumber);
}

export async function generateProposalPdf(model: ProposalPdfModel): Promise<Uint8Array> {
  const ctx = await createPdfCtx({
    title: `Proposal ${model.number}`,
    subject: model.title,
    kind: "PROPOSAL",
    agencyEmail: model.agencyEmail,
  });
  const { font, bold } = ctx;
  const money = (cents: number) => formatMoneyFromCents(cents, "USD");

  drawText(ctx.page, model.number, MARGIN, ctx.y, bold, 18, INK);
  const statusWidth = bold.widthOfTextAtSize(model.statusLabel, 10);
  drawText(ctx.page, model.statusLabel, PAGE_W - MARGIN - statusWidth, ctx.y + 4, bold, 10, BLUE);
  ctx.y -= 20;
  const titleLines = wrapLine(model.title || "Proposal", bold, 13, PAGE_W - MARGIN * 2);
  for (const line of titleLines) {
    ensureSpace(ctx, 16);
    drawText(ctx.page, line, MARGIN, ctx.y, bold, 13, INK);
    ctx.y -= 16;
  }
  drawText(ctx.page, `Revision ${model.revisionNumber}`, MARGIN, ctx.y, font, 9, MUTED);
  ctx.y -= 16;
  drawText(ctx.page, `Date  ${formatInvoiceDate(model.issueDate)}`, MARGIN, ctx.y, font, 10, MUTED);
  if (model.validUntil) {
    const until = `Valid until  ${formatInvoiceDate(model.validUntil)}`;
    drawText(ctx.page, until, PAGE_W - MARGIN - font.widthOfTextAtSize(until, 10), ctx.y, font, 10, MUTED);
  }
  ctx.y -= 24;

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
  ctx.y -= 6;

  if (model.projectName) {
    ensureSpace(ctx, 32);
    drawText(ctx.page, "PROJECT", MARGIN, ctx.y, bold, 8, MUTED);
    ctx.y -= 14;
    drawText(ctx.page, model.projectName, MARGIN, ctx.y, font, 11, INK);
    ctx.y -= 8;
    drawText(ctx.page, model.companyName, MARGIN, ctx.y, font, 10, MUTED);
    ctx.y -= 16;
  }

  const intro = model.introduction.trim();
  const overview = model.overview.trim();
  drawSection(ctx, "Overview", intro || overview);
  if (intro && overview && intro !== overview) {
    drawSection(ctx, "Project overview", overview);
  }
  drawSection(ctx, "Scope of work", model.scope);
  drawNumberedSection(ctx, "Deliverables", model.deliverables);
  drawSection(ctx, "Timeline", model.timeline);

  ctx.y -= 4;
  ensureSpace(ctx, 40);
  drawText(ctx.page, "INVESTMENT", MARGIN, ctx.y, bold, 8, MUTED);
  ctx.y -= 8;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness: 0.75,
    color: LINE,
  });
  ctx.y -= 14;
  drawText(ctx.page, "Description", MARGIN, ctx.y, bold, 8, MUTED);
  drawText(ctx.page, "Qty", 360, ctx.y, bold, 8, MUTED);
  drawText(ctx.page, "Unit price", 410, ctx.y, bold, 8, MUTED);
  drawText(ctx.page, "Amount", 510, ctx.y, bold, 8, MUTED);
  ctx.y -= 14;

  if (model.items.length === 0) {
    drawText(ctx.page, "No line items.", MARGIN, ctx.y, font, 10, MUTED);
    ctx.y -= 18;
  } else {
    for (const item of model.items) {
      const nameLines = wrapLine(item.name || "Item", bold, 10, 300);
      const descLines = item.description.trim() ? wrapLine(item.description.trim(), font, 9, 300) : [];
      const rowHeight = Math.max(16, nameLines.length * 12 + descLines.length * 11 + 8);
      ensureSpace(ctx, rowHeight);
      let lineY = ctx.y;
      for (const line of nameLines) {
        drawText(ctx.page, line, MARGIN, lineY, bold, 10, INK);
        lineY -= 12;
      }
      for (const line of descLines) {
        drawText(ctx.page, line, MARGIN, lineY, font, 9, MUTED);
        lineY -= 11;
      }
      const qty = String(item.quantity);
      const unit = money(item.unit_price_cents);
      const total = money(item.total_cents);
      drawText(ctx.page, qty, 360, ctx.y, font, 10, INK);
      drawText(ctx.page, unit, 410, ctx.y, font, 10, INK);
      drawText(ctx.page, total, PAGE_W - MARGIN - font.widthOfTextAtSize(total, 10), ctx.y, font, 10, INK);
      ctx.y -= rowHeight;
    }
  }

  ctx.y -= 4;
  ctx.page.drawLine({
    start: { x: 330, y: ctx.y },
    end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness: 0.75,
    color: LINE,
  });
  ctx.y -= 16;
  ensureSpace(ctx, 36);
  if (model.subtotal_cents > 0 && model.subtotal_cents !== model.investment_cents) {
    drawText(ctx.page, "Subtotal", 330, ctx.y, font, 10, MUTED);
    const sub = money(model.subtotal_cents);
    drawText(ctx.page, sub, PAGE_W - MARGIN - font.widthOfTextAtSize(sub, 10), ctx.y, font, 10, INK);
    ctx.y -= 16;
  }
  drawText(ctx.page, "Grand total", 330, ctx.y, bold, 11, INK);
  const grand = money(model.investment_cents);
  drawText(ctx.page, grand, PAGE_W - MARGIN - bold.widthOfTextAtSize(grand, 11), ctx.y, bold, 11, INK);
  ctx.y -= 18;

  drawSection(ctx, "Payment terms", model.paymentTerms);
  drawSection(ctx, "Terms & conditions", model.terms);
  drawSection(ctx, "Notes", model.notes);

  if (model.acceptedAt || model.acceptedEmail) {
    ctx.y -= 4;
    ensureSpace(ctx, 48);
    drawText(ctx.page, "ACCEPTANCE", MARGIN, ctx.y, bold, 8, MUTED);
    ctx.y -= 14;
    if (model.acceptedAt) {
      drawText(ctx.page, `Accepted ${formatTimestamp(model.acceptedAt)}`, MARGIN, ctx.y, font, 10, INK);
      ctx.y -= 13;
    }
    if (model.acceptedEmail) {
      drawText(ctx.page, model.acceptedEmail, MARGIN, ctx.y, font, 10, MUTED);
      ctx.y -= 13;
    }
    drawText(
      ctx.page,
      "Recorded as authenticated portal acceptance. This is not a qualified digital signature.",
      MARGIN,
      ctx.y,
      font,
      8,
      MUTED,
    );
    ctx.y -= 14;
  }

  return await finishPdf(ctx);
}
