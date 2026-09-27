/**
 * Every page of the app is a separate file with a fingerprinted name. After a new release the old files are gone, so
 * a tab that was left open (or that the phone put to sleep and reloaded) can ask for a file that no longer exists.
 * That error is not a bug in the page: loading the site again fetches the new files. These helpers recognise it and
 * make sure we only try the reload once in a while, so a genuine outage cannot turn into a reload loop.
 */

export const CHUNK_RELOAD_KEY = "ms-chunk-reload-at";
export const CHUNK_RELOAD_WINDOW_MS = 30_000;

const CHUNK_MESSAGES = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
  "unable to preload css",
  "loading chunk",
  "chunkloaderror",
  "expected a javascript module script",
  "is not a valid javascript mime type",
];

export function isChunkLoadError(value: unknown): boolean {
  const text =
    value instanceof Error
      ? `${value.name} ${value.message}`
      : typeof value === "string"
        ? value
        : value && typeof value === "object" && "message" in value
          ? String((value as { message: unknown }).message)
          : "";
  const lower = text.toLowerCase();
  return CHUNK_MESSAGES.some((snippet) => lower.includes(snippet));
}

/** True when the last automatic reload was long enough ago (or never), so trying again is safe. */
export function canAutoReload(now: number, lastReloadAt: number | null, windowMs: number = CHUNK_RELOAD_WINDOW_MS): boolean {
  return lastReloadAt === null || !Number.isFinite(lastReloadAt) || now - lastReloadAt > windowMs;
}

function readLast(): number | null {
  try {
    const raw = window.sessionStorage.getItem(CHUNK_RELOAD_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

/** Reloads the page once for a stale-files error; returns false when it already did so a moment ago. */
export function reloadForNewVersion(): boolean {
  const now = Date.now();
  if (!canAutoReload(now, readLast())) return false;
  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    // Storage blocked: reload anyway; the worst case is one extra reload before the fallback screen shows.
  }
  window.location.reload();
  return true;
}
