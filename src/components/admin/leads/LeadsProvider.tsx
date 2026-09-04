import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { firstNameFrom, initialsFromName } from "@/auth/userDisplay";
import type { AgencyClient, AgencyClientDraft, AgencyClientEdits, AgencyClientStatus } from "@/data/agencyClients";
import {
  AgencyDbError,
  addActivity,
  approveClientVersion,
  archiveProjectRecord,
  deleteProjectRecord,
  archiveVersionRecord,
  convertLeadToClient,
  deleteMilestone,
  fetchAgencySnapshot,
  insertClient,
  insertDeliverable,
  insertLead,
  insertMilestone,
  insertProject,
  insertTask,
  linkClientAccount,
  markLeadConverted,
  quietUpdateMilestoneStatus,
  resolveFeedbackRecord,
  setCurrentVersionRecord,
  setDeliverableStatus,
  setTaskCompletion,
  submitClientFeedback,
  swapMilestonePositions,
  updateClientFields,
  updateClientRecord,
  updateLeadJson,
  updateLeadStatus,
  updateMilestoneRecord,
  updateMilestoneStatus,
  updateProjectRecord,
  updateProjectStatus,
  updateDeliverableRecord,
  updateTaskRecord,
  uploadAndCreateVersion,
  type AgencySnapshot,
  type PortalAccount,
} from "@/data/agencyRepository";
import { downloadProjectFile } from "@/data/fileStorage";
import { validateUploadFile } from "@/data/fileUploadConfig";
import { versionLabel, type AgencyDeliverable, type AgencyFileVersion, type DeliverableDraft } from "@/data/files";
import { createRecordId, type Lead, type LeadDraft, type LeadStatus } from "@/data/leads";
import {
  syncMilestoneStatuses,
  type AgencyMilestoneDraft,
  type AgencyProject,
  type AgencyProjectDraft,
  type AgencyProjectStatus,
  type AgencyTask,
  type AgencyTaskDraft,
} from "@/data/agencyProjects";
import {
  canClientReview,
  canSendForReview,
  isClientVisibleDeliverable,
  type ReviewApproval,
  type ReviewFeedback,
} from "@/data/review";
import { currentVersion as currentFileVersion } from "@/data/files";

type Toast = { id: string; message: string };
export type AgencyLoadStatus = "loading" | "ready" | "error";

type LeadsContextValue = {
  leads: Lead[];
  clients: AgencyClient[];
  projects: AgencyProject[];
  deliverables: AgencyDeliverable[];
  feedback: ReviewFeedback[];
  approvals: ReviewApproval[];
  portalAccounts: PortalAccount[];
  toast: Toast | null;
  loadStatus: AgencyLoadStatus;
  loadError: string | null;
  reload: () => Promise<void>;
  addLead: (draft: LeadDraft) => Promise<Lead | null>;
  updateStatus: (id: string, status: LeadStatus) => Promise<void>;
  addNote: (id: string, body: string) => Promise<void>;
  convertToClient: (id: string) => Promise<string | null>;
  addClient: (draft: AgencyClientDraft) => Promise<AgencyClient | null>;
  updateClient: (id: string, edits: AgencyClientEdits) => Promise<void>;
  addClientNote: (id: string, body: string) => Promise<void>;
  setClientStatus: (id: string, status: AgencyClientStatus) => Promise<void>;
  addProject: (draft: AgencyProjectDraft) => Promise<string | null>;
  updateProject: (id: string, edits: AgencyProjectDraft) => Promise<void>;
  setProjectStatus: (id: string, status: AgencyProjectStatus) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<boolean>;
  addMilestone: (projectId: string, draft: AgencyMilestoneDraft) => Promise<void>;
  updateMilestone: (projectId: string, milestoneId: string, draft: AgencyMilestoneDraft) => Promise<void>;
  setMilestoneStatus: (projectId: string, milestoneId: string, status: AgencyMilestoneDraft["status"]) => Promise<void>;
  moveMilestone: (projectId: string, milestoneId: string, direction: "up" | "down") => Promise<void>;
  removeMilestone: (projectId: string, milestoneId: string) => Promise<void>;
  addTask: (projectId: string, draft: AgencyTaskDraft) => Promise<void>;
  updateTask: (projectId: string, taskId: string, draft: AgencyTaskDraft) => Promise<void>;
  toggleTaskComplete: (projectId: string, taskId: string) => Promise<void>;
  addDeliverable: (projectId: string, draft: DeliverableDraft, file: File | null) => Promise<boolean>;
  updateDeliverable: (deliverableId: string, draft: DeliverableDraft) => Promise<boolean>;
  addVersion: (deliverableId: string, file: File, description: string) => Promise<boolean>;
  setCurrentVersion: (deliverableId: string, versionId: string) => Promise<void>;
  archiveVersion: (deliverableId: string, versionId: string) => Promise<void>;
  archiveDeliverable: (deliverableId: string) => Promise<void>;
  restoreDeliverable: (deliverableId: string) => Promise<void>;
  sendForReview: (deliverableId: string) => Promise<void>;
  submitFeedback: (deliverableId: string, message: string) => Promise<void>;
  requestChanges: (deliverableId: string, message: string) => Promise<void>;
  approveVersion: (deliverableId: string) => Promise<void>;
  resolveFeedback: (feedbackId: string) => Promise<void>;
  linkPortalAccount: (clientId: string, email: string) => Promise<boolean>;
  downloadFile: (version: AgencyFileVersion) => Promise<void>;
  notify: (message: string) => void;
  dismissToast: () => void;
};

