import {
  PROJECT_FILES_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  contractSignedCopyStoragePath,
  discoveryIntakeStoragePath,
  projectFileStoragePath,
  taskRequestStoragePath,
  validateSignedCopyFile,
  validateUploadFile,
} from "@/data/fileUploadConfig";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase } from "@/lib/supabase";

type SignedCacheEntry = { url: string; expiresAt: number };

const signedUrlCache = new Map<string, SignedCacheEntry>();

function storage() {
  const client = getSupabase();
  if (!client) {
    throw new AgencyDbError("Supabase is not configured. Add VITE_SUPABASE_URL and the publishable key.");
  }
  return client.storage.from(PROJECT_FILES_BUCKET);
}

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  throw new AgencyDbError(friendlyDbError(error, fallback), error);
}

export async function uploadContractSignedCopy(input: {
  contractId: string;
  file: File;
}): Promise<string> {
  const invalid = validateSignedCopyFile(input.file);
  if (invalid) throw new AgencyDbError(invalid.message);

  const path = contractSignedCopyStoragePath(input.contractId, input.file.name);
  const { error } = await storage().upload(path, input.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: input.file.type || "application/octet-stream",
  });
  if (error) fail("upload signed copy", error, "Unable to upload this file. Please try again.");
  return path;
}

export async function uploadDiscoveryIntakeFile(input: {
  projectId: string;
  intakeId: string;
  fileId: string;
  file: File;
}): Promise<string> {
  const invalid = validateUploadFile(input.file);
  if (invalid) throw new AgencyDbError(invalid.message);

  const path = discoveryIntakeStoragePath({
    projectId: input.projectId,
    intakeId: input.intakeId,
    fileId: input.fileId,
    originalName: input.file.name,
  });

  const { error } = await storage().upload(path, input.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: input.file.type || "application/octet-stream",
  });
  if (error) fail("upload discovery file", error, "Unable to upload this file. Please try again.");
  return path;
}

export async function uploadTaskRequestFile(input: {
  projectId: string;
  requestId: string;
  fileId: string;
  file: File;
}): Promise<string> {
  const invalid = validateUploadFile(input.file);
  if (invalid) throw new AgencyDbError(invalid.message);

  const path = taskRequestStoragePath({
    projectId: input.projectId,
    requestId: input.requestId,
    fileId: input.fileId,
    originalName: input.file.name,
  });

  const { error } = await storage().upload(path, input.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: input.file.type || "application/octet-stream",
  });
  if (error) fail("upload task request file", error, "Unable to upload this file. Please try again.");
  return path;
}

export async function uploadProjectFile(input: {
  projectId: string;
  deliverableId: string;
  versionId: string;
  file: File;
}): Promise<string> {
  const invalid = validateUploadFile(input.file);
  if (invalid) throw new AgencyDbError(invalid.message);

  const path = projectFileStoragePath({
    projectId: input.projectId,
    deliverableId: input.deliverableId,
    versionId: input.versionId,
    originalName: input.file.name,
  });

  const { error } = await storage().upload(path, input.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: input.file.type || "application/octet-stream",
  });
  if (error) fail("upload file", error, "Unable to upload this file. Please try again.");
  return path;
}

export async function removeProjectFile(storagePath: string): Promise<void> {
  const { error } = await storage().remove([storagePath]);
  if (error) {
    logDbError("cleanup storage object", error);
    throw new AgencyDbError("The file uploaded, but saving the version failed. The extra file could not be removed automatically.", error);
  }
}

export async function tryRemoveProjectFile(storagePath: string): Promise<void> {
  try {
    await removeProjectFile(storagePath);
  } catch (error) {
    logDbError("orphaned storage object", error);
  }
}

export function clearSignedUrlCache() {
  signedUrlCache.clear();
}

export async function signedUrlForPath(
  storagePath: string,
  options?: { download?: string },
): Promise<string> {
  const key = options?.download ? `${storagePath}::dl::${options.download}` : storagePath;
  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 15_000) return cached.url;

  const { data, error } = options?.download
    ? await storage().createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, { download: options.download })
    : await storage().createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    fail("signed url", error, options?.download ? "Unable to download this file." : "Unable to open this file.");
  }

  signedUrlCache.set(key, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  });
  return data.signedUrl;
}

export async function downloadProjectFile(storagePath: string, fileName: string): Promise<void> {
  const url = await signedUrlForPath(storagePath, { download: fileName });
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}
