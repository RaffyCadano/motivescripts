declare namespace Deno {
  function readFile(path: string | URL): Promise<Uint8Array>;
  const env: { get(key: string): string | undefined };
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

// Editor-only shim: `npm:` specifiers are Deno-runtime syntax that plain tsc/VSCode
// TypeScript can't resolve. This mirrors the actual @supabase/supabase-js@2 shape
// closely enough for type-checking in this Deno function folder; the real package
// is fetched by the Deno runtime at deploy/run time, not by this declaration.
declare module "npm:@supabase/supabase-js@2" {
  export type PostgrestError = { message: string; code?: string };
  export type AuthError = { message: string };

  export type PostgrestResponse<T> = { data: T | null; error: PostgrestError | null };
  export type PostgrestSingleResponse<T> = { data: T | null; error: PostgrestError | null };

  export interface PostgrestFilterBuilder<T = unknown> extends PromiseLike<PostgrestResponse<T>> {
    eq(column: string, value: unknown): this;
    in(column: string, values: unknown[]): this;
    ilike(column: string, pattern: string): this;
    limit(count: number): this;
    select(columns?: string): this;
    maybeSingle(): Promise<PostgrestSingleResponse<T>>;
    single(): Promise<PostgrestSingleResponse<T>>;
  }

  export interface PostgrestQueryBuilder<T = unknown> {
    select(columns?: string): PostgrestFilterBuilder<T>;
    insert(values: Record<string, unknown> | Record<string, unknown>[]): PostgrestFilterBuilder<T>;
    update(values: Record<string, unknown>): PostgrestFilterBuilder<T>;
    delete(): PostgrestFilterBuilder<T>;
  }

  export interface GoTrueAdminApi {
    createUser(attrs: {
      email: string;
      email_confirm?: boolean;
      user_metadata?: Record<string, unknown>;
    }): Promise<{ data: unknown; error: AuthError | null }>;
  }

  export interface SupabaseAuthClient {
    getUser(): Promise<{ data: { user: { id: string } | null }; error: AuthError | null }>;
    admin: GoTrueAdminApi;
  }

  export interface SupabaseClient {
    from(table: string): PostgrestQueryBuilder;
    rpc(fn: string, params?: Record<string, unknown>): PostgrestFilterBuilder;
    auth: SupabaseAuthClient;
  }

  export function createClient(
    url: string,
    key: string,
    options?: {
      global?: { headers?: Record<string, string> };
      auth?: { persistSession?: boolean; autoRefreshToken?: boolean };
    },
  ): SupabaseClient;
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
