import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersForRequest } from "../_shared/cors.ts";
import { generateInvoicePdf, invoicePdfFilename } from "../_shared/invoicePdf.ts";
import { clientMayAccessInvoice, loadInvoicePdfModel } from "../_shared/loadInvoicePdf.ts";

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersForRequest(req, {
    "Access-Control-Expose-Headers": "Content-Disposition, Content-Type",
  });
  const json = (body: Record<string, unknown>, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  const fail = (error: string, status = 200): Response => json({ ok: false, error }, status);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("invalid_action", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("invoice-pdf missing supabase env");
    return fail("server_error", 500);
  }

  let invoiceId = "";
  try {
    const body = (await req.json()) as { invoiceId?: string };
    invoiceId = (body.invoiceId ?? "").trim();
  } catch {
    return fail("invalid_action");
  }
  if (!invoiceId) return fail("invalid_action");

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return fail("not_allowed", 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile } = await admin.from("profiles").select("role, client_id").eq("id", user.id).maybeSingle();
  if (!profile) return fail("not_allowed", 403);

  const { data: invoice } = await admin.from("invoices").select("id, client_id, status").eq("id", invoiceId).maybeSingle();
  if (!invoice) return fail("not_found");

  if (profile.role === "admin" || profile.role === "staff") {
    const { data } = await userClient.rpc("staff_can_access_client", {
      p_client_id: invoice.client_id,
      p_perm: "invoices.view",
    });
    if (data !== true) return fail("not_found");
  } else if (profile.role === "client") {
    if (!profile.client_id || profile.client_id !== invoice.client_id) return fail("not_found");
    if (!clientMayAccessInvoice(invoice.status)) return fail("not_found");
  } else {
    return fail("not_allowed", 403);
  }

  const audience = profile.role === "client" ? "client" : "admin";
  try {
    const model = await loadInvoicePdfModel(admin, invoice.id, audience);
    if (!model) return fail("not_found");
    const bytes = await generateInvoicePdf(model);
    const filename = invoicePdfFilename(model.number);
    console.log("invoice-pdf generated", { invoice_id: invoice.id });
    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (caught) {
    console.error("invoice-pdf failed", caught instanceof Error ? caught.message : "unknown");
    return fail("pdf_failed", 500);
  }
});
