import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersForRequest } from "../_shared/cors.ts";

/**
 * Removes the stored files that belong to a client, as the first half of "delete a client and everything".
 *
 * Only an admin, signed in with their own session, can call it, and only when every guard of the deletion passes. The file list comes from the database
 * (admin_client_storage_paths) and the files are removed through the Storage API, because Storage does not
 * allow deleting files with SQL. The admin's browser then calls admin_delete_client to delete the records.
 * It deletes files only; nothing in the database is touched here.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "project-files";
const CHUNK = 100;

Deno.serve(async (req) => {
  const cors = corsHeadersForRequest(req);
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "invalid_action" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("admin-client-files missing supabase env");
    return json({ ok: false, error: "server_error" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.replace(/^Bearer\s+/i, "").trim()) return json({ ok: false, error: "not_allowed" }, 403);

  let body: { clientId?: string; businessName?: string; leaveWebsiteLive?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_action" }, 400);
  }
  const clientId = (body.clientId ?? "").trim();
  if (!UUID.test(clientId)) return json({ ok: false, error: "invalid_action" }, 400);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return json({ ok: false, error: "not_allowed" }, 401);
  const { data: isAdmin } = await userClient.rpc("is_admin");
  if (isAdmin !== true) return json({ ok: false, error: "not_allowed" }, 403);

  // Every guard (typed name, active plan, live website) is checked first, so a refused deletion never removes files.
  const { error: checkError } = await userClient.rpc("admin_client_delete_check", {
    p_client_id: clientId,
    p_confirmation: body.businessName ?? "",
    p_leave_website_live: body.leaveWebsiteLive === true,
  });
  if (checkError) return json({ ok: false, error: "refused", message: checkError.message });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: paths, error: pathsError } = await admin.rpc("admin_client_storage_paths", { p_client_id: clientId });
  if (pathsError) {
    console.error("admin-client-files paths failed", { message: pathsError.message });
    return json({ ok: false, error: "server_error" }, 500);
  }

  const all = ((paths ?? []) as string[]).filter((path) => typeof path === "string" && path.length > 0);
  let removed = 0;
  let failed = 0;
  for (let index = 0; index < all.length; index += CHUNK) {
    const chunk = all.slice(index, index + CHUNK);
    const { data, error } = await admin.storage.from(BUCKET).remove(chunk);
    if (error) {
      failed += chunk.length;
      console.error("admin-client-files remove failed", { message: error.message });
    } else {
      removed += data?.length ?? 0;
    }
  }

  console.log("admin-client-files", { client_id: clientId, requested: all.length, removed, failed });
  return json({ ok: failed === 0, requested: all.length, removed, failed });
});
