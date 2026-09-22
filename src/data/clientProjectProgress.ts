import type { ClientTask, ProjectStage, ProjectStageStatus } from "@/data/clientPortal";
import type { AgencyMilestone, AgencyProject, AgencyTask } from "@/data/agencyProjects";
import { displayMilestoneName } from "@/data/projectMilestones";
import { getSupabase } from "@/lib/supabase";
import { AgencyDbError } from "@/lib/dbErrors";

function milestoneStageStatus(milestones: AgencyMilestone[], index: number): ProjectStageStatus {
  const sorted = milestones;
  const currentIdx = sorted.findIndex((item) => item.status === "In Progress");
  const fallbackIdx = currentIdx === -1 ? sorted.findIndex((item) => item.status !== "Completed") : currentIdx;
  if (sorted[index]?.status === "Completed") return "complete";
  if (index === fallbackIdx && fallbackIdx !== -1) return "current";
  return "upcoming";
}

export function timelineStagesFromProject(project: AgencyProject | null | undefined): ProjectStage[] {
  if (!project?.milestones.length) return [];
  const sorted = [...project.milestones].sort((a, b) => a.order - b.order);
  return sorted.map((milestone, index) => ({
    id: milestone.id,
    label: displayMilestoneName(milestone.name),
    status: milestoneStageStatus(sorted, index),
  }));
}

export type ClientDeliveryGates = {
  designApproved: boolean;
  developmentComplete: boolean;
  qaPassed: boolean;
  clientReviewComplete: boolean;
  finalApproved: boolean;
  isLaunched: boolean;
  isCompleted: boolean;
};

/**
 * Simple 6-step delivery checklist for the client portal (Section 20 of the
 * production workflow spec): "what do you need from me?" -- distinct from
 * timelineStagesFromProject() above, which shows raw milestone status.
 *
 * These gates are computed server-side (client_project_delivery_gates RPC,
 * see supabase/migrations/20260930240000_client_portal_gate_status.sql), not
 * from tasks/project_development fetched into this session: RLS deliberately
 * hides agency-origin tasks and all of project_development from a client
 * role, so recomputing developmentComplete()/qaLatestResult() etc. from
 * locally-fetched data always read as not-done for a real client, no matter
 * how complete the project actually was. The RPC mirrors the same checks
 * launch_blocking_reasons() already trusts, just scoped to the caller's own
 * project via owns_project().
 */
export async function fetchClientDeliveryGates(projectId: string): Promise<ClientDeliveryGates | null> {
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase isn’t connected yet.");
  const { data, error } = await client.rpc("client_project_delivery_gates", { p_project_id: projectId });
  if (error) throw new AgencyDbError("Unable to load your project status.", error);
  const row = (Array.isArray(data) ? data[0] : data) as {
    design_approved: boolean;
    development_complete: boolean;
    qa_passed: boolean;
    client_review_complete: boolean;
    final_approved: boolean;
    is_launched: boolean;
    is_completed: boolean;
  } | null;
  if (!row) return null;
  return {
    designApproved: row.design_approved,
    developmentComplete: row.development_complete,
    qaPassed: row.qa_passed,
    clientReviewComplete: row.client_review_complete,
    finalApproved: row.final_approved,
    isLaunched: row.is_launched,
    isCompleted: row.is_completed,
  };
}

export type ClientDeliveryStatus = {
  domainName: string | null;
  domainStatus: string;
  hostingStatus: string;
  deploymentStatus: string;
};

/**
 * Domain/hosting/deployment status labels for the client portal -- see
 * client_project_delivery_status (20261009000000_client_care_plan_status.sql). Same reasoning as
 * fetchClientDeliveryGates above: project_development has no client-facing RLS at all, so this is
 * a security definer RPC exposing only status labels, never repository/provider/credential detail.
 */
export async function fetchClientDeliveryStatus(projectId: string): Promise<ClientDeliveryStatus | null> {
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase isn’t connected yet.");
  const { data, error } = await client.rpc("client_project_delivery_status", { p_project_id: projectId });
  if (error) throw new AgencyDbError("Unable to load your hosting status.", error);
  const row = (Array.isArray(data) ? data[0] : data) as {
    domain_name: string | null;
    domain_status: string;
    hosting_status: string;
    deployment_status: string;
  } | null;
  if (!row) return null;
  return {
    domainName: row.domain_name,
    domainStatus: row.domain_status,
    hostingStatus: row.hosting_status,
    deploymentStatus: row.deployment_status,
  };
}

export function clientDeliveryStagesFromGates(gates: ClientDeliveryGates | null): ProjectStage[] {
  if (!gates) return [];
  const steps = [
    { id: "design", label: "Design Approved", done: gates.designApproved },
    { id: "development", label: "Development", done: gates.developmentComplete },
    { id: "qa", label: "QA", done: gates.qaPassed },
    { id: "review", label: "Your Review", done: gates.clientReviewComplete },
    { id: "final_approval", label: "Final Approval", done: gates.finalApproved },
    { id: "launch", label: "Launch", done: gates.isLaunched },
    { id: "delivered", label: "Delivered", done: gates.isCompleted },
  ];
  const currentIndex = steps.findIndex((step) => !step.done);
  return steps.map((step, index) => ({
    id: step.id,
    label: step.label,
    status: step.done ? "complete" : index === currentIndex ? "current" : "upcoming",
  }));
}

export function clientTasksFromProject(project: AgencyProject | null | undefined): ClientTask[] {
  if (!project?.tasks.length) return [];
  return [...project.tasks]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((task: AgencyTask) => ({
      id: task.id,
      label: task.title,
      status: task.status === "Completed" ? "done" : "open",
    }));
}
