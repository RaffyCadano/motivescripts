import type { AgencyClient, AgencyClientDraft, AgencyClientEdits, AgencyClientStatus } from "@/data/agencyClients";
import {
  mapActivity,
  mapApproval,
  mapClient,
  mapDeliverableWithCurrent,
  mapFeedback,
  mapLead,
  mapMilestone,
  mapProject,
  mapTask,
  mapVersion,
  emptyToNull,
} from "@/data/agencyMappers";
import type { AgencyDeliverable, DeliverableDraft } from "@/data/files";
import { fileTypeFromName } from "@/data/files";
import { validateUploadFile } from "@/data/fileUploadConfig";
import { tryRemoveProjectFile, uploadProjectFile } from "@/data/fileStorage";
import { createRecordId, type Lead, type LeadDraft, type LeadStatus } from "@/data/leads";
import type {
  AgencyMilestoneDraft,
  AgencyProject,
  AgencyProjectActivity,
  AgencyProjectDraft,
  AgencyProjectStatus,
  AgencyTaskDraft,
} from "@/data/agencyProjects";
import type { ReviewApproval, ReviewFeedback } from "@/data/review";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { ActivityRow, FileVersionRow, Json, LeadRow, ClientRow, ClientStaffDataRow, ProfileRow, Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/auth/roles";
import { isAgencyRole } from "@/auth/roles";

export type PortalAccount = {
  id: string;
  email: string | null;
  fullName: string;
  role: AppRole;
  clientId: string | null;
};

export type AgencySnapshot = {
  leads: Lead[];
  clients: AgencyClient[];
  projects: AgencyProject[];
  deliverables: AgencyDeliverable[];
  feedback: ReviewFeedback[];
  approvals: ReviewApproval[];
  portalAccounts: PortalAccount[];
};

export { AgencyDbError };

function db(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new AgencyDbError("Supabase is not configured. Add VITE_SUPABASE_URL and the publishable key.");
  }
  const client = getSupabase();
  if (!client) {
    throw new AgencyDbError("Supabase is not configured. Add VITE_SUPABASE_URL and the publishable key.");
  }
  return client;
}

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  throw new AgencyDbError(friendlyDbError(error, fallback), error);
}

function throwIf(error: unknown, context: string, fallback: string) {
  if (error) fail(context, error, fallback);
}

function mapPortalAccount(row: Pick<ProfileRow, "id" | "email" | "full_name" | "role" | "client_id">): PortalAccount {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role === "admin" ? "admin" : row.role === "staff" ? "staff" : "client",
    clientId: row.client_id,
  };
}

