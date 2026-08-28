import { AgencyDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf?.[1]) return decodeURIComponent(utf[1]);
  const quoted = header.match(/filename="([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];
  const plain = header.match(/filename=([^;]+)/i);
  if (plain?.[1]) return plain[1].trim();
  return fallback;
}

export async function downloadAuthenticatedPdf(input: {
  functionName: string;
  body: Record<string, string>;
  fallbackFilename: string;
  notAllowedMessage: string;
  networkMessage: string;
  failedMessage: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new AgencyDbError("Supabase is not configured.");
  }
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new AgencyDbError(input.notAllowedMessage);
  const url = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  const anon =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
    "";
  if (!url || !anon) throw new AgencyDbError("Supabase is not configured.");
  let response: Response;
  try {
    response = await fetch(`${url}/functions/v1/${input.functionName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anon,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.body),
    });
  } catch (error) {
    throw new AgencyDbError(input.networkMessage, error);
  }
  const type = (response.headers.get("Content-Type") ?? "").toLowerCase();
  if (!response.ok || !type.includes("application/pdf")) {
    throw new AgencyDbError(input.failedMessage);
  }
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 5 || String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") {
    throw new AgencyDbError(input.failedMessage);
  }
  const filename = filenameFromDisposition(response.headers.get("Content-Disposition"), input.fallbackFilename);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
