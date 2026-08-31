import { invoiceErrorMessage } from "@/data/invoices";
import { AgencyDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

async function functionErrorCode(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object" || !("context" in error)) return null;
  const context = (error as { context?: unknown }).context;
  if (!context || typeof context !== "object" || !("json" in context)) return null;
  const json = (context as { json?: unknown }).json;
  if (typeof json !== "function") return null;
  try {
    const body = (await json.call(context)) as { error?: string };
    return typeof body?.error === "string" && body.error ? body.error : null;
  } catch {
    return null;
  }
}

export async function createCheckoutSession(invoiceId: string): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new AgencyDbError("Supabase is not configured.");
  }
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  const { data, error } = await client.functions.invoke("create-checkout-session", {
    body: { invoiceId },
  });
  if (error) {
    const code = await functionErrorCode(error);
    if (code) throw new AgencyDbError(invoiceErrorMessage(code), error);
    const message = (error.message ?? "").toLowerCase();
    if (message.includes("failed to fetch") || message.includes("network")) {
      throw new AgencyDbError(invoiceErrorMessage("network"), error);
    }
    if (message.includes("not found") || message.includes("404")) {
      throw new AgencyDbError(invoiceErrorMessage("checkout_unavailable"), error);
    }
    throw new AgencyDbError(invoiceErrorMessage("not_payable"), error);
  }
  const payload = data as { ok?: boolean; url?: string; error?: string } | null;
  if (!payload?.ok || !payload.url) {
    throw new AgencyDbError(invoiceErrorMessage(payload?.error ?? "not_payable"));
  }
  if (!payload.url.startsWith("https://checkout.stripe.com/") && !payload.url.startsWith("https://")) {
    throw new AgencyDbError(invoiceErrorMessage("not_payable"));
  }
  return payload.url;
}
