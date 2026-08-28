import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { pdfCorsHeaders, pdfFail } from "./pdfLayout.ts";

export type PdfProfile = { role: string; client_id: string | null };

export async function requirePdfUser(req: Request): Promise<
  | { ok: true; admin: SupabaseClient; userClient: SupabaseClient; profile: PdfProfile }
  | { ok: false; response: Response }
> {
  if (req.method === "OPTIONS") {
    return { ok: false, response: new Response("ok", { headers: pdfCorsHeaders(req) }) };
  }
  if (req.method !== "POST") {
    return { ok: false, response: pdfFail("invalid_action", req, 405) };
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("pdf function missing supabase env");
    return { ok: false, response: pdfFail("server_error", req, 500) };
  }
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return { ok: false, response: pdfFail("not_allowed", req, 401) };
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile } = await admin.from("profiles").select("role, client_id").eq("id", user.id).maybeSingle();
  if (!profile) {
    return { ok: false, response: pdfFail("not_allowed", req, 403) };
  }
  return {
    ok: true,
    admin,
    userClient,
    profile: { role: String(profile.role), client_id: profile.client_id ? String(profile.client_id) : null },
  };
}

export async function authorizeOwnedDocument(
  req: Request,
  userClient: SupabaseClient,
  profile: PdfProfile,
  ownerClientId: string,
  clientAllowed: boolean,
  staffPerm: string,
): Promise<Response | null> {
  if (profile.role === "admin" || profile.role === "staff") {
    const { data } = await userClient.rpc("staff_can_access_client", {
      p_client_id: ownerClientId,
      p_perm: staffPerm,
    });
    if (data === true) return null;
    return pdfFail("not_found", req);
  }
  if (profile.role === "client") {
    if (!profile.client_id || profile.client_id !== ownerClientId || !clientAllowed) {
      return pdfFail("not_found", req);
    }
    return null;
  }
  return pdfFail("not_allowed", req, 403);
}
