import { formatInvoiceDate, formatMoneyFromCents } from "./money.ts";
import {
  BLUE,
  INK,
  LINE,
  MARGIN,
  MUTED,
  PAGE_W,
  brandedPdfFilename,
  createPdfCtx,
  drawText,
  ensureSpace,
  finishPdf,
  wrapLine,
} from "./pdfLayout.ts";

export { bytesToBase64 } from "./pdfLayout.ts";

export type InvoicePdfItem = {
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
};

export type InvoicePdfPayment = {
  date: string;
  methodLabel: string;
  statusLabel: string;
  amount_cents: number;
  reference: string | null;
};

export type InvoicePdfModel = {
  number: string;
  statusLabel: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  billToName: string;
  billToCompany: string;
  billToEmail: string;
  billToPhone: string;
  projectName: string | null;
  notes: string;
  items: InvoicePdfItem[];
  subtotal_cents: number;
  tax_cents: number;
  discount_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  amount_due_cents: number;
  payments: InvoicePdfPayment[];
  agencyName: string;
  agencyEmail: string;
};

export function invoicePdfFilename(invoiceNumber: string): string {
  return brandedPdfFilename("Invoice", invoiceNumber);
}

export async function generateInvoicePdf(model: InvoicePdfModel): Promise<Uint8Array> {
  const ctx = await createPdfCtx({
    title: `Invoice ${model.number}`,
    subject: "Invoice",
    kind: "INVOICE",
    agencyEmail: model.agencyEmail,
  });
  const money = (cents: number) => formatMoneyFromCents(cents, model.currency);
  const { font, bold } = ctx;

  drawText(ctx.page, model.number, MARGIN, ctx.y, bold, 18, INK);
  const statusWidth = bold.widthOfTextAtSize(model.statusLabel, 10);
  drawText(ctx.page, model.statusLabel, PAGE_W - MARGIN - statusWidth, ctx.y + 4, bold, 10, BLUE);
  ctx.y -= 22;
  drawText(ctx.page, `Issue date  ${formatInvoiceDate(model.issueDate)}`, MARGIN, ctx.y, font, 10, MUTED);
  const due = `Due date  ${formatInvoiceDate(model.dueDate)}`;
  drawText(ctx.page, due, PAGE_W - MARGIN - font.widthOfTextAtSize(due, 10), ctx.y, font, 10, MUTED);
  ctx.y -= 28;

  drawText(ctx.page, "BILL TO", MARGIN, ctx.y, bold, 8, MUTED);
  ctx.y -= 14;
  const company = model.billToCompany || model.billToName || "Client";
  drawText(ctx.page, company, MARGIN, ctx.y, bold, 11, INK);
  ctx.y -= 14;
  if (model.billToName && model.billToName !== company) {
    drawText(ctx.page, model.billToName, MARGIN, ctx.y, font, 10, INK);
    ctx.y -= 13;
  }
  if (model.billToEmail) {
    drawText(ctx.page, model.billToEmail, MARGIN, ctx.y, font, 10, MUTED);
    ctx.y -= 13;
  }
  if (model.billToPhone) {
    drawText(ctx.page, model.billToPhone, MARGIN, ctx.y, font, 10, MUTED);
    ctx.y -= 13;
  }
  ctx.y -= 8;

  if (model.projectName) {
    ensureSpace(ctx, 36);
    drawText(ctx.page, "PROJECT", MARGIN, ctx.y, bold, 8, MUTED);
    ctx.y -= 14;
    drawText(ctx.page, model.projectName, MARGIN, ctx.y, font, 11, INK);
    ctx.y -= 8;
    drawText(ctx.page, company, MARGIN, ctx.y, font, 10, MUTED);
    ctx.y -= 20;
  }

  ensureSpace(ctx, 40);
  drawText(ctx.page, "Description", MARGIN, ctx.y, bold, 8, MUTED);
  drawText(ctx.page, "Qty", 360, ctx.y, bold, 8, MUTED);
  drawText(ctx.page, "Unit price", 410, ctx.y, bold, 8, MUTED);
  drawText(ctx.page, "Amount", 510, ctx.y, bold, 8, MUTED);
  ctx.y -= 6;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness: 0.75,
    color: LINE,
  });
  ctx.y -= 14;

  const descWidth = 300;
  if (model.items.length === 0) {
    drawText(ctx.page, "No line items.", MARGIN, ctx.y, font, 10, MUTED);
    ctx.y -= 18;
  } else {
    for (const item of model.items) {
      const lines = wrapLine(item.description || "Item", font, 10, descWidth);
      const rowHeight = Math.max(16, lines.length * 12 + 6);
      ensureSpace(ctx, rowHeight);
      let lineY = ctx.y;
      for (const line of lines) {
        drawText(ctx.page, line, MARGIN, lineY, font, 10, INK);
        lineY -= 12;
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

  ctx.y -= 8;
  ctx.page.drawLine({
    start: { x: 330, y: ctx.y },
    end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness: 0.75,
    color: LINE,
  });
  ctx.y -= 18;

  const rows: [string, string, boolean][] = [
    ["Subtotal", money(model.subtotal_cents), false],
    ["Discount", model.discount_cents > 0 ? `-${money(model.discount_cents)}` : money(0), false],
    ["Tax", money(model.tax_cents), false],
    ["Total", money(model.total_cents), true],
    ["Amount paid", money(model.amount_paid_cents), false],
    ["Amount due", money(model.amount_due_cents), true],
  ];
  ensureSpace(ctx, rows.length * 16 + 8);
  for (const [label, value, emphasize] of rows) {
    const labelFont = emphasize ? bold : font;
    const valueFont = emphasize ? bold : font;
    drawText(ctx.page, label, 330, ctx.y, labelFont, 10, emphasize ? INK : MUTED);
    drawText(ctx.page, value, PAGE_W - MARGIN - valueFont.widthOfTextAtSize(value, 10), ctx.y, valueFont, 10, INK);
    ctx.y -= 16;
  }

  ctx.y -= 10;
  ensureSpace(ctx, 40);
  drawText(ctx.page, "PAYMENTS", MARGIN, ctx.y, bold, 8, MUTED);
  ctx.y -= 16;
  if (model.payments.length === 0) {
    drawText(ctx.page, "No payments recorded.", MARGIN, ctx.y, font, 10, MUTED);
    ctx.y -= 16;
  } else {
    for (const payment of model.payments) {
      ensureSpace(ctx, 28);
      const amount = money(payment.amount_cents);
      drawText(ctx.page, formatInvoiceDate(payment.date), MARGIN, ctx.y, font, 10, INK);
      drawText(ctx.page, `${payment.methodLabel} · ${payment.statusLabel}`, 160, ctx.y, font, 10, MUTED);
      drawText(ctx.page, amount, PAGE_W - MARGIN - font.widthOfTextAtSize(amount, 10), ctx.y, font, 10, INK);
      ctx.y -= 13;
      if (payment.reference) {
        drawText(ctx.page, payment.reference, 160, ctx.y, font, 9, MUTED);
        ctx.y -= 12;
      }
      ctx.y -= 4;
    }
  }

  if (model.notes.trim()) {
    ctx.y -= 8;
    ensureSpace(ctx, 36);
    drawText(ctx.page, "NOTES", MARGIN, ctx.y, bold, 8, MUTED);
    ctx.y -= 14;
    const noteLines = wrapLine(model.notes.trim(), font, 10, PAGE_W - MARGIN * 2);
    for (const line of noteLines) {
      ensureSpace(ctx, 14);
      drawText(ctx.page, line, MARGIN, ctx.y, font, 10, INK);
      ctx.y -= 14;
    }
  }

  return await finishPdf(ctx);
}
