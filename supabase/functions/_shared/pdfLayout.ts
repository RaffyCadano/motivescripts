import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "npm:pdf-lib@1.17.1";
import { BRAND_LOGO_PNG_BASE64 } from "./brandLogoData.ts";

export const PAGE_W = 612;
export const PAGE_H = 792;
export const MARGIN = 48;
export const NAVY = rgb(0, 16 / 255, 48 / 255);
export const BLUE = rgb(0, 80 / 255, 240 / 255);
export const INK = rgb(7 / 255, 17 / 255, 31 / 255);
export const MUTED = rgb(102 / 255, 112 / 255, 133 / 255);
export const LINE = rgb(229 / 255, 234 / 255, 240 / 255);
export const FOOTER_Y = 40;

export type PdfKind = "INVOICE" | "PROPOSAL" | "CONTRACT";

export type PdfCtx = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  logo: PDFImage | null;
  agencyEmail: string;
  kind: PdfKind;
};

export function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function brandedPdfFilename(kind: "Invoice" | "Proposal" | "Contract", number: string): string {
  return `MotiveScripts-${kind}-${sanitizeFilenamePart(number) || kind}.pdf`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function bytesFromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function embedBrandLogo(doc: PDFDocument): Promise<PDFImage | null> {
  try {
    return await doc.embedPng(bytesFromBase64(BRAND_LOGO_PNG_BASE64));
  } catch {
    try {
      const bytes = await Deno.readFile(new URL("./brand-logo.png", import.meta.url));
      return await doc.embedPng(bytes);
    } catch {
      try {
        const bytes = await Deno.readFile(new URL("./brand-icon.png", import.meta.url));
        return await doc.embedPng(bytes);
      } catch {
        return null;
      }
    }
  }
}

function splitLongWord(word: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
  const parts: string[] = [];
  let current = "";
  for (const ch of word) {
    const next = current + ch;
    if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
      parts.push(current);
      current = ch;
    } else {
      current = next;
    }
  }
  if (current) parts.push(current);
  return parts;
}

export function pdfSafeText(text: string): string {
  const replacements: Record<string, string> = {
    "\u2212": "-",
    "\u2010": "-",
    "\u2011": "-",
    "\u2012": "-",
    "\u2013": "-",
    "\u2014": "-",
    "\u2018": "'",
    "\u2019": "'",
    "\u201A": ",",
    "\u201C": '"',
    "\u201D": '"',
    "\u2022": "-",
    "\u2026": "...",
    "\u00A0": " ",
    "\u2122": "TM",
    "\u00AE": "(R)",
  };
  let out = "";
  for (const ch of text) {
    if (replacements[ch]) {
      out += replacements[ch];
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
      out += ch;
      continue;
    }
    out += "?";
  }
  return out;
}

export function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = pdfSafeText(text).replace(/\s+/g, " ").trim().split(" ");
  if (words.length === 0 || words[0] === "") return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const pieces = splitLongWord(word, font, size, maxWidth);
    for (const piece of pieces) {
      const next = current ? `${current} ${piece}` : piece;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = piece;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function wrapParagraph(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const blocks = pdfSafeText(text).replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const block of blocks) {
    if (!block.trim()) {
      lines.push("");
      continue;
    }
    const wrapped = wrapLine(block, font, size, maxWidth);
    if (wrapped.length === 0) lines.push("");
    else lines.push(...wrapped);
  }
  return lines;
}

export function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = INK,
) {
  if (!text) return;
  page.drawText(pdfSafeText(text), { x, y, size, font, color });
}

export async function createPdfCtx(input: {
  title: string;
  subject: string;
  kind: PdfKind;
  agencyEmail: string;
}): Promise<PdfCtx> {
  const doc = await PDFDocument.create();
  doc.setTitle(input.title);
  doc.setAuthor("MotiveScripts");
  doc.setCreator("MotiveScripts");
  doc.setSubject(input.subject);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedBrandLogo(doc);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const ctx: PdfCtx = {
    doc,
    page,
    y: PAGE_H - MARGIN,
    font,
    bold,
    logo,
    agencyEmail: input.agencyEmail || "support@motivescripts.com",
    kind: input.kind,
  };
  drawBrandHeader(ctx, false);
  return ctx;
}

