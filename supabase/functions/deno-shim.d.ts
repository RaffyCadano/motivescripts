declare namespace Deno {
  function readFile(path: string | URL): Promise<Uint8Array>;
  const env: { get(key: string): string | undefined };
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module "npm:pdf-lib@1.17.1" {
  export type PDFFont = {
    widthOfTextAtSize(text: string, size: number): number;
  };
  export type PDFImage = {
    width: number;
    height: number;
  };
  export type PDFPage = {
    drawText(text: string, options: Record<string, unknown>): void;
    drawImage(image: PDFImage, options: Record<string, unknown>): void;
    drawLine(options: Record<string, unknown>): void;
  };
  export const StandardFonts: { Helvetica: unknown; HelveticaBold: unknown };
  export function rgb(r: number, g: number, b: number): unknown;
  export class PDFDocument {
    static create(): Promise<PDFDocument>;
    setTitle(value: string): void;
    setAuthor(value: string): void;
    setCreator(value: string): void;
    setSubject(value: string): void;
    embedFont(font: unknown): Promise<PDFFont>;
    embedPng(bytes: Uint8Array): Promise<PDFImage>;
    addPage(size: [number, number]): PDFPage;
    getPages(): PDFPage[];
    save(): Promise<Uint8Array>;
  }
}