export async function fetchAgencySnapshot(role: AppRole): Promise<AgencySnapshot> {
  const client = db();
  const empty = { data: [] as never[], error: null };
  const [
    leadsRes,
    clientsRes,
    staffRes,
    profilesRes,
    projectsRes,
    milestonesRes,
    tasksRes,
    deliverablesRes,
    versionsRes,
    feedbackRes,
    approvalsRes,
    activityRes,
  ] = await Promise.all([
    isAgencyRole(role) ? client.from("leads").select("*").order("created_at", { ascending: false }) : Promise.resolve(empty),
    client.from("clients").select("*").order("created_at", { ascending: false }),
    isAgencyRole(role) ? client.from("client_staff_data").select("*") : Promise.resolve(empty),
    isAgencyRole(role) ? client.from("profiles").select("id, email, full_name, role, client_id") : Promise.resolve(empty),
    client.from("projects").select("*").order("last_activity_at", { ascending: false }),
    client.from("milestones").select("*").order("position", { ascending: true }),
    client.from("tasks").select("*").order("created_at", { ascending: false }),
    client.from("deliverables").select("*").order("updated_at", { ascending: false }),
    client.from("file_versions").select("*").order("version_number", { ascending: true }),
    client.from("feedback").select("*").order("created_at", { ascending: false }),
    client.from("approvals").select("*").order("approved_at", { ascending: false }),
    client.from("activity").select("*").order("created_at", { ascending: false }),
  ]);

  throwIf(leadsRes.error, "load leads", "Unable to load leads.");
  throwIf(clientsRes.error, "load clients", "Unable to load clients.");
  throwIf(staffRes.error, "load clients", "Unable to load clients.");
  throwIf(profilesRes.error, "load accounts", "Unable to load client accounts.");
  throwIf(projectsRes.error, "load projects", "Unable to load projects.");
  throwIf(milestonesRes.error, "load milestones", "Unable to load projects.");
  throwIf(tasksRes.error, "load tasks", "Unable to load projects.");
  throwIf(deliverablesRes.error, "load deliverables", "Unable to load files.");
  throwIf(versionsRes.error, "load versions", "Unable to load files.");
  throwIf(feedbackRes.error, "load feedback", "Unable to load feedback.");
  throwIf(approvalsRes.error, "load approvals", "Unable to load approvals.");
  throwIf(activityRes.error, "load activity", "Unable to load projects.");

  const milestonesByProject = new Map<string, ReturnType<typeof mapMilestone>[]>();
  for (const row of milestonesRes.data ?? []) {
    const list = milestonesByProject.get(row.project_id) ?? [];
    list.push(mapMilestone(row));
    milestonesByProject.set(row.project_id, list);
  }
  const tasksByProject = new Map<string, ReturnType<typeof mapTask>[]>();
  for (const row of tasksRes.data ?? []) {
    const list = tasksByProject.get(row.project_id) ?? [];
    list.push(mapTask(row));
    tasksByProject.set(row.project_id, list);
  }
  const activityByProject = new Map<string, AgencyProjectActivity[]>();
  for (const row of activityRes.data ?? []) {
    const list = activityByProject.get(row.project_id) ?? [];
    list.push(mapActivity(row as ActivityRow));
    activityByProject.set(row.project_id, list);
  }

  const versionsByDeliverable = new Map<string, { mapped: ReturnType<typeof mapVersion>; current: boolean }[]>();
  for (const row of versionsRes.data ?? []) {
    const list = versionsByDeliverable.get(row.deliverable_id) ?? [];
    list.push({ mapped: mapVersion(row), current: row.is_current });
    versionsByDeliverable.set(row.deliverable_id, list);
  }

  const staffByClient = new Map<string, ClientStaffDataRow>();
  for (const row of (staffRes.data ?? []) as ClientStaffDataRow[]) {
    staffByClient.set(row.client_id, row);
  }

  return {
    leads: (leadsRes.data ?? []).map(mapLead),
    clients: (clientsRes.data ?? []).map((row) => mapClient(row, staffByClient.get(row.id) ?? null)),
    portalAccounts: ((profilesRes.data ?? []) as Pick<ProfileRow, "id" | "email" | "full_name" | "role" | "client_id">[]).map(
      mapPortalAccount,
    ),
    projects: (projectsRes.data ?? []).map((row) =>
      mapProject(
        row,
        milestonesByProject.get(row.id) ?? [],
        tasksByProject.get(row.id) ?? [],
        activityByProject.get(row.id) ?? [],
      ),
    ),
    deliverables: (deliverablesRes.data ?? []).map((row) => {
      const versions = versionsByDeliverable.get(row.id) ?? [];
      return mapDeliverableWithCurrent(
        row,
        versions.map((item) => item.mapped),
        versions.find((item) => item.current)?.mapped.id ?? null,
      );
    }),
    feedback: (feedbackRes.data ?? []).map(mapFeedback),
    approvals: (approvalsRes.data ?? []).map(mapApproval),
  };
}

export async function addActivity(
  projectId: string,
  activityType: string,
  message: string,
  icon: AgencyProjectActivity["icon"],
  extra: Record<string, string> = {},
) {
  const client = db();
  const { error } = await client.from("activity").insert({
    project_id: projectId,
    activity_type: activityType,
    message,
    metadata: { icon, ...extra } as Json,
  });
  throwIf(error, "activity", "Unable to save activity.");
  await client.from("projects").update({ last_activity_at: new Date().toISOString() }).eq("id", projectId);
}

export async function insertLead(draft: LeadDraft): Promise<Lead> {
  const client = db();
  const now = new Date().toISOString();
  const activity = [{ id: createRecordId("act"), description: "Lead added manually", createdAt: now }];
  const { data, error } = await client
    .from("leads")
    .insert({
      name: draft.name.trim(),
      business_name: draft.businessName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim() || "—",
      industry: draft.industry,
      request: draft.request.trim(),
      project_details: draft.projectDetails.trim(),
      status: "New",
      source: "Manual",
      notes: [],
      activity,
    })
    .select("*")
    .single();
  throwIf(error, "create lead", "Unable to create lead.");
  if (!data) fail("create lead", null, "Unable to create lead.");
  return mapLead(data as LeadRow);
}

export async function updateLeadStatus(id: string, status: LeadStatus, activity: Lead["activity"]): Promise<void> {
  const client = db();
  const { error } = await client
    .from("leads")
    .update({ status, activity: activity as unknown as Json })
    .eq("id", id);
  throwIf(error, "update lead", "Unable to update lead.");
}

