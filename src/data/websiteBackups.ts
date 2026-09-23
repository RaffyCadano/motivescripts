import { formatHealthRelativeTime } from "@/data/websiteHealth";
import type { WebsiteBackupRow } from "@/types/database";

export const websiteBackupStatuses = ["ok", "failed"] as const;
export type WebsiteBackupStatus = (typeof websiteBackupStatuses)[number];

export function isWebsiteBackupStatus(value: string): value is WebsiteBackupStatus {
  return (websiteBackupStatuses as readonly string[]).includes(value);
}

export type WebsiteBackup = {
  id: string;
  projectId: string;
  status: WebsiteBackupStatus;
  storagePath: string | null;
  byteSize: number | null;
  errorMessage: string;
  triggeredBy: string | null;
  createdAt: string;
};

export function mapWebsiteBackupRow(row: WebsiteBackupRow): WebsiteBackup {
  return {
    id: row.id,
    projectId: row.project_id,
    status: isWebsiteBackupStatus(row.status) ? row.status : "failed",
    storagePath: row.storage_path,
    byteSize: row.byte_size,
    errorMessage: row.error_message,
    triggeredBy: row.triggered_by,
    createdAt: row.created_at,
  };
}

/** Most recent successful backup, if any -- backups list is expected newest-first. */
export function lastSuccessfulBackup(backups: WebsiteBackup[]): WebsiteBackup | null {
  return backups.find((backup) => backup.status === "ok") ?? null;
}

export function formatBackupRelativeTime(iso: string): string {
  return formatHealthRelativeTime(iso);
}

export function formatBackupSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

export function backupFileName(backup: WebsiteBackup): string {
  const stamp = new Date(backup.createdAt);
  const safeStamp = Number.isNaN(stamp.getTime())
    ? backup.id
    : stamp.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `website-backup-${safeStamp}.html`;
}
