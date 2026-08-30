import type { AgencyClient, AgencyNote, AgencyActivityItem } from "@/data/agencyClients";
import type { AgencyDeliverable, AgencyFileVersion, DeliverableCategory, DeliverableStatus } from "@/data/files";
import type { Lead, LeadActivityItem, LeadIndustry, LeadNote, LeadStatus } from "@/data/leads";
import type {
  AgencyMilestone,
  AgencyMilestoneStatus,
  AgencyProject,
  AgencyProjectActivity,
  AgencyProjectStatus,
  AgencyProjectType,
  AgencyTask,
  AgencyTaskPriority,
  AgencyTaskStatus,
} from "@/data/agencyProjects";
import type { ReviewApproval, ReviewFeedback } from "@/data/review";
import type {
  ActivityRow,
  ApprovalRow,
  ClientRow,
  ClientStaffDataRow,
  DeliverableRow,
  FeedbackRow,
  FileVersionRow,
  Json,
  LeadRow,
  MilestoneRow,
  ProjectRow,
  TaskRow,
} from "@/types/database";

function asRecord(value: Json | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asList(value: Json | undefined): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const rows: Record<string, unknown>[] = [];
  for (const item of value) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      rows.push(item as Record<string, unknown>);
    }
  }
  return rows;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function dateField(value: string | null | undefined): string {
  return value ?? "";
}

const leadStatuses: LeadStatus[] = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];
const industries: LeadIndustry[] = [
  "Home services",
  "Contractor",
  "Landscaping",
  "Tree service",
  "Cleaning",
  "Restaurant",
  "Salon / barber",
  "Auto",
  "Professional services",
  "Other",
];

export function mapLead(row: LeadRow): Lead {
  const createdAt = row.created_at;
  return {
    id: row.id,
    name: row.name,
    businessName: row.business_name,
    email: row.email,
    phone: row.phone || "—",
    industry: industries.includes(row.industry as LeadIndustry) ? (row.industry as LeadIndustry) : "Other",
    request: row.request,
    projectDetails: row.project_details,
    status: leadStatuses.includes(row.status as LeadStatus) ? (row.status as LeadStatus) : "New",
    createdAt,
    source: row.source === "Start a Project" ? "Start a Project" : "Manual",
    notes: asList(row.notes).map((item) => ({
      id: text(item.id, crypto.randomUUID()),
      body: text(item.body),
      author: text(item.author, "Agency"),
      createdAt: text(item.createdAt, createdAt),
    })) as LeadNote[],
    activity: asList(row.activity).map((item) => ({
      id: text(item.id, crypto.randomUUID()),
      description: text(item.description),
      createdAt: text(item.createdAt, createdAt),
    })) as LeadActivityItem[],
    convertedClientId: row.client_id,
  };
}

export function mapClient(row: ClientRow, staff?: ClientStaffDataRow | null): AgencyClient {
  const createdAt = row.created_at;
  const notesJson = staff?.notes;
  const activityJson = staff?.activity;
  const invoicesJson = staff?.invoices;
  const messagesJson = staff?.messages;
  return {
    id: row.id,
    sourceLeadId: row.source_lead_id,
    contactName: row.contact_name,
    businessName: row.business_name,
    email: row.email ?? "",
    phone: row.phone || "—",
    industry: industries.includes(row.industry as LeadIndustry) ? (row.industry as LeadIndustry) : "Other",
    website: row.website,
    location: row.location,
    status: row.status === "Inactive" || row.status === "Archived" ? row.status : "Active",
    source: row.source === "Start a Project" ? "Start a Project" : "Manual",
    createdAt,
    lastActivityAt: row.last_activity_at,
    notes: asList(notesJson).map((item) => ({
      id: text(item.id, crypto.randomUUID()),
      body: text(item.body),
      author: text(item.author, "Agency"),
      createdAt: text(item.createdAt, createdAt),
    })) as AgencyNote[],
    activity: asList(activityJson).map((item) => ({
      id: text(item.id, crypto.randomUUID()),
      description: text(item.description),
      createdAt: text(item.createdAt, createdAt),
      icon: (["created", "converted", "note", "project", "file", "status"].includes(text(item.icon))
        ? text(item.icon)
        : "status") as AgencyActivityItem["icon"],
    })),
    files: [],
    invoices: asList(invoicesJson).map((item) => ({
      id: text(item.id, crypto.randomUUID()),
      number: text(item.number),
      title: text(item.title),
      amount: text(item.amount),
      status: (text(item.status, "Due") as AgencyClient["invoices"][number]["status"]) || "Due",
    })),
    messages: asList(messagesJson).map((item) => ({
      id: text(item.id, crypto.randomUUID()),
      sender: text(item.sender),
      body: text(item.body),
    })),
  };
}

