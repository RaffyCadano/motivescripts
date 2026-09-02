/**
 * Single place for upload limits and allowed types.
 * Change MAX_FILE_BYTES here if the product limit changes.
 */

export const PROJECT_FILES_BUCKET = "project-files";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = "50 MB";
export const SIGNED_URL_TTL_SECONDS = 10 * 60;

export const signedCopyUploadExtensions = ["pdf", "png", "jpg", "jpeg", "webp"] as const;

export const signedCopyFileInputAccept = signedCopyUploadExtensions.map((ext) => `.${ext}`).join(",");

export const allowedUploadExtensions = [
  "pdf",
  "doc",
  "docx",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "svg",
  "psd",
  "ai",
  "fig",
  "xd",
  "zip",
] as const;

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "application/zip",
  "application/x-zip-compressed",
  "application/postscript",
  "application/illustrator",
  "image/vnd.adobe.photoshop",
  "application/vnd.adobe.photoshop",
  "application/octet-stream",
  "",
]);

export const fileInputAccept = allowedUploadExtensions.map((ext) => `.${ext}`).join(",");

export type UploadValidationError = {
  code: "missing" | "type" | "size";
  message: string;
};

export function fileExtension(fileName: string): string {
  const parts = fileName.trim().split(".");
  if (parts.length < 2) return "";
  return parts.pop()?.toLowerCase() ?? "";
}

export function validateSignedCopyFile(file: File | null | undefined): UploadValidationError | null {
  const base = validateUploadFile(file);
  if (base) return base;
  const ext = fileExtension(file?.name ?? "");
  const allowed = (signedCopyUploadExtensions as readonly string[]).includes(ext);
  if (!allowed) {
    return { code: "type", message: "Upload a PDF or image of the signed contract." };
  }
  return null;
}

export function validateUploadFile(file: File | null | undefined): UploadValidationError | null {
  if (!file || !file.name.trim()) {
    return { code: "missing", message: "Choose a file to upload." };
  }
  if (file.size <= 0) {
    return { code: "missing", message: "Choose a file to upload." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { code: "size", message: `This file is too large. Maximum size is ${MAX_FILE_SIZE_LABEL}.` };
  }
  const ext = fileExtension(file.name);
  const mime = (file.type || "").toLowerCase();
  const extensionOk = allowedUploadExtensions.includes(ext as (typeof allowedUploadExtensions)[number]);
  const mimeOk = allowedMimeTypes.has(mime);
  if (!extensionOk || !mimeOk) {
    return { code: "type", message: "This file type isn’t supported." };
  }
  return null;
}

export function storageFileName(originalName: string): string {
  const ext = fileExtension(originalName);
  const safeExt = allowedUploadExtensions.includes(ext as (typeof allowedUploadExtensions)[number]) ? ext : "bin";
  return `file.${safeExt}`;
}

export function contractSignedCopyStoragePath(contractId: string, originalName: string): string {
  const ext = fileExtension(originalName);
  const safeExt = (signedCopyUploadExtensions as readonly string[]).includes(ext) ? ext : "pdf";
  return ["contracts", contractId, "signed-copy", `${crypto.randomUUID()}.${safeExt}`].join("/");
}

export function projectFileStoragePath(input: {
  projectId: string;
  deliverableId: string;
  versionId: string;
  originalName: string;
}): string {
  return [
    "projects",
    input.projectId,
    "deliverables",
    input.deliverableId,
    "versions",
    input.versionId,
    storageFileName(input.originalName),
  ].join("/");
}

export function discoveryIntakeStoragePath(input: {
  projectId: string;
  intakeId: string;
  fileId: string;
  originalName: string;
}): string {
  const ext = fileExtension(input.originalName);
  const safeExt = allowedUploadExtensions.includes(ext as (typeof allowedUploadExtensions)[number]) ? ext : "bin";
  return ["projects", input.projectId, "discovery", input.intakeId, `${input.fileId}.${safeExt}`].join("/");
}

export function taskRequestStoragePath(input: {
  projectId: string;
  requestId: string;
  fileId: string;
  originalName: string;
}): string {
  const ext = fileExtension(input.originalName);
  const safeExt = allowedUploadExtensions.includes(ext as (typeof allowedUploadExtensions)[number]) ? ext : "bin";
  return [
    "projects",
    input.projectId,
    "tasks",
    "requests",
    input.requestId,
    `${input.fileId}.${safeExt}`,
  ].join("/");
}

export function hasStoredFile(version: { storagePath: string | null }): boolean {
  return Boolean(version.storagePath);
}

export function canPreviewAsImage(fileType: string, mime = ""): boolean {
  const type = fileType.toUpperCase();
  if (type === "SVG" || mime.includes("svg")) return false;
  return ["PNG", "JPG", "JPEG", "WEBP"].includes(type) || ["image/png", "image/jpeg", "image/webp"].includes(mime);
}

export function canPreviewAsPdf(fileType: string, mime = ""): boolean {
  return fileType.toUpperCase() === "PDF" || mime === "application/pdf";
}
