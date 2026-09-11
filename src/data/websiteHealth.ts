export const websiteHealthCheckStatuses = ["healthy", "degraded", "down"] as const;

export type WebsiteHealthCheckStatus = (typeof websiteHealthCheckStatuses)[number];

/** UI-level state -- adds "unknown" for when no check has completed yet. */
export type WebsiteHealthState = WebsiteHealthCheckStatus | "unknown";

export const websiteHealthEnvironments = ["production", "staging"] as const;
export type WebsiteHealthEnvironment = (typeof websiteHealthEnvironments)[number];

export function isWebsiteHealthEnvironment(value: string): value is WebsiteHealthEnvironment {
  return (websiteHealthEnvironments as readonly string[]).includes(value);
}

export function websiteHealthEnvironmentLabel(environment: WebsiteHealthEnvironment): string {
  return environment === "staging" ? "Staging" : "Production";
}

export type WebsiteHealthCheck = {
  id: string;
  checkedAt: string;
  environment: WebsiteHealthEnvironment;
  status: WebsiteHealthCheckStatus;
  httpStatus: number | null;
  responseTimeMs: number | null;
  errorMessage: string;
};

export function isWebsiteHealthCheckStatus(value: string): value is WebsiteHealthCheckStatus {
  return (websiteHealthCheckStatuses as readonly string[]).includes(value);
}

/** Checks must be sorted most-recent-first; current state is the latest check's status. */
export function currentHealthState(checks: WebsiteHealthCheck[]): WebsiteHealthState {
  return checks[0]?.status ?? "unknown";
}

/** Most recent check that actually got a healthy response back. */
export function lastSuccessfulCheck(checks: WebsiteHealthCheck[]): WebsiteHealthCheck | null {
  return checks.find((check) => check.status === "healthy") ?? null;
}

export function websiteHealthStateLabel(state: WebsiteHealthState): string {
  switch (state) {
    case "healthy":
      return "Healthy";
    case "degraded":
      return "Degraded";
    case "down":
      return "Down";
    default:
      return "Unknown";
  }
}

export function formatCheckIssue(check: WebsiteHealthCheck): string {
  if (check.status === "healthy") return "";
  if (check.errorMessage.trim()) return check.errorMessage.trim();
  if (check.httpStatus) return `HTTP ${check.httpStatus}`;
  return "Unreachable";
}

export function formatHealthRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
