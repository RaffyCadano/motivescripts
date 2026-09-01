/**
 * Deliverable and version UI types and helpers.
 * Runtime metadata comes from Supabase. Binaries live in the private project-files bucket.
 * This module has no seed rows and does not invent Storage paths.
 */

import { formatLeadDate, formatLeadSubmitted } from "@/data/leads";

export const deliverableStatuses = ["Draft", "In Review", "Needs Changes", "Approved", "Archived"] as const;
export type DeliverableStatus = (typeof deliverableStatuses)[number];

export const deliverableCategories = [
  "Website Page",
  "Design",
  "Branding",
  "Content",
  "Development",
  "Asset",
  "Document",
  "Other",
] as const;
export type DeliverableCategory = (typeof deliverableCategories)[number];

export const fileVersionStatuses = ["Active", "Archived"] as const;
export type FileVersionStatus = (typeof fileVersionStatuses)[number];

export type AgencyFileVersion = {
  id: string;
  deliverableId: string;
  versionNumber: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  description: string;
  uploadedBy: string;
  uploadedAt: string;
  status: FileVersionStatus;
  storagePath: string | null;
  mimeType: string;
  previewUrl: string | null;
};

export type AgencyDeliverable = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  category: DeliverableCategory;
  status: DeliverableStatus;
  createdAt: string;
  updatedAt: string;
  currentVersionId: string | null;
  versions: AgencyFileVersion[];
};

export type DeliverableDraft = {
  name: string;
  description: string;
  category: DeliverableCategory;
  status: DeliverableStatus;
};

export type VersionDraft = {
  fileName: string;
  fileType: string;
  fileSize: number;
  description: string;
  previewUrl: string | null;
};

export type FileSort = "updated" | "name" | "newest" | "oldest";

export function nextVersionNumber(versions: AgencyFileVersion[]): number {
  if (versions.length === 0) return 1;
  return Math.max(...versions.map((item) => item.versionNumber)) + 1;
}

export function currentVersion(deliverable: AgencyDeliverable): AgencyFileVersion | null {
  if (!deliverable.currentVersionId) return null;
  return deliverable.versions.find((item) => item.id === deliverable.currentVersionId) ?? null;
}

export function versionLabel(versionNumber: number): string {
  return `v${versionNumber}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) {
    const kb = bytes / 1024;
    return `${kb >= 10 ? Math.round(kb) : kb.toFixed(1)} KB`;
  }
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function fileTypeFromName(fileName: string, mime = ""): string {
  const ext = fileName.split(".").pop()?.toUpperCase() ?? "";
  if (ext === "JPEG") return "JPG";
  if (ext) return ext;
  if (mime.includes("png")) return "PNG";
  if (mime.includes("jpeg")) return "JPG";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("zip")) return "ZIP";
  return "Other";
}

export function isImageType(fileType: string, mime = ""): boolean {
  const type = fileType.toUpperCase();
  return ["PNG", "JPG", "JPEG", "WEBP", "SVG", "GIF"].includes(type) || mime.startsWith("image/");
}

export const fileInputAccept = ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.svg,.psd,.ai,.fig,.xd,.zip";

export const reviewStatuses = ["Draft", "In Review", "Needs Changes", "Approved"] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];

export const fileSortOptions: { id: FileSort; label: string }[] = [
  { id: "updated", label: "Recently updated" },
  { id: "name", label: "Name" },
  { id: "newest", label: "Newest version" },
  { id: "oldest", label: "Oldest" },
];

export function sortedVersions(versions: AgencyFileVersion[]): AgencyFileVersion[] {
  return versions.slice().sort((a, b) => b.versionNumber - a.versionNumber);
}

export function versionHistoryLabel(
  version: AgencyFileVersion,
  currentVersionId: string | null,
): "Current" | "Previous" | "Archived" {
  if (version.status === "Archived") return "Archived";
  if (version.id === currentVersionId) return "Current";
  return "Previous";
}

export function fileKind(fileType: string): "image" | "document" | "design" | "code" | "archive" | "other" {
  const type = fileType.toUpperCase();
  if (["PNG", "JPG", "JPEG", "WEBP", "SVG", "GIF"].includes(type)) return "image";
  if (["PDF", "DOC", "DOCX", "TXT"].includes(type)) return "document";
  if (["FIG", "PSD", "AI", "SKETCH"].includes(type)) return "design";
  if (["HTML", "CSS", "JS", "TS", "JSON"].includes(type)) return "code";
  if (type === "ZIP") return "archive";
  return "other";
}

export type DeliverableSearchNames = {
  projectName: (projectId: string) => string;
  clientName: (projectId: string) => string;
};

export function filterDeliverables(
  items: AgencyDeliverable[],
  query: string,
  status: DeliverableStatus | "All",
  category: DeliverableCategory | "All",
  names?: DeliverableSearchNames,
): AgencyDeliverable[] {
  const needle = query.trim().toLowerCase();
  return items.filter((item) => {
    if (status === "All" && item.status === "Archived") return false;
    if (status !== "All" && item.status !== status) return false;
    if (category !== "All" && item.category !== category) return false;
    if (!needle) return true;
    const inName = item.name.toLowerCase().includes(needle) || item.description.toLowerCase().includes(needle);
    const inFiles = item.versions.some((version) => version.fileName.toLowerCase().includes(needle));
    const inProject = (names?.projectName(item.projectId) ?? "").toLowerCase().includes(needle);
    const inClient = (names?.clientName(item.projectId) ?? "").toLowerCase().includes(needle);
    return inName || inFiles || inProject || inClient;
  });
}

export function sortDeliverables(items: AgencyDeliverable[], sort: FileSort): AgencyDeliverable[] {
  return items.slice().sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
    if (sort === "newest") {
      const aMax = Math.max(0, ...a.versions.map((item) => item.versionNumber));
      const bMax = Math.max(0, ...b.versions.map((item) => item.versionNumber));
      return bMax - aMax;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function recentDeliverables(items: AgencyDeliverable[], limit = 3): AgencyDeliverable[] {
  return sortDeliverables(
    items.filter((item) => item.status !== "Archived"),
    "updated",
  ).slice(0, limit);
}

export { formatLeadDate as formatFileRelative, formatLeadSubmitted as formatFileLong };

export function formatFileUpdated(iso: string): string {
  const label = formatLeadDate(iso);
  if (label === "Today") return "today";
  if (label === "Yesterday") return "yesterday";
  return label;
}

export function formatFileUpdatedLabel(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const relative = formatLeadDate(iso);
  if (relative === "Today") return "Updated today";
  if (relative === "Yesterday") return "Updated yesterday";
  return `Updated ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function deliverableCurrentVersionLabel(deliverable: AgencyDeliverable): string {
  const current = currentVersion(deliverable);
  if (!current) return "No version";
  return versionLabel(current.versionNumber);
}

export function deliverableUpdatedAt(deliverable: AgencyDeliverable): string {
  return currentVersion(deliverable)?.uploadedAt || deliverable.updatedAt;
}

export function formatFileHistoryDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function earlierVersionCount(deliverable: AgencyDeliverable): number {
  return Math.max(0, deliverable.versions.length - 1);
}