export async function updateLeadJson(
  id: string,
  patch: { notes?: Lead["notes"]; activity?: Lead["activity"] },
): Promise<void> {
  const client = db();
  const { error } = await client
    .from("leads")
    .update({
      ...(patch.notes ? { notes: patch.notes as unknown as Json } : {}),
      ...(patch.activity ? { activity: patch.activity as unknown as Json } : {}),
    })
    .eq("id", id);
  throwIf(error, "update lead", "Unable to save lead.");
}

export async function markLeadConverted(leadId: string, clientId: string, activity: Lead["activity"]): Promise<void> {
  const client = db();
  const { error } = await client
    .from("leads")
    .update({
      status: "Won",
      client_id: clientId,
      converted_at: new Date().toISOString(),
      activity: activity as unknown as Json,
    })
    .eq("id", leadId);
  throwIf(error, "convert lead", "Unable to convert lead.");
}

export async function convertLeadToClient(lead: Lead): Promise<string> {
  const client = db();
  if (lead.convertedClientId) return lead.convertedClientId;

  const now = new Date().toISOString();
  const { data: created, error: clientError } = await client
    .from("clients")
    .insert({
      contact_name: lead.name,
      business_name: lead.businessName,
      email: lead.email,
      phone: lead.phone,
      industry: lead.industry,
      website: "",
      location: "",
      status: "Active",
      source: lead.source,
      source_lead_id: lead.id,
    })
    .select("*")
    .single();
  throwIf(clientError, "convert lead", "Unable to convert lead.");
  if (!created) fail("convert lead", null, "Unable to convert lead.");

  const clientId = (created as ClientRow).id;
  const { error: staffError } = await client.from("client_staff_data").update({
    activity: [
      { id: createRecordId("cact"), description: "Client converted from lead", createdAt: now, icon: "converted" },
      { id: createRecordId("cact"), description: "Client record created", createdAt: now, icon: "created" },
    ] as unknown as Json,
  }).eq("client_id", clientId);
  throwIf(staffError, "convert lead", "Unable to convert lead.");
  const { error: leadError } = await client
    .from("leads")
    .update({
      status: "Won",
      client_id: clientId,
      converted_at: now,
      activity: [
        { id: createRecordId("act"), description: "Lead converted to client", createdAt: now },
        ...lead.activity,
      ] as unknown as Json,
    })
    .eq("id", lead.id);
  throwIf(leadError, "convert lead", "Unable to convert lead.");
  return clientId;
}

export async function insertClient(draft: AgencyClientDraft): Promise<AgencyClient> {
  const client = db();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("clients")
    .insert({
      contact_name: draft.contactName.trim(),
      business_name: draft.businessName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim() || "—",
      industry: draft.industry,
      website: draft.website.trim(),
      location: draft.location.trim(),
      status: "Active",
      source: "Manual",
    })
    .select("*")
    .single();
  throwIf(error, "create client", "Unable to create client.");
  if (!data) fail("create client", null, "Unable to create client.");
  const { error: staffError } = await client.from("client_staff_data").update({
    activity: [{ id: createRecordId("cact"), description: "Client record created", createdAt: now, icon: "created" }] as unknown as Json,
  }).eq("client_id", data.id);
  throwIf(staffError, "create client", "Unable to create client.");
  return mapClient(data as ClientRow, {
    client_id: data.id,
    notes: [],
    activity: [{ id: createRecordId("cact"), description: "Client record created", createdAt: now, icon: "created" }],
    invoices: [],
    messages: [],
  });
}

export async function updateClientRecord(
  id: string,
  edits: AgencyClientEdits,
  activity: AgencyClient["activity"],
  lastActivityAt: string,
): Promise<void> {
  const client = db();
  const { error } = await client
    .from("clients")
    .update({
      contact_name: edits.contactName.trim(),
      business_name: edits.businessName.trim(),
      email: edits.email.trim(),
      phone: edits.phone.trim() || "—",
      industry: edits.industry,
      website: edits.website.trim(),
      location: edits.location.trim(),
      status: edits.status,
      last_activity_at: lastActivityAt,
    })
    .eq("id", id);
  throwIf(error, "update client", "Unable to update client.");
  const { error: staffError } = await client
    .from("client_staff_data")
    .update({ activity: activity as unknown as Json })
    .eq("client_id", id);
  throwIf(staffError, "update client", "Unable to update client.");
}