const emptySnapshot: AgencySnapshot = {
  leads: [],
  clients: [],
  projects: [],
  deliverables: [],
  feedback: [],
  approvals: [],
  portalAccounts: [],
};

const LeadsContext = createContext<LeadsContextValue | null>(null);

export function LeadsProvider({ children }: { children: ReactNode }) {
  const { loading: authLoading, session, profile, profileStatus } = useAuth();
  const { pathname } = useLocation();
  const [snapshot, setSnapshot] = useState<AgencySnapshot>(emptySnapshot);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loadStatus, setLoadStatus] = useState<AgencyLoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const roleRef = useRef(profile?.role);
  roleRef.current = profile?.role;
  const loadStatusRef = useRef(loadStatus);
  loadStatusRef.current = loadStatus;

  function showToast(message: string) {
    setToast({ id: createRecordId("toast"), message });
  }

  async function refresh() {
    const role = roleRef.current;
    if (role !== "admin" && role !== "staff" && role !== "client") {
      setSnapshot(emptySnapshot);
      setLoadStatus("ready");
      setLoadError(null);
      return;
    }
    const next = await fetchAgencySnapshot(role);
    setSnapshot(next);
    setLoadStatus("ready");
    setLoadError(null);
  }

  async function run<T>(action: () => Promise<T>, success?: string): Promise<T | null> {
    try {
      const result = await action();
      try {
        await refresh();
      } catch (error) {
        const message = error instanceof AgencyDbError ? error.message : "Unable to load projects.";
        setLoadError(message);
        setLoadStatus("error");
      }
      if (success) showToast(success);
      return result;
    } catch (error) {
      const message = error instanceof AgencyDbError ? error.message : "Unable to save. Please try again.";
      showToast(message);
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (authLoading || (session && profileStatus === "loading")) {
      setLoadStatus("loading");
      return;
    }
    if (!session || profileStatus !== "ready" || !profile || (profile.role !== "admin" && profile.role !== "staff" && profile.role !== "client")) {
      setSnapshot(emptySnapshot);
      setLoadStatus("ready");
      setLoadError(null);
      return;
    }
    setLoadStatus("loading");
    fetchAgencySnapshot(profile.role)
      .then((next) => {
        if (cancelled) return;
        setSnapshot(next);
        setLoadStatus("ready");
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof AgencyDbError ? error.message : "Unable to load projects.";
        setLoadError(message);
        setLoadStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, profile, profileStatus, session]);

  useEffect(() => {
    if (pathname !== "/admin/leads") return;
    if (loadStatusRef.current !== "ready") return;
    const role = roleRef.current;
    if (role !== "admin" && role !== "staff") return;
    void refresh();
  }, [pathname]);

  const value = useMemo<LeadsContextValue>(() => {
    const { leads, clients, projects, deliverables, feedback, approvals, portalAccounts } = snapshot;

    async function persistMilestoneSync(previous: AgencyProject, next: AgencyProject) {
      const synced = syncMilestoneStatuses(next);
      for (const milestone of synced.milestones) {
        const before = previous.milestones.find((item) => item.id === milestone.id);
        if (before && before.status !== milestone.status) {
          await quietUpdateMilestoneStatus(milestone.id, milestone.status);
        }
      }
    }

    async function addClientFeedback(deliverableId: string, message: string, kind: "feedback" | "changes") {
      const current = snapshotRef.current.deliverables.find((item) => item.id === deliverableId);
      if (!current || current.status === "Archived") return;
      if (current.status !== "In Review" && current.status !== "Needs Changes") return;
      const version = currentFileVersion(current);
      const trimmed = message.trim();
      if (!version || !trimmed) return;
      await submitClientFeedback(deliverableId, trimmed, kind === "changes");
    }

    return {
      leads,
      clients,
      projects,
      deliverables,
      feedback,
      approvals,
      portalAccounts,
      toast,
      loadStatus,
      loadError,
      reload: async () => {
        if (loadStatus !== "ready") setLoadStatus("loading");
        try {
          await refresh();
        } catch (error) {
          const message = error instanceof AgencyDbError ? error.message : "Unable to load projects.";
          setLoadError(message);
          setLoadStatus("error");
        }
      },
      async addLead(draft) {
        return run(() => insertLead(draft), "Lead created.");
      },
      async updateStatus(id, status) {
        const lead = snapshotRef.current.leads.find((item) => item.id === id);
        if (!lead) return;
        const now = new Date().toISOString();
        await run(
          () =>
            updateLeadStatus(id, status, [
              { id: createRecordId("act"), description: `Lead status changed to ${status}`, createdAt: now },
              ...lead.activity,
            ]),
          "Lead status updated.",
        );
      },
      async addNote(id, body) {
        const lead = snapshotRef.current.leads.find((item) => item.id === id);
        if (!lead) return;
        const now = new Date().toISOString();
        await run(
          () =>
            updateLeadJson(id, {
              notes: [{ id: createRecordId("note"), body, author: profile?.fullName.trim() || profile?.email || "Agency", createdAt: now }, ...lead.notes],
              activity: [{ id: createRecordId("act"), description: "Internal note added", createdAt: now }, ...lead.activity],
            }),
          "Internal note added.",
        );
      },
      async convertToClient(id) {
        const lead = snapshotRef.current.leads.find((item) => item.id === id);
        if (!lead) return null;
        if (lead.convertedClientId) return lead.convertedClientId;
        const existing = snapshotRef.current.clients.find((item) => item.sourceLeadId === id);
        if (existing) {
          const now = new Date().toISOString();
          const linked = await run(() =>
            markLeadConverted(id, existing.id, [
              { id: createRecordId("act"), description: "Lead converted to client", createdAt: now },
              ...lead.activity,
            ]),
          );
          return linked === null ? null : existing.id;
        }
        const clientId = await run(() => convertLeadToClient(lead), "Lead converted to client.");
        return clientId;
      },
      async addClient(draft) {
        return run(() => insertClient(draft), "Client created.");
      },
      async updateClient(id, edits) {
        const current = snapshotRef.current.clients.find((item) => item.id === id);
        if (!current) return;
        const now = new Date().toISOString();
        await run(
          () =>
            updateClientRecord(
              id,
              edits,
              [
                { id: createRecordId("cact"), description: "Client details updated", createdAt: now, icon: "status" },
                ...current.activity,
              ],
              now,
            ),
          "Client updated.",
        );
      },
      async addClientNote(id, body) {
        const current = snapshotRef.current.clients.find((item) => item.id === id);
        if (!current) return;
        const now = new Date().toISOString();
        await run(
          () =>
            updateClientFields(id, {
              notes: [{ id: createRecordId("cnote"), body, author: profile?.fullName.trim() || profile?.email || "Agency", createdAt: now }, ...current.notes],
              activity: [
                { id: createRecordId("cact"), description: "Internal note added", createdAt: now, icon: "note" },
                ...current.activity,
              ],
              last_activity_at: now,
            }),
          "Note added.",
        );
      },
      async setClientStatus(id, status) {
        const current = snapshotRef.current.clients.find((item) => item.id === id);
        if (!current) return;
        const now = new Date().toISOString();
        const label = status === "Active" ? "active" : status === "Inactive" ? "inactive" : "archived";
        await run(
          () =>
            updateClientFields(id, {
              status,
              activity: [
                { id: createRecordId("cact"), description: `Client marked ${label}`, createdAt: now, icon: "status" },
                ...current.activity,
              ],
              last_activity_at: now,
            }),
          "Client updated.",
        );
      },
      async addProject(draft) {
        if (!snapshotRef.current.clients.some((item) => item.id === draft.clientId)) return null;
        return run(async () => {
          const projectId = await insertProject(draft);
          const now = new Date().toISOString();
          const client = snapshotRef.current.clients.find((item) => item.id === draft.clientId);
          if (client) {
            await updateClientFields(draft.clientId, {
              activity: [
                { id: createRecordId("cact"), description: `Project created: ${draft.name.trim()}`, createdAt: now, icon: "project" },
                ...client.activity,
              ],
              last_activity_at: now,
            });
          }
          return projectId;
        }, "Project created.");
      },
      async updateProject(id, edits) {
        await run(() => updateProjectRecord(id, edits), "Project updated.");
      },
      async setProjectStatus(id, status) {
        await run(() => updateProjectStatus(id, status), "Project status updated.");
      },
      async archiveProject(id) {
        await run(() => archiveProjectRecord(id), "Project archived.");
      },
      async deleteProject(id) {
        const result = await run(() => deleteProjectRecord(id), "Project deleted.");
        return result !== null;
      },
      async addMilestone(projectId, draft) {
        const project = snapshotRef.current.projects.find((item) => item.id === projectId);
        const position = (project?.milestones.reduce((max, item) => Math.max(max, item.order), 0) ?? 0) + 1;
        await run(() => insertMilestone(projectId, draft, position), "Milestone updated.");
      },
      async updateMilestone(projectId, milestoneId, draft) {
        await run(() => updateMilestoneRecord(projectId, milestoneId, draft), "Milestone updated.");
      },
      async setMilestoneStatus(projectId, milestoneId, status) {
        const milestone = snapshotRef.current.projects
          .find((item) => item.id === projectId)
          ?.milestones.find((item) => item.id === milestoneId);
        await run(
          () => updateMilestoneStatus(projectId, milestoneId, status, milestone?.name ?? "Milestone"),
          "Milestone updated.",
        );
      },
      async moveMilestone(projectId, milestoneId, direction) {
        const project = snapshotRef.current.projects.find((item) => item.id === projectId);
        if (!project) return;
        const ordered = [...project.milestones].sort((a, b) => a.order - b.order);
        const index = ordered.findIndex((item) => item.id === milestoneId);
        const swapWith = direction === "up" ? index - 1 : index + 1;
        if (index < 0 || swapWith < 0 || swapWith >= ordered.length) return;
        await run(() =>
          swapMilestonePositions(
            { id: ordered[index].id, position: ordered[index].order },
            { id: ordered[swapWith].id, position: ordered[swapWith].order },
          ),
        );
      },
      async removeMilestone(projectId, milestoneId) {
        const project = snapshotRef.current.projects.find((item) => item.id === projectId);
        const milestone = project?.milestones.find((item) => item.id === milestoneId);
        await run(() => deleteMilestone(projectId, milestoneId, milestone?.name ?? "Milestone"), "Milestone updated.");
      },
      async addTask(projectId, draft) {
        const project = snapshotRef.current.projects.find((item) => item.id === projectId);
        await run(async () => {
          await insertTask(projectId, draft);
          if (project) {
            const created: AgencyTask = {
              id: "tmp",
              milestoneId: draft.milestoneId,
              title: draft.title.trim(),
              description: draft.description.trim(),
              status: draft.status,
              priority: draft.priority,
              assignee: draft.assignee,
              assignedTo: draft.assignedTo,
              dueDate: draft.dueDate,
              recommendedRole: draft.recommendedRole,
              taskType: draft.taskType,
              referenceUrl: draft.referenceUrl,
              estimatedHours: draft.estimatedHours,
              deliverableId: null,
              createdAt: new Date().toISOString(),
              completedAt: draft.status === "Completed" ? new Date().toISOString() : null,
            };
            await persistMilestoneSync(project, { ...project, tasks: [created, ...project.tasks] });
          }
        }, "Task created.");
      },
      async updateTask(projectId, taskId, draft) {
        const project = snapshotRef.current.projects.find((item) => item.id === projectId);
        const current = project?.tasks.find((item) => item.id === taskId);
        const now = new Date().toISOString();
        const completedAt =
          draft.status === "Completed" ? (current?.completedAt ?? now) : draft.status === current?.status ? current.completedAt : null;
        await run(async () => {
          await updateTaskRecord(projectId, taskId, draft, completedAt);
          if (project && current) {
            const tasks = project.tasks.map((item) =>
              item.id === taskId
                ? {
                    ...item,
                    title: draft.title.trim(),
                    description: draft.description.trim(),
                    milestoneId: draft.milestoneId,
                    status: draft.status,
                    priority: draft.priority,
                    assignee: draft.assignee,
                    assignedTo: draft.assignedTo,
                    dueDate: draft.dueDate,
                    recommendedRole: draft.recommendedRole,
                    completedAt,
                  }
                : item,
            );
            await persistMilestoneSync(project, { ...project, tasks });
          }
        }, "Project updated.");
      },
      async toggleTaskComplete(projectId, taskId) {
        const project = snapshotRef.current.projects.find((item) => item.id === projectId);
        const current = project?.tasks.find((item) => item.id === taskId);
        if (!current) return;
        const complete = current.status !== "Completed";
        await run(async () => {
          await setTaskCompletion(projectId, taskId, complete, current.title);
          if (project) {
            const tasks = project.tasks.map((item) =>
              item.id === taskId
                ? {
                    ...item,
                    status: complete ? ("Completed" as const) : ("Todo" as const),
                    completedAt: complete ? new Date().toISOString() : null,
                  }
                : item,
            );
            await persistMilestoneSync(project, { ...project, tasks });
          }
        }, complete ? "Task completed." : "Task reopened.");
      },
      async addDeliverable(projectId, draft, file) {
        if (file) {
          const invalid = validateUploadFile(file);
          if (invalid) {
            showToast(invalid.message);
            return false;
          }
        }
        const result = await run(async () => {
          const deliverableId = await insertDeliverable(projectId, draft);
          if (file) {
            await uploadAndCreateVersion({
              projectId,
              deliverableId,
              file,
              description: draft.description.trim(),
              uploadedBy: profile?.fullName.trim() || profile?.email || "Agency",
            });
          }
        }, "Deliverable created.");
        return result !== null;
      },
      async updateDeliverable(deliverableId, draft) {
        const current = snapshotRef.current.deliverables.find((item) => item.id === deliverableId);
        if (!current || current.status === "Archived") return false;
        const result = await run(async () => {
          await updateDeliverableRecord(deliverableId, draft);
          await addActivity(current.projectId, "deliverable_updated", `${draft.name.trim()} updated`, "file");
        }, "Deliverable updated.");
        return result !== null;
      },
      async addVersion(deliverableId, file, description) {
        const current = snapshotRef.current.deliverables.find((item) => item.id === deliverableId);
        if (!current || current.status === "Archived") return false;
        const invalid = validateUploadFile(file);
        if (invalid) {
          showToast(invalid.message);
          return false;
        }
        const result = await run(
          () =>
            uploadAndCreateVersion({
              projectId: current.projectId,
              deliverableId,
              uploadedBy: profile?.fullName.trim() || profile?.email || "Agency",
              file,
              description,
            }),
          "New version created.",
        );
        return result !== null;
      },
      async setCurrentVersion(deliverableId, versionId) {
        await run(() => setCurrentVersionRecord(deliverableId, versionId), "Current version updated.");
      },
      async archiveVersion(deliverableId, versionId) {
        const current = snapshotRef.current.deliverables.find((item) => item.id === deliverableId);
        if (!current || current.currentVersionId === versionId) return;
        const version = current.versions.find((item) => item.id === versionId);
        await run(async () => {
          await archiveVersionRecord(versionId);
          await addActivity(current.projectId, "version_archived", `Version ${version?.versionNumber ?? ""} archived`, "file");
        });
      },
      async archiveDeliverable(deliverableId) {
        const current = snapshotRef.current.deliverables.find((item) => item.id === deliverableId);
        if (!current || current.status === "Archived") return;
        const now = new Date().toISOString();
        await run(async () => {
          await setDeliverableStatus(deliverableId, "Archived", now);
          await addActivity(current.projectId, "deliverable_archived", "Deliverable archived", "file");
        }, "Deliverable archived.");
      },
      async restoreDeliverable(deliverableId) {
        const current = snapshotRef.current.deliverables.find((item) => item.id === deliverableId);
        if (!current || current.status !== "Archived") return;
        await run(async () => {
          await setDeliverableStatus(deliverableId, "Draft", null);
          await addActivity(current.projectId, "deliverable_restored", "Deliverable restored", "file");
        }, "Deliverable restored.");
      },
      async sendForReview(deliverableId) {
        const current = snapshotRef.current.deliverables.find((item) => item.id === deliverableId);
        if (!current || !canSendForReview(current)) return;
        const version = currentFileVersion(current);
        if (!version) return;
        await run(async () => {
          await setDeliverableStatus(deliverableId, "In Review", null);
          await addActivity(
            current.projectId,
            "version_sent_for_review",
            `${current.name} ${versionLabel(version.versionNumber)} sent for review.`,
            "review",
            { deliverable_id: deliverableId },
          );
        }, "Sent for review.");
      },
      async submitFeedback(deliverableId, message) {
        await run(async () => {
          await addClientFeedback(deliverableId, message, "feedback");
        }, "Feedback submitted.");
      },
      async requestChanges(deliverableId, message) {
        await run(async () => {
          await addClientFeedback(deliverableId, message, "changes");
        }, "Changes requested.");
      },
      async approveVersion(deliverableId) {
        const current = snapshotRef.current.deliverables.find((item) => item.id === deliverableId);
        if (!current || !canClientReview(current)) return;
        const version = currentFileVersion(current);
        if (!version) return;
        await run(async () => {
          await approveClientVersion(deliverableId);
        }, `${current.name} ${versionLabel(version.versionNumber)} approved.`);
      },
      async resolveFeedback(feedbackId) {
        const item = snapshotRef.current.feedback.find((entry) => entry.id === feedbackId);
        if (!item || item.status === "Resolved") return;
        await run(async () => {
          await resolveFeedbackRecord(feedbackId);
          await addActivity(item.projectId, "feedback_resolved", "Feedback marked as resolved.", "review");
        }, "Feedback marked as resolved.");
      },
      async linkPortalAccount(clientId, email) {
        const result = await run(() => linkClientAccount(clientId, email), "Portal account linked.");
        return result !== null;
      },
      async downloadFile(version) {
        if (!version.storagePath) {
          showToast("No file uploaded yet.");
          return;
        }
        try {
          await downloadProjectFile(version.storagePath, version.fileName);
        } catch (error) {
          showToast(error instanceof AgencyDbError ? error.message : "Unable to download this file.");
        }
      },
      notify(message) {
        showToast(message);
      },
      dismissToast() {
        setToast(null);
      },
    };
  }, [loadError, loadStatus, profile?.email, profile?.fullName, snapshot, toast]);

  return <LeadsContext.Provider value={value}>{children}</LeadsContext.Provider>;
}

export function useLeads() {
  const context = useContext(LeadsContext);
  if (!context) throw new Error("useLeads must be used within LeadsProvider");
  return context;
}

export function useLead(id: string | undefined) {
  const { leads } = useLeads();
  return leads.find((lead) => lead.id === id) ?? null;
}

export function useAgencyClient(id: string | undefined) {
  const { clients } = useLeads();
  return clients.find((client) => client.id === id) ?? null;
}

export function useClientProjects(clientId: string | undefined) {
  const { projects } = useLeads();
  if (!clientId) return [];
  return projects.filter((project) => project.clientId === clientId && !project.archived);
}

export function useAgencyProject(id: string | undefined) {
  const { projects, clients } = useLeads();
  const project = projects.find((item) => item.id === id) ?? null;
  if (!project) return null;
  const client = clients.find((item) => item.id === project.clientId) ?? null;
  return { project, client };
}

export function useProjectDeliverables(projectId: string | undefined) {
  const { deliverables } = useLeads();
  if (!projectId) return [];
  return deliverables.filter((item) => item.projectId === projectId);
}

export function useClientDeliverables(clientId: string | undefined) {
  const { deliverables, projects } = useLeads();
  if (!clientId) return [];
  const projectIds = new Set(projects.filter((project) => project.clientId === clientId).map((project) => project.id));
  return deliverables.filter((item) => projectIds.has(item.projectId));
}

export function usePortalSession() {
  const { profile } = useAuth();
  const { clients, projects, deliverables, feedback, approvals } = useLeads();
  const clientId = profile?.role === "client" ? profile.clientId : null;
  const client = clientId ? (clients.find((item) => item.id === clientId) ?? null) : null;
  const clientProjects = clientId ? projects.filter((project) => project.clientId === clientId) : [];
  const project = clientProjects.find((item) => !item.archived) ?? clientProjects[0] ?? null;
  const projectIds = new Set(clientProjects.map((item) => item.id));
  const files = deliverables.filter((item) => projectIds.has(item.projectId) && isClientVisibleDeliverable(item));
  const projectFeedback = feedback.filter((item) => projectIds.has(item.projectId));
  const projectApprovals = approvals.filter((item) => projectIds.has(item.projectId));
  return {
    client,
    project,
    projects: clientProjects,
    files,
    feedback: projectFeedback,
    approvals: projectApprovals,
  };
}

export function usePortalIdentity() {
  const { profile } = useAuth();
  const { client } = usePortalSession();
  const name = profile?.fullName.trim() || client?.contactName || "Client";
  return {
    name,
    firstName: firstNameFrom(name),
    initials: initialsFromName(name),
    businessName: client?.businessName || "Your business",
    email: profile?.email || client?.email || "",
    phone: client?.phone && client.phone !== "—" ? client.phone : "",
  };
}

export function useProjectReview(projectId: string | undefined) {
  const { feedback, approvals, deliverables } = useLeads();
  if (!projectId) return { feedback: [], approvals: [], deliverables: [] };
  return {
    feedback: feedback.filter((item) => item.projectId === projectId),
    approvals: approvals.filter((item) => item.projectId === projectId),
    deliverables: deliverables.filter((item) => item.projectId === projectId),
  };
}