export function drawBrandHeader(ctx: PdfCtx, continuation: boolean) {
  const { page, font, bold, logo } = ctx;
  const lockup = Boolean(logo && logo.width / logo.height > 1.6);
  let logoHeight = 0;
  if (logo) {
    logoHeight = lockup ? 32 : 36;
    const width = Math.min(168, logoHeight * (logo.width / logo.height));
    page.drawImage(logo, { x: MARGIN, y: ctx.y - logoHeight, width, height: logoHeight });
    if (!lockup) {
      drawText(page, "MotiveScripts", MARGIN + width + 12, ctx.y - 14, bold, 16, NAVY);
    }
  } else {
    drawText(page, "MotiveScripts", MARGIN, ctx.y - 14, bold, 16, NAVY);
    logoHeight = 20;
  }
  const kindWidth = bold.widthOfTextAtSize(ctx.kind, 14);
  drawText(page, ctx.kind, PAGE_W - MARGIN - kindWidth, ctx.y - 12, bold, 14, BLUE);
  const emailY = ctx.y - logoHeight - 14;
  drawText(page, ctx.agencyEmail, MARGIN, emailY, font, 9, MUTED);
  ctx.y = emailY - 16;
  if (continuation) {
    drawText(page, "Continued", MARGIN, ctx.y, font, 9, MUTED);
    ctx.y -= 16;
  }
  page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness: 1,
    color: LINE,
  });
  ctx.y -= 18;
}

function drawFooterBar(page: PDFPage) {
  page.drawLine({
    start: { x: MARGIN, y: FOOTER_Y + 16 },
    end: { x: PAGE_W - MARGIN, y: FOOTER_Y + 16 },
    thickness: 0.5,
    color: LINE,
  });
}

export function addPage(ctx: PdfCtx) {
  drawFooterBar(ctx.page);
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
  drawBrandHeader(ctx, true);
}

export function ensureSpace(ctx: PdfCtx, needed: number) {
  if (ctx.y - needed < FOOTER_Y + 28) addPage(ctx);
}

export function drawHeading(ctx: PdfCtx, text: string) {
  ensureSpace(ctx, 20);
  drawText(ctx.page, text.toUpperCase(), MARGIN, ctx.y, ctx.bold, 8, MUTED);
  ctx.y -= 14;
}

export function drawBody(ctx: PdfCtx, text: string, size = 10, color = INK, lineHeight = 13) {
  const lines = wrapParagraph(text, ctx.font, size, PAGE_W - MARGIN * 2);
  for (const line of lines) {
    ensureSpace(ctx, lineHeight);
    drawText(ctx.page, line, MARGIN, ctx.y, ctx.font, size, color);
    ctx.y -= lineHeight;
  }
}

export function drawSection(ctx: PdfCtx, title: string, body: string) {
  if (!body.trim()) return;
  ctx.y -= 6;
  drawHeading(ctx, title);
  drawBody(ctx, body.trim(), 10, INK, 13);
  ctx.y -= 6;
}

export function drawNumberedSection(ctx: PdfCtx, title: string, body: string) {
  const items = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (items.length === 0) return;
  ctx.y -= 6;
  drawHeading(ctx, title);
  items.forEach((item, index) => {
    const prefix = `${index + 1}. `;
    const prefixWidth = ctx.font.widthOfTextAtSize(prefix, 10);
    const wrapped = wrapLine(item, ctx.font, 10, PAGE_W - MARGIN * 2 - prefixWidth);
    wrapped.forEach((line, lineIndex) => {
      ensureSpace(ctx, 13);
      drawText(
        ctx.page,
        lineIndex === 0 ? `${prefix}${line}` : line,
        lineIndex === 0 ? MARGIN : MARGIN + prefixWidth,
        ctx.y,
        ctx.font,
        10,
        INK,
      );
      ctx.y -= 13;
    });
  });
  ctx.y -= 6;
}

export async function finishPdf(ctx: PdfCtx): Promise<Uint8Array> {
  drawFooterBar(ctx.page);
  const pages = ctx.doc.getPages();
  const total = pages.length;
  pages.forEach((page: PDFPage, index: number) => {
    drawText(page, "Thank you for your business.", MARGIN, FOOTER_Y, ctx.font, 8, MUTED);
    const label = `Page ${index + 1} of ${total}`;
    const width = ctx.font.widthOfTextAtSize(label, 8);
    drawText(page, label, (PAGE_W - width) / 2, FOOTER_Y, ctx.font, 8, MUTED);
    drawText(page, "MotiveScripts", PAGE_W - MARGIN - 72, FOOTER_Y, ctx.font, 8, NAVY);
  });
  return await ctx.doc.save();
}

import { corsHeadersForRequest } from "./cors.ts";

export function pdfCorsHeaders(req: Request): Record<string, string> {
  return corsHeadersForRequest(req, {
    "Access-Control-Expose-Headers": "Content-Disposition, Content-Type",
  });
}

export function pdfJson(body: Record<string, unknown>, req: Request, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...pdfCorsHeaders(req), "Content-Type": "application/json" },
  });
}

export function pdfFail(error: string, req: Request, status = 200): Response {
  return pdfJson({ ok: false, error }, req, status);
}

export function pdfFileResponse(bytes: Uint8Array, filename: string, req: Request): Response {
  return new Response(bytes as BodyInit, {
    status: 200,
    headers: {
      ...pdfCorsHeaders(req),
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
