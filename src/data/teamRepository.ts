import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase } from "@/lib/supabase";
import { acceptErrorCode, invitationErrorMessage, isInviteToken, normalizeInviteEmail } from "@/data/invitation";
import {
  isStaffTemplateKey,
  previewStaffState,
  staffInvitationErrorMessage,
  type StaffPermissionOption,
  type StaffTemplateKey,
  type StaffTemplateOption,
  type TeamInvitation,
  type TeamMember,
} from "@/data/team";
import type {
  ActivityRow,
  ClientStaffAssignmentRow,
  ProjectStaffAssignmentRow,
  StaffGrantRow,
  StaffInvitationPreviewRow,
  StaffInvitationRow,
  StaffPermissionCatalogRow,
  StaffProfileRow,
  StaffTemplatePermissionRow,
  StaffTemplateRow,
} from "@/types/database";

function requireClient() {
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase isn’t connected yet.");
  return client;
}

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  throw new AgencyDbError(friendlyDbError(error, fallback), error);
}

export type TeamCatalog = {
  templates: StaffTemplateOption[];
  permissions: StaffPermissionOption[];
};

export type TeamDirectory = {
  members: TeamMember[];
  invitations: TeamInvitation[];
  catalog: TeamCatalog;
};

function templateLabel(templates: StaffTemplateRow[], key: string): string {
  return templates.find((item) => item.key === key)?.label ?? key;
}

function adminStaffFallback(profile: { id: string; created_at: string }): StaffProfileRow {
  return {
    user_id: profile.id,
    job_title: "",
    template_key: "admin",
    is_active: true,
    deactivated_at: null,
    last_active_at: null,
    created_at: profile.created_at,
    updated_at: profile.created_at,
    created_by: null,
  };
}

function mapMember(
  profile: { id: string; email: string | null; full_name: string; role: string; created_at: string },
  staff: StaffProfileRow,
  grants: StaffGrantRow[],
  clientAssignments: ClientStaffAssignmentRow[],
  projectAssignments: ProjectStaffAssignmentRow[],
  clients: Map<string, string>,
  projects: Map<string, string>,
  templates: StaffTemplateRow[],
  taskCounts: Map<string, { active: number; completed: number }>,
): TeamMember | null {
  if (profile.role !== "admin" && profile.role !== "staff") return null;
  if (!isStaffTemplateKey(staff.template_key)) return null;
  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email ?? "",
    role: profile.role,
    jobTitle: staff.job_title,
    templateKey: staff.template_key,
    templateLabel: templateLabel(templates, staff.template_key),
    isActive: staff.is_active,
    lastActiveAt: staff.last_active_at,
    createdAt: staff.created_at || profile.created_at,
    permissions: grants.filter((row) => row.user_id === profile.id).map((row) => row.permission_code),
    clientAssignments: clientAssignments
      .filter((row) => row.user_id === profile.id)
      .map((row) => ({
        id: row.id,
        entityId: row.client_id,
        entityName: clients.get(row.client_id) ?? "Client",
        userId: row.user_id,
        label: row.label,
      })),
    projectAssignments: projectAssignments
      .filter((row) => row.user_id === profile.id)
      .map((row) => ({
        id: row.id,
        entityId: row.project_id,
        entityName: projects.get(row.project_id) ?? "Project",
        userId: row.user_id,
        label: row.label,
      })),
    activeTaskCount: taskCounts.get(profile.id)?.active ?? 0,
    completedTaskCount: taskCounts.get(profile.id)?.completed ?? 0,
  };
}

function mapInvitation(row: Omit<StaffInvitationRow, "token_hash">, templates: StaffTemplateRow[]): TeamInvitation | null {
  if (!isStaffTemplateKey(row.template_key)) return null;
  return {
    id: row.id,
    email: row.email,
    inviteeName: row.invitee_name,
    jobTitle: row.job_title,
    templateKey: row.template_key,
    templateLabel: templateLabel(templates, row.template_key),
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    permissionCodes: row.permission_codes ?? [],
  };
}