export async function updateClientFields(
  id: string,
  patch: {
    status?: AgencyClientStatus;
    notes?: AgencyClient["notes"];
    activity?: AgencyClient["activity"];
    last_activity_at?: string;
  },
): Promise<void> {
  const client = db();
  if (patch.status || patch.last_activity_at) {
    const { error } = await client
      .from("clients")
      .update({
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.last_activity_at ? { last_activity_at: patch.last_activity_at } : {}),
      })
      .eq("id", id);
    throwIf(error, "update client", "Unable to update client.");
  }
  if (patch.notes || patch.activity) {
    const { error } = await client
      .from("client_staff_data")
      .update({
        ...(patch.notes ? { notes: patch.notes as unknown as Json } : {}),
        ...(patch.activity ? { activity: patch.activity as unknown as Json } : {}),
      })
      .eq("client_id", id);
    throwIf(error, "update client", "Unable to update client.");
  }
}

const defaultMilestones = [
  { name: "Discovery", description: "Scope, goals, and content gathering." },
  { name: "Design", description: "Layout, visual system, and page structure." },
  { name: "Development", description: "Build, integrate, and refine the site." },
  { name: "Client Review", description: "Client feedback, revisions, and approval." },
  { name: "Launch", description: "Final QA, go-live, and handoff." },
];

export async function insertProject(draft: AgencyProjectDraft): Promise<string> {
  const client = db();
  const { data, error } = await client
    .from("projects")
    .insert({
      client_id: draft.clientId,
      name: draft.name.trim(),
      description: draft.description.trim(),
      type: draft.type,
      status: draft.status,
      start_date: emptyToNull(draft.startDate) ?? new Date().toISOString().slice(0, 10),
      due_date: emptyToNull(draft.targetLaunchDate),
      archived: false,
      approval_status: "Pending",
    })
    .select("id")
    .single();
  throwIf(error, "create project", "Unable to create project.");
  if (!data) fail("create project", null, "Unable to create project.");
  const projectId = data.id;
  const { error: msError } = await client.from("milestones").insert(
    defaultMilestones.map((item, index) => ({
      project_id: projectId,
      name: item.name,
      description: item.description,
      status: "Not Started" as const,
      position: index + 1,
    })),
  );
  throwIf(msError, "create milestones", "Unable to create project.");
  await addActivity(projectId, "project_created", "Project created", "created");
  return projectId;
}

export async function updateProjectRecord(id: string, edits: AgencyProjectDraft): Promise<void> {
  const client = db();
  const { error } = await client
    .from("projects")
    .update({
      name: edits.name.trim(),
      client_id: edits.clientId,
      type: edits.type,
      description: edits.description.trim(),
      status: edits.status,
      start_date: emptyToNull(edits.startDate),
      due_date: emptyToNull(edits.targetLaunchDate),
    })
    .eq("id", id);
  throwIf(error, "update project", "Unable to update project.");
  await addActivity(id, "status_changed", "Project details updated", "status");
}

export async function updateProjectStatus(id: string, status: AgencyProjectStatus): Promise<void> {
  const client = db();
  const { error } = await client.from("projects").update({ status }).eq("id", id);
  throwIf(error, "update project", "Unable to update project.");
  await addActivity(id, "status_changed", `Project status changed to ${status}`, "status");
}

export async function archiveProjectRecord(id: string): Promise<void> {
  const client = db();
  const { error } = await client.from("projects").update({ archived: true }).eq("id", id);
  throwIf(error, "archive project", "Unable to archive project.");
  await addActivity(id, "status_changed", "Project archived", "status");
}

export async function deleteProjectRecord(id: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("delete_project", { p_project_id: id });
  if (error) {
    const message = error.message.toUpperCase();
    if (message.includes("HAS_DOCUMENTS")) {
      throw new AgencyDbError(
        "This project has proposals, contracts, or invoices, so it can’t be deleted. Remove those first.",
        error,
      );
    }
    if (message.includes("NOT_FOUND")) {
      throw new AgencyDbError("This project could not be found.", error);
    }
  }
  throwIf(error, "delete project", "Unable to delete this project.");
}

export async function insertMilestone(projectId: string, draft: AgencyMilestoneDraft, position: number): Promise<void> {
  const client = db();
  const { error } = await client.from("milestones").insert({
    project_id: projectId,
    name: draft.name.trim(),
    description: draft.description.trim(),
    status: draft.status,
    position,
    start_date: emptyToNull(draft.startDate),
    due_date: emptyToNull(draft.dueDate),
  });
  throwIf(error, "create milestone", "Unable to save milestone.");
  await addActivity(projectId, "milestone_created", `Milestone added: ${draft.name.trim()}`, "milestone");
}

