// Mirrors the http(s)-only, credential-free URL validation in
// src/lib/safeUrl.ts, duplicated here because Edge Functions only bundle
// supabase/functions/ -- not the Vite frontend source tree.
//
// Adds one thing safeUrl.ts doesn't need: rejecting IP-literal loopback,
// link-local, and private-range hosts, so a project's production_url can't
// be pointed at internal/metadata addresses reachable from the function's
// own network. This is a literal-hostname check only, not DNS-rebinding
// protection -- see the edge function's comment for that limitation.

const PRIVATE_HOSTS = new Set(["localhost", "0.0.0.0", "::1"]);

function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  return false;
}

/** Accept only http(s) URLs with a public-looking hostname and no embedded credentials. */
export function validateProductionUrl(value: string | null | undefined): URL | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!parsed.hostname) return null;
  if (parsed.username || parsed.password) return null;
  const hostname = parsed.hostname.toLowerCase();
  if (PRIVATE_HOSTS.has(hostname)) return null;
  if (hostname.endsWith(".local")) return null;
  if (isPrivateIPv4(hostname)) return null;
  return parsed;
}
