import { formatLeadSubmitted } from "@/data/leads";

export const deploymentStatuses = [
  "Not deployed",
  "Development",
  "Staging",
  "Production",
  "Deployment issue",
] as const;

export type DeploymentStatus = (typeof deploymentStatuses)[number];

export type ProjectDevelopment = {
  repositoryUrl: string;
  repositoryBranch: string;
  templateRepositoryUrl: string;
  stagingUrl: string;
  productionUrl: string;
  hostingProvider: string;
  deploymentStatus: DeploymentStatus;
  lastDeployedAt: string;
};

export function emptyProjectDevelopment(): ProjectDevelopment {
  return {
    repositoryUrl: "",
    repositoryBranch: "",
    templateRepositoryUrl: "",
    stagingUrl: "",
    productionUrl: "",
    hostingProvider: "",
    deploymentStatus: "Not deployed",
    lastDeployedAt: "",
  };
}

export function isDeploymentStatus(value: string | null | undefined): value is DeploymentStatus {
  return deploymentStatuses.includes(value as DeploymentStatus);
}

export function formatDeploymentWhen(value: string): string {
  if (!value.trim()) return "Not configured";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not configured";
  return formatLeadSubmitted(date.toISOString());
}

export function toDatetimeLocalValue(iso: string): string {
  if (!iso.trim()) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string {
  if (!value.trim()) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export type ClientWebsitePhase = "none" | "preview" | "live";

export function clientWebsitePhase(development: Pick<ProjectDevelopment, "stagingUrl" | "productionUrl">): ClientWebsitePhase {
  if (development.productionUrl.trim()) return "live";
  if (development.stagingUrl.trim()) return "preview";
  return "none";
}

export function clientWebsiteStatusLabel(phase: ClientWebsitePhase): string {
  if (phase === "live") return "Live";
  if (phase === "preview") return "In Development";
  return "Not available yet";
}