export async function fetchTeamDirectory(): Promise<TeamDirectory> {
  const client = requireClient();
  const [
    profilesRes,
    staffRes,
    grantsRes,
    clientAssignRes,
    projectAssignRes,
    invitesRes,
    templatesRes,
    catalogRes,
    templatePermsRes,
    clientsRes,
    projectsRes,
    tasksRes,
  ] = await Promise.all([
    client.from("profiles").select("id, email, full_name, role, created_at").in("role", ["admin", "staff"]),
    client.from("staff_profiles").select("*"),
    client.from("staff_grants").select("*"),
    client.from("client_staff_assignments").select("*"),
    client.from("project_staff_assignments").select("*"),
    client.from("staff_invitations").select(
      "id, email, invitee_name, job_title, template_key, permission_codes, status, expires_at, accepted_at, accepted_user_id, created_at, created_by, revoked_at",
    ).order("created_at", { ascending: false }),
    client.from("staff_templates").select("*"),
    client.from("staff_permission_catalog").select("*").order("sort_order", { ascending: true }),
    client.from("staff_template_permissions").select("*"),
    client.from("clients").select("id, business_name"),
    client.from("projects").select("id, name"),
    client.from("tasks").select("assigned_to, status"),
  ]);

  if (profilesRes.error) fail("load team", profilesRes.error, "Unable to load the team.");
  if (staffRes.error) fail("load team", staffRes.error, "Unable to load the team.");
  if (grantsRes.error) fail("load team", grantsRes.error, "Unable to load the team.");
  if (clientAssignRes.error) fail("load team", clientAssignRes.error, "Unable to load the team.");
  if (projectAssignRes.error) fail("load team", projectAssignRes.error, "Unable to load the team.");
  if (invitesRes.error && invitesRes.error.code !== "42501") {
    fail("load invitations", invitesRes.error, "Unable to load invitations.");
  }
  if (templatesRes.error) fail("load team", templatesRes.error, "Unable to load the team.");
  if (catalogRes.error) fail("load team", catalogRes.error, "Unable to load the team.");
  if (templatePermsRes.error) fail("load team", templatePermsRes.error, "Unable to load the team.");

  const templates = (templatesRes.data ?? []) as StaffTemplateRow[];
  const staffById = new Map((staffRes.data ?? []).map((row) => [row.user_id, row as StaffProfileRow]));
  const clients = new Map((clientsRes.data ?? []).map((row) => [row.id, row.business_name]));
  const projects = new Map((projectsRes.data ?? []).map((row) => [row.id, row.name]));
  const grants = (grantsRes.data ?? []) as StaffGrantRow[];
  const clientAssignments = (clientAssignRes.data ?? []) as ClientStaffAssignmentRow[];
  const projectAssignments = (projectAssignRes.data ?? []) as ProjectStaffAssignmentRow[];
  const templatePerms = (templatePermsRes.data ?? []) as StaffTemplatePermissionRow[];

  const profileRows = (profilesRes.data ?? []) as {
    id: string;
    email: string | null;
    full_name: string;
    role: string;
    created_at: string;
  }[];
  const taskCounts = new Map<string, { active: number; completed: number }>();
  for (const row of tasksRes.data ?? []) {
    if (!row.assigned_to) continue;
    const current = taskCounts.get(row.assigned_to) ?? { active: 0, completed: 0 };
    if (row.status === "Completed") current.completed += 1;
    else current.active += 1;
    taskCounts.set(row.assigned_to, current);
  }

  const members = profileRows
    .map((profile) => {
      const staff = staffById.get(profile.id) ?? (profile.role === "admin" ? adminStaffFallback(profile) : null);
      if (!staff) return null;
      return mapMember(
        profile,
        staff,
        grants,
        clientAssignments,
        projectAssignments,
        clients,
        projects,
        templates,
        taskCounts,
      );
    })
    .filter((item): item is TeamMember => Boolean(item));

  const invitations = ((invitesRes.data ?? []) as Omit<StaffInvitationRow, "token_hash">[])
    .map((row) => mapInvitation(row, templates))
    .filter((item): item is TeamInvitation => Boolean(item));

  const catalog: TeamCatalog = {
    templates: templates
      .filter((row): row is StaffTemplateRow & { key: StaffTemplateKey } => isStaffTemplateKey(row.key))
      .map((row) => ({
        key: row.key,
        label: row.label,
        profileRole: row.profile_role,
        permissionCodes: templatePerms.filter((item) => item.template_key === row.key).map((item) => item.permission_code),
      })),
    permissions: ((catalogRes.data ?? []) as StaffPermissionCatalogRow[]).map((row) => ({
      code: row.code,
      label: row.label,
      sortOrder: row.sort_order,
    })),
  };

  return { members, invitations, catalog };
}

export async function fetchMyProjectAssignmentIds(userId: string): Promise<string[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("project_staff_assignments")
    .select("project_id")
    .eq("user_id", userId);
  if (error) fail("load assignments", error, "Unable to load your projects.");
  return (data ?? []).map((row) => row.project_id);
}

export async function updateMyTaskStatus(taskId: string, status: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("update_my_task_status", {
    p_task_id: taskId,
    p_status: status,
  });
  if (error) fail("update task", error, "Unable to update this task.");
}

export async function fetchMemberActivity(userId: string): Promise<{ id: string; message: string; createdAt: string }[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("activity")
    .select("id, message, created_at")
    .eq("actor_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return ((data ?? []) as Pick<ActivityRow, "id" | "message" | "created_at">[]).map((row) => ({
    id: row.id,
    message: row.message,
    createdAt: row.created_at,
  }));
}

export async function updateStaffMember(input: {
  userId: string;
  fullName?: string | null;
  jobTitle?: string | null;
  templateKey?: string | null;
  permissionCodes?: string[] | null;
  isActive?: boolean | null;
}): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("update_staff_member", {
    p_user_id: input.userId,
    p_full_name: input.fullName ?? undefined,
    p_job_title: input.jobTitle ?? undefined,
    p_template_key: input.templateKey ?? undefined,
    p_permission_codes: input.permissionCodes ?? undefined,
    p_is_active: input.isActive ?? undefined,
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("LAST_ADMIN")) {
      throw new AgencyDbError(staffInvitationErrorMessage("LAST_ADMIN"), error);
    }
    fail("update staff", error, "This team member could not be updated.");
  }
}