export async function updateMilestoneRecord(
  projectId: string,
  milestoneId: string,
  draft: AgencyMilestoneDraft,
): Promise<void> {
  const client = db();
  const { error } = await client
    .from("milestones")
    .update({
      name: draft.name.trim(),
      description: draft.description.trim(),
      status: draft.status,
      start_date: emptyToNull(draft.startDate),
      due_date: emptyToNull(draft.dueDate),
    })
    .eq("id", milestoneId);
  throwIf(error, "update milestone", "Unable to save milestone.");
  await addActivity(projectId, "milestone_updated", `Milestone updated: ${draft.name.trim()}`, "milestone");
}

export async function updateMilestoneStatus(
  projectId: string,
  milestoneId: string,
  status: AgencyMilestoneDraft["status"],
  name: string,
): Promise<void> {
  const client = db();
  const { error } = await client.from("milestones").update({ status }).eq("id", milestoneId);
  throwIf(error, "update milestone", "Unable to save milestone.");
  await addActivity(projectId, "milestone_updated", `${name} marked ${status}`, "milestone");
}

export async function swapMilestonePositions(
  first: { id: string; position: number },
  second: { id: string; position: number },
): Promise<void> {
  const client = db();
  const a = await client.from("milestones").update({ position: second.position }).eq("id", first.id);
  throwIf(a.error, "move milestone", "Unable to save milestone.");
  const b = await client.from("milestones").update({ position: first.position }).eq("id", second.id);
  throwIf(b.error, "move milestone", "Unable to save milestone.");
}

export async function deleteMilestone(projectId: string, milestoneId: string, name: string): Promise<void> {
  const client = db();
  const { error } = await client.from("milestones").delete().eq("id", milestoneId);
  throwIf(error, "remove milestone", "Unable to save milestone.");
  await addActivity(projectId, "milestone_updated", `Milestone removed: ${name}`, "milestone");
}

export async function insertTask(projectId: string, draft: AgencyTaskDraft): Promise<void> {
  const client = db();
  const now = new Date().toISOString();
  const { error } = await client.from("tasks").insert({
    project_id: projectId,
    milestone_id: emptyToNull(draft.milestoneId),
    title: draft.title.trim(),
    description: draft.description.trim(),
    status: draft.status,
    priority: draft.priority,
    assignee: draft.assignee,
    due_date: emptyToNull(draft.dueDate),
    completed_at: draft.status === "Completed" ? now : null,
  });
  throwIf(error, "create task", "Unable to create task.");
  await addActivity(projectId, "task_created", `Task created: ${draft.title.trim()}`, "task");
}

export async function updateTaskRecord(projectId: string, taskId: string, draft: AgencyTaskDraft, completedAt: string | null): Promise<void> {
  const client = db();
  const { error } = await client
    .from("tasks")
    .update({
      title: draft.title.trim(),
      description: draft.description.trim(),
      milestone_id: emptyToNull(draft.milestoneId),
      status: draft.status,
      priority: draft.priority,
      assignee: draft.assignee,
      due_date: emptyToNull(draft.dueDate),
      completed_at: completedAt,
    })
    .eq("id", taskId);
  throwIf(error, "update task", "Unable to update task.");
  await addActivity(projectId, "task_updated", `Task updated: ${draft.title.trim()}`, "task");
}

export async function setTaskCompletion(
  projectId: string,
  taskId: string,
  complete: boolean,
  title: string,
): Promise<void> {
  const client = db();
  const now = new Date().toISOString();
  const { error } = await client
    .from("tasks")
    .update({
      status: complete ? "Completed" : "Todo",
      completed_at: complete ? now : null,
    })
    .eq("id", taskId);
  throwIf(error, "update task", "Unable to update task.");
  await addActivity(
    projectId,
    complete ? "task_completed" : "task_updated",
    complete ? `Task “${title}” completed` : `Task “${title}” reopened`,
    "task",
  );
}

export async function insertDeliverable(
  projectId: string,
  draft: DeliverableDraft,
  id?: string,
): Promise<string> {
  const client = db();
  const { data, error } = await client
    .from("deliverables")
    .insert({
      ...(id ? { id } : {}),
      project_id: projectId,
      name: draft.name.trim(),
      description: draft.description.trim(),
      category: draft.category,
      status: draft.status === "Archived" ? "Draft" : draft.status,
    })
    .select("id")
    .single();
  throwIf(error, "create deliverable", "Unable to create deliverable.");
  if (!data) fail("create deliverable", null, "Unable to create deliverable.");
  await addActivity(projectId, "deliverable_created", "Deliverable created", "file");
  return data.id;
}

