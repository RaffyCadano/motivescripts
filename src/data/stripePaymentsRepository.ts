import { invoiceErrorMessage } from "@/data/invoices";
import { AgencyDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export async function createCheckoutSession(invoiceId: string, amountCents?: number): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new AgencyDbError("Supabase is not configured.");
  }
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  const { data, error } = await client.functions.invoke("create-checkout-session", {
    body: {
      invoiceId,
      ...(amountCents != null ? { amountCents: Math.floor(amountCents) } : {}),
    },
  });
  if (error) {
    const message = (error.message ?? "").toLowerCase();
    if (message.includes("failed to fetch") || message.includes("network")) {
      throw new AgencyDbError(invoiceErrorMessage("network"), error);
    }
    throw new AgencyDbError(invoiceErrorMessage("not_payable"), error);
  }
  const payload = data as { ok?: boolean; url?: string; error?: string } | null;
  if (!payload?.ok || !payload.url) {
    throw new AgencyDbError(invoiceErrorMessage(payload?.error ?? "not_payable"));
  }
  if (!payload.url.startsWith("https://")) {
    throw new AgencyDbError(invoiceErrorMessage("not_payable"));
  }
  return payload.url;
}