export async function assignStaffToClient(clientId: string, userId: string, label = ""): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("assign_staff_to_client", {
    p_client_id: clientId,
    p_user_id: userId,
    p_label: label,
  });
  if (error) fail("assign staff", error, "Unable to assign this team member.");
}

export async function unassignStaffFromClient(clientId: string, userId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("unassign_staff_from_client", {
    p_client_id: clientId,
    p_user_id: userId,
  });
  if (error) fail("unassign staff", error, "Unable to remove this team member.");
}

export async function assignStaffToProject(projectId: string, userId: string, label = ""): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("assign_staff_to_project", {
    p_project_id: projectId,
    p_user_id: userId,
    p_label: label,
  });
  if (error) fail("assign staff", error, "Unable to assign this team member.");
}

export async function unassignStaffFromProject(projectId: string, userId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("unassign_staff_from_project", {
    p_project_id: projectId,
    p_user_id: userId,
  });
  if (error) fail("unassign staff", error, "Unable to assign this team member.");
}

export async function previewStaffInvitation(token: string): Promise<{
  state: ReturnType<typeof previewStaffState>;
  roleLabel: string | null;
}> {
  if (!isInviteToken(token)) return { state: "invalid", roleLabel: null };
  const client = requireClient();
  const { data, error } = await client.rpc("preview_staff_invitation", { p_token: token.trim().toLowerCase() });
  if (error) throw new AgencyDbError(invitationErrorMessage("error"), error);
  const row = (Array.isArray(data) ? data[0] : data) as StaffInvitationPreviewRow | null;
  return { state: previewStaffState(row?.state), roleLabel: row?.role_label ?? null };
}

export async function staffInvitationEmailMatches(token: string, email: string): Promise<boolean | null> {
  if (!isInviteToken(token) || !email.trim()) return false;
  const client = requireClient();
  const { data, error } = await client.rpc("staff_invitation_email_matches", {
    p_token: token.trim().toLowerCase(),
    p_email: normalizeInviteEmail(email),
  });
  if (error) return null;
  return data === true;
}

export async function acceptStaffInvitation(token: string): Promise<void> {
  if (!isInviteToken(token)) throw new AgencyDbError(invitationErrorMessage("INVALID_INVITE"));
  const client = requireClient();
  const { error } = await client.rpc("accept_staff_invitation", { p_token: token.trim().toLowerCase() });
  if (error) {
    logDbError("accept staff invitation", error);
    throw new AgencyDbError(invitationErrorMessage(acceptErrorCode(error.message ?? "")), error);
  }
}

type StaffInviteAction = "send" | "resend" | "revoke";

type StaffInviteBody = {
  action: StaffInviteAction;
  email?: string;
  fullName?: string;
  jobTitle?: string;
  templateKey?: StaffTemplateKey;
  permissionCodes?: string[];
  invitationId?: string;
};

async function invokeStaffInvitation(body: StaffInviteBody): Promise<string | undefined> {
  const client = requireClient();
  const { data, error } = await client.functions.invoke("staff-invitation", { body });

  if (error) {
    const context =
      error && typeof error === "object" && "context" in error
        ? (error as { context?: { json?: () => Promise<unknown> } }).context
        : undefined;
    let code = "error";
    if (context && typeof context.json === "function") {
      try {
        const parsed = (await context.json()) as { error?: string };
        if (parsed?.error) code = parsed.error;
      } catch {
        /* ignore */
      }
    }
    const message = (error.message ?? "").toLowerCase();
    if (message.includes("failed to fetch") || message.includes("network")) code = "network";
    if (message.includes("not valid") || message.includes("jwt") || message.includes("401")) code = "not_allowed";
    throw new AgencyDbError(staffInvitationErrorMessage(code), error);
  }

  const payload = data as { ok?: boolean; error?: string; invitationId?: string } | null;
  if (!payload?.ok) {
    throw new AgencyDbError(staffInvitationErrorMessage(payload?.error ?? "error"));
  }
  return payload.invitationId;
}

export async function sendStaffInvitation(input: {
  email: string;
  fullName: string;
  jobTitle?: string;
  templateKey: StaffTemplateKey;
  permissionCodes?: string[];
  action?: "send" | "resend";
}): Promise<string | undefined> {
  return invokeStaffInvitation({
    action: input.action ?? "send",
    email: normalizeInviteEmail(input.email),
    fullName: input.fullName.trim(),
    jobTitle: input.jobTitle?.trim() || undefined,
    templateKey: input.templateKey,
    permissionCodes: input.permissionCodes,
  });
}

export async function revokeStaffInvitation(invitationId: string): Promise<void> {
  await invokeStaffInvitation({ action: "revoke", invitationId });
}