export async function uploadAndCreateVersion(input: {
  projectId: string;
  deliverableId: string;
  file: File;
  description: string;
  uploadedBy?: string;
}): Promise<FileVersionRow> {
  const invalid = validateUploadFile(input.file);
  if (invalid) throw new AgencyDbError(invalid.message);

  const versionId = crypto.randomUUID();
  let storagePath: string | null = null;
  try {
    storagePath = await uploadProjectFile({
      projectId: input.projectId,
      deliverableId: input.deliverableId,
      versionId,
      file: input.file,
    });

    const client = db();
    const { data, error } = await client.rpc("create_file_version", {
      p_deliverable_id: input.deliverableId,
      p_file_name: input.file.name,
      p_file_type: fileTypeFromName(input.file.name, input.file.type),
      p_file_size: input.file.size,
      p_description: input.description,
      p_uploaded_by: input.uploadedBy?.trim() || "Agency",
      p_version_id: versionId,
      p_storage_path: storagePath,
      p_mime_type: input.file.type || "",
    });
    throwIf(error, "create version", "Unable to create version.");
    const row = (Array.isArray(data) ? data[0] : data) as FileVersionRow | null;
    if (!row?.id) fail("create version", error, "Unable to create version.");
    return row;
  } catch (error) {
    if (storagePath) {
      await tryRemoveProjectFile(storagePath);
    }
    throw error;
  }
}

export async function setCurrentVersionRecord(deliverableId: string, versionId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("set_current_file_version", {
    p_deliverable_id: deliverableId,
    p_version_id: versionId,
  });
  throwIf(error, "set current version", "Unable to update version.");
}

export async function archiveVersionRecord(versionId: string): Promise<void> {
  const client = db();
  const { error } = await client
    .from("file_versions")
    .update({ is_current: false, archived_at: new Date().toISOString() })
    .eq("id", versionId)
    .eq("is_current", false);
  throwIf(error, "archive version", "Unable to archive version.");
}

export async function setDeliverableStatus(
  deliverableId: string,
  status: AgencyDeliverable["status"],
  archivedAt: string | null,
): Promise<void> {
  const client = db();
  const { error } = await client
    .from("deliverables")
    .update({ status, archived_at: archivedAt })
    .eq("id", deliverableId);
  throwIf(error, "update deliverable", "Unable to update deliverable.");
}

export async function submitClientFeedback(
  deliverableId: string,
  message: string,
  requestChanges: boolean,
): Promise<void> {
  const client = db();
  const { error } = await client.rpc("client_submit_feedback", {
    p_deliverable_id: deliverableId,
    p_message: message,
    p_request_changes: requestChanges,
  });
  throwIf(error, "submit feedback", "Unable to save feedback.");
}

export async function resolveFeedbackRecord(feedbackId: string): Promise<void> {
  const client = db();
  const { error } = await client
    .from("feedback")
    .update({ status: "Resolved", resolved_at: new Date().toISOString() })
    .eq("id", feedbackId);
  throwIf(error, "resolve feedback", "Unable to resolve feedback.");
}

export async function approveClientVersion(deliverableId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("client_approve_current_version", {
    p_deliverable_id: deliverableId,
  });
  throwIf(error, "approve version", "Unable to save approval.");
}

export async function linkClientAccount(clientId: string, email: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("admin_link_client_account", {
    p_client_id: clientId,
    p_email: email.trim(),
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("NO_PROFILE")) {
      throw new AgencyDbError(
        "No client account uses that email. Create the Auth user in Supabase first, then link it here.",
      );
    }
    if (message.includes("IS_ADMIN")) {
      throw new AgencyDbError("That email belongs to an admin account.");
    }
    if (message.includes("ALREADY_LINKED")) {
      throw new AgencyDbError("That account is already linked to another client.");
    }
  }
  throwIf(error, "link account", "Unable to link this account.");
}

export async function quietUpdateMilestoneStatus(milestoneId: string, status: AgencyMilestoneDraft["status"]): Promise<void> {
  const client = db();
  const { error } = await client.from("milestones").update({ status }).eq("id", milestoneId);
  throwIf(error, "update milestone", "Unable to save milestone.");
}