export function mapMilestone(row: MilestoneRow): AgencyMilestone {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as AgencyMilestoneStatus,
    order: row.position,
    startDate: dateField(row.start_date),
    dueDate: dateField(row.due_date),
  };
}

export function mapTask(row: TaskRow): AgencyTask {
  return {
    id: row.id,
    milestoneId: row.milestone_id ?? "",
    title: row.title,
    description: row.description,
    status: row.status as AgencyTaskStatus,
    priority: row.priority as AgencyTaskPriority,
    assignee: row.assignee ?? "",
    assignedTo: row.assigned_to ?? "",
    dueDate: dateField(row.due_date),
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

const activityIcons = ["created", "status", "task", "milestone", "file", "progress", "review"] as const;

export function mapActivity(row: ActivityRow): AgencyProjectActivity {
  const meta = asRecord(row.metadata);
  const icon = text(meta.icon);
  return {
    id: row.id,
    description: row.message,
    createdAt: row.created_at,
    icon: activityIcons.includes(icon as (typeof activityIcons)[number])
      ? (icon as AgencyProjectActivity["icon"])
      : "status",
  };
}

export function mapProject(
  row: ProjectRow,
  milestones: AgencyMilestone[],
  tasks: AgencyTask[],
  activity: AgencyProjectActivity[],
): AgencyProject {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    type: row.type as AgencyProjectType,
    description: row.description,
    status: row.status as AgencyProjectStatus,
    startDate: dateField(row.start_date),
    targetLaunchDate: dateField(row.due_date),
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    archived: row.archived,
    approvalStatus: row.approval_status === "Approved" ? "Approved" : "Pending",
    milestones,
    tasks,
    feedback: [],
    activity,
  };
}

export function mapVersion(row: FileVersionRow): AgencyFileVersion {
  return {
    id: row.id,
    deliverableId: row.deliverable_id,
    versionNumber: row.version_number,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: Number(row.file_size) || 0,
    description: row.description,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.created_at,
    status: row.archived_at ? "Archived" : "Active",
    storagePath: row.storage_path ?? null,
    mimeType: row.mime_type || "",
    previewUrl: null,
  };
}

export function mapDeliverableWithCurrent(
  row: DeliverableRow,
  versions: AgencyFileVersion[],
  currentVersionId: string | null,
): AgencyDeliverable {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    category: (row.category as DeliverableCategory) || "Other",
    status: row.status as DeliverableStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentVersionId,
    versions,
  };
}

export function mapFeedback(row: FeedbackRow): ReviewFeedback {
  return {
    id: row.id,
    projectId: row.project_id,
    deliverableId: row.deliverable_id,
    versionId: row.version_id,
    clientId: row.client_id,
    message: row.message,
    status: row.status === "Resolved" ? "Resolved" : "Open",
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    createdBy: row.created_by_name,
  };
}

export function mapApproval(row: ApprovalRow): ReviewApproval {
  return {
    id: row.id,
    projectId: row.project_id,
    deliverableId: row.deliverable_id,
    versionId: row.version_id,
    clientId: row.client_id,
    status: "Approved",
    approvedBy: row.approved_by_name,
    approvedAt: row.approved_at,
  };
}

export function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export { asList };
