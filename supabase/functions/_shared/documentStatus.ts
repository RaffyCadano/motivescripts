export type DocumentStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired" | "cancelled";

export function effectiveDocumentStatus(
  status: string,
  expiry: string | null | undefined,
  now = new Date(),
): DocumentStatus {
  if (status === "sent" || status === "viewed") {
    if (expiry) {
      const day = expiry.slice(0, 10);
      const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
      if (day < today) return "expired";
    }
  }
  if (
    status === "draft" ||
    status === "sent" ||
    status === "viewed" ||
    status === "accepted" ||
    status === "declined" ||
    status === "expired" ||
    status === "cancelled"
  ) {
    return status;
  }
  return "sent";
}

export function documentStatusLabel(status: DocumentStatus, audience: "admin" | "client"): string {
  if (audience === "client" && status === "sent") return "Awaiting Review";
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "viewed":
      return "Viewed";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
  }
}

export function clientMayAccessPublished(status: string): boolean {
  return status === "sent" || status === "viewed" || status === "accepted" || status === "declined" || status === "expired";
}

export function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function asInt(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return fallback;
}

export function agencyEmail(): string {
  return "support@motivescripts.com";
}
