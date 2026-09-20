/**
 * Launch-readiness summary for the Developer Deployments workspace. DISPLAY
 * ONLY -- every "gate" item below is computed by the same client-side mirrors
 * (productionWorkflow.ts) of the server-side launch_blocking_reasons() checks,
 * so it can't disagree with the workflow the database actually enforces. It
 * never allows or blocks anything itself.
 *
 * Two deliberately separate groups:
 *  - Launch gates: the real workflow gates (design, development, QA, client
 *    review, final approval). Authoritative.
 *  - Delivery setup: manually tracked environment/hosting/domain metadata plus
 *    the latest website-health check. Informational only -- the launch gate
 *    does not look at any of it, so it is labeled that way in the UI.
 *
 * The payment gate is intentionally absent: it is derived from invoices,
 * which developers cannot read. The UI says so instead of guessing.
 */
import type { AgencyProject } from "@/data/agencyProjects";
import type { AgencyDeliverable } from "@/data/files";
import {
  checkpointApproved,
  clientReviewComplete,
  developmentComplete,
  qaLatestResult,
} from "@/data/productionWorkflow";
import type { ProjectDevelopment } from "@/data/projectDevelopment";
import { websiteHealthStateLabel, type WebsiteHealthState } from "@/data/websiteHealth";

export type ReadinessItem = {
  id: string;
  label: string;
  met: boolean;
  detail?: string;
};

export function launchGateItems(
  project: Pick<AgencyProject, "milestones" | "tasks">,
  deliverables: AgencyDeliverable[],
): ReadinessItem[] {
  const qaResult = qaLatestResult(project);
  return [
    { id: "design", label: "Overall Design approved", met: checkpointApproved(deliverables, "overall_design") },
    { id: "development", label: "Development complete", met: developmentComplete(project) },
    {
      id: "qa",
      label: "QA passed",
      met: qaResult === "pass",
      detail: qaResult === "fail" ? "QA failed -- sent back to Development" : qaResult === null ? "QA has not run yet" : undefined,
    },
    { id: "client-review", label: "Client review complete", met: clientReviewComplete(project) },
    { id: "final-website", label: "Final website approved", met: checkpointApproved(deliverables, "final_website") },
  ];
}

/** `productionHealth` is null when no production URL is configured or no check state has loaded yet. */
export function deliverySetupItems(
  development: Pick<ProjectDevelopment, "stagingUrl" | "productionUrl" | "hostingStatus" | "domainStatus">,
  productionHealth: WebsiteHealthState | null,
): ReadinessItem[] {
  const hasProduction = development.productionUrl.trim().length > 0;
  return [
    { id: "staging-url", label: "Staging URL set", met: development.stagingUrl.trim().length > 0 },
    { id: "production-url", label: "Production URL set", met: hasProduction },
    {
      id: "hosting",
      label: "Hosting configured",
      met: development.hostingStatus === "Configured",
      detail: development.hostingStatus === "Configured" ? undefined : development.hostingStatus,
    },
    {
      id: "domain",
      label: "Domain configured",
      met: development.domainStatus === "Configured",
      detail: development.domainStatus === "Configured" ? undefined : development.domainStatus,
    },
    {
      id: "health",
      label: "Production website healthy",
      met: productionHealth === "healthy",
      detail: !hasProduction
        ? "No production URL"
        : productionHealth === null
          ? undefined
          : productionHealth === "healthy"
            ? undefined
            : websiteHealthStateLabel(productionHealth),
    },
  ];
}

export function readinessCounts(items: ReadinessItem[]): { met: number; total: number } {
  return { met: items.filter((item) => item.met).length, total: items.length };
}
