/**
 * Client-side mirror of the server-side production workflow gates in
 * supabase/migrations/20260930090000_production_workflow_gates.sql (and its
 * follow-up fixes). This module is DISPLAY ONLY -- it tells Admin/PM,
 * Developer, Designer, and Client views what phase a project is in and what
 * is blocking it, using the same rules the database triggers already
 * enforce. It never itself allows or blocks a write; the database is the
 * only place these rules are actually enforced (see the migration and
 * docs/production-workflow.md). Keep these functions in sync with the SQL
 * if the gate rules ever change.
 */
import type { AgencyDeliverable } from "@/data/files";
import type { AgencyProject, AgencyTask } from "@/data/agencyProjects";
import { websiteMilestoneDefinition } from "@/data/projectMilestones";
import { effectiveTaskType } from "@/data/taskTypes";

export type DesignCheckpointKey = "overall_design" | "final_website";

/** Mirrors project_checkpoint_approved(): a deliverable tagged with this checkpoint whose status is Approved (the client-approval RPCs keep this in sync with the current version's approval row). */
export function checkpointApproved(deliverables: AgencyDeliverable[], checkpoint: DesignCheckpointKey): boolean {
  return deliverables.some((item) => item.designCheckpoint === checkpoint && item.status === "Approved");
}

function tasksForMilestoneKey(project: Pick<AgencyProject, "milestones" | "tasks">, key: string): AgencyTask[] {
  const milestoneIds = new Set(
    project.milestones.filter((milestone) => websiteMilestoneDefinition(milestone.name)?.key === key).map((m) => m.id),
  );
  return project.tasks.filter((task) => milestoneIds.has(task.milestoneId));
}

/** Mirrors development_tasks_complete(): at least one Development-milestone task, all Completed. */
export function developmentComplete(project: Pick<AgencyProject, "milestones" | "tasks">): boolean {
  const tasks = tasksForMilestoneKey(project, "development");
  return tasks.length > 0 && tasks.every((task) => task.status === "Completed");
}

export function qaTasks(project: Pick<AgencyProject, "tasks">): AgencyTask[] {
  return project.tasks.filter((task) => effectiveTaskType(task) === "qa");
}

/** Mirrors qa_latest_result(): the most recently completed QA-typed task's verdict, or null if QA has never run. */
export function qaLatestResult(project: Pick<AgencyProject, "tasks">): "pass" | "fail" | null {
  const withResult = qaTasks(project).filter((task) => task.qaResult);
  if (withResult.length === 0) return null;
  const latest = [...withResult].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];
  return latest.qaResult;
}

/** Mirrors project_client_review_complete(): at least one client_review-typed task, all Completed. */
export function clientReviewComplete(project: Pick<AgencyProject, "tasks">): boolean {
  const tasks = project.tasks.filter((task) => effectiveTaskType(task) === "client_review");
  return tasks.length > 0 && tasks.every((task) => task.status === "Completed");
}

const OPEN_INVOICE_STATUSES = new Set(["draft", "sent", "viewed", "partially_paid"]);

/** Mirrors project_payment_gate_open(): no invoice left in a non-terminal state. Zero invoices is not blocking. */
export function paymentGateOpen(invoiceStatuses: string[]): boolean {
  return !invoiceStatuses.some((status) => OPEN_INVOICE_STATUSES.has(status));
}

/** Mirrors launch_blocking_reasons(). Empty array = ready to launch. */
export function launchBlockingReasons(
  project: Pick<AgencyProject, "milestones" | "tasks">,
  deliverables: AgencyDeliverable[],
  invoiceStatuses: string[],
): string[] {
  const reasons: string[] = [];
  if (!checkpointApproved(deliverables, "overall_design")) reasons.push("Overall Design is not approved.");
  if (!developmentComplete(project)) reasons.push("Development is not complete.");
  if (qaLatestResult(project) !== "pass") reasons.push("QA has not passed.");
  if (!clientReviewComplete(project)) reasons.push("Client review is not complete.");
  if (!checkpointApproved(deliverables, "final_website")) reasons.push("The final website has not been approved.");
  if (!paymentGateOpen(invoiceStatuses)) reasons.push("An invoice for this project is still outstanding.");
  return reasons;
}

export type ProductionPhase =
  | "design"
  | "development"
  | "qa"
  | "client_review"
  | "final_approval"
  | "launch_ready"
  | "launched";

export type ProductionPhaseSummary = {
  phase: ProductionPhase;
  phaseLabel: string;
  blocking: string | null;
  nextAction: string;
};

/**
 * "What phase is this project in, what's blocking it, what happens next" --
 * the Admin/PM-facing summary from Section 16 of the workflow spec. Pure
 * function of already-loaded data; never itself a source of truth for
 * enforcement (the database triggers are).
 */
export function productionPhaseSummary(
  project: Pick<AgencyProject, "milestones" | "tasks" | "development">,
  deliverables: AgencyDeliverable[],
  invoiceStatuses: string[],
): ProductionPhaseSummary {
  if (project.development.deploymentStatus === "Production") {
    return { phase: "launched", phaseLabel: "Launched", blocking: null, nextAction: "Live -- ready for handoff." };
  }

  const overallDesignApproved = checkpointApproved(deliverables, "overall_design");
  const devComplete = developmentComplete(project);
  const qaResult = qaLatestResult(project);
  const reviewComplete = clientReviewComplete(project);
  const finalApproved = checkpointApproved(deliverables, "final_website");

  if (!overallDesignApproved) {
    return {
      phase: "design",
      phaseLabel: "Design",
      blocking: "Waiting for Overall Design approval.",
      nextAction: "Get the Overall Website Design deliverable approved by the client.",
    };
  }

  if (qaResult === "fail") {
    return {
      phase: "development",
      phaseLabel: "Development -- Needs Changes",
      blocking: "QA failed and sent this project back to Development.",
      nextAction: "Address the QA feedback, then resubmit for QA.",
    };
  }

  if (!devComplete) {
    const devTasks = tasksForMilestoneKey(project, "development");
    const started = devTasks.some((task) => task.status !== "Todo");
    return {
      phase: "development",
      phaseLabel: started ? "Development -- In Progress" : "Development -- Ready to Begin",
      blocking: null,
      nextAction: started ? "Finish the remaining Development tasks." : "Development is unlocked. Assign and start the Development tasks.",
    };
  }

  if (qaResult !== "pass") {
    return {
      phase: "qa",
      phaseLabel: "QA",
      blocking: "Waiting for QA sign-off.",
      nextAction: "Have QA review and pass the completed build.",
    };
  }

  if (!reviewComplete) {
    return {
      phase: "client_review",
      phaseLabel: "Client Review",
      blocking: "Waiting for the client to review.",
      nextAction: "Confirm the client has reviewed the site, then mark Client Review complete.",
    };
  }

  if (!finalApproved) {
    return {
      phase: "final_approval",
      phaseLabel: "Final Approval",
      blocking: "The completed website has not been approved for launch.",
      nextAction: "Get the Final Website checkpoint approved by the client.",
    };
  }

  if (!paymentGateOpen(invoiceStatuses)) {
    return {
      phase: "launch_ready",
      phaseLabel: "Launch Ready",
      blocking: "Waiting for Final Payment.",
      nextAction: "Collect the outstanding balance, then launch.",
    };
  }

  return {
    phase: "launch_ready",
    phaseLabel: "Launch Ready",
    blocking: null,
    nextAction: "Every gate is satisfied. Ready to launch.",
  };
}
