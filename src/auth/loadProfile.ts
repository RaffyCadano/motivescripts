import { isAppRole, isAgencyRole, type AppRole } from "@/auth/roles";
import { getSupabase } from "@/lib/supabase";
import type { Json, ProfileRow } from "@/types/database";

export type ProfileStatus = "idle" | "loading" | "ready" | "missing" | "error";

export type AppProfile = {
  id: string;
  email: string | null;
  fullName: string;
  role: AppRole;
  clientId: string | null;
  isActive: boolean;
  jobTitle: string;
  templateKey: string | null;
  permissions: string[];
};

export type ProfileLoadResult =
  | { status: "ready"; profile: AppProfile }
  | { status: "missing" }
  | { status: "error" };

type StaffContext = {
  is_active?: boolean;
  job_title?: string;
  template_key?: string | null;
  permissions?: Json;
};

function permissionList(value: Json | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapProfile(row: ProfileRow, context: StaffContext | null): AppProfile | null {
  if (!isAppRole(row.role)) return null;
  const agency = isAgencyRole(row.role);
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    clientId: row.client_id,
    isActive: agency ? Boolean(context?.is_active) : true,
    jobTitle: typeof context?.job_title === "string" ? context.job_title : "",
    templateKey: typeof context?.template_key === "string" ? context.template_key : null,
    permissions: agency ? permissionList(context?.permissions) : [],
  };
}

async function loadStaffContextFallback(userId: string): Promise<StaffContext | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const [{ data: staff }, { data: grants }] = await Promise.all([
    supabase.from("staff_profiles").select("is_active, job_title, template_key").eq("user_id", userId).maybeSingle(),
    supabase.from("staff_grants").select("permission_code").eq("user_id", userId),
  ]);
  if (!staff && (!grants || grants.length === 0)) return null;
  return {
    is_active: staff?.is_active,
    job_title: staff?.job_title,
    template_key: staff?.template_key,
    permissions: (grants ?? []).map((row) => row.permission_code),
  };
}

export async function loadCurrentProfile(userId?: string): Promise<ProfileLoadResult> {
  const supabase = getSupabase();
  if (!supabase) return { status: "error" };

  let id = userId?.trim() || "";
  if (!id) {
    const { data: sessionData } = await supabase.auth.getSession();
    id = sessionData.session?.user.id ?? "";
  }
  if (!id) return { status: "missing" };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, client_id, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) return { status: "error" };
  if (!data) return { status: "missing" };

  let context: StaffContext | null = null;
  if (isAgencyRole(data.role)) {
    const { data: ctx, error: ctxError } = await supabase.rpc("current_staff_context");
    if (!ctxError && ctx) {
      context = ctx as StaffContext;
    }
    const fallback = await loadStaffContextFallback(id);
    if (fallback) {
      const rpcPermissions = permissionList(context?.permissions);
      context = {
        is_active: context?.is_active ?? fallback.is_active,
        job_title: context?.job_title || fallback.job_title || "",
        template_key: context?.template_key ?? fallback.template_key ?? null,
        permissions: rpcPermissions.length > 0 ? rpcPermissions : fallback.permissions,
      };
    } else if (ctxError) {
      context = null;
    }
  }

  const profile = mapProfile(data, context);
  if (!profile) return { status: "missing" };
  return { status: "ready", profile };
}
