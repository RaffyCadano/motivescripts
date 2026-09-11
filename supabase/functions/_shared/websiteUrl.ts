// Mirrors the http(s)-only, credential-free URL validation in
// src/lib/safeUrl.ts, duplicated here because Edge Functions only bundle
// supabase/functions/ -- not the Vite frontend source tree.
//
// Adds one thing safeUrl.ts doesn't need: rejecting IP-literal loopback,
// link-local, and private-range hosts, so a project's production/staging URL
// can't be pointed at internal/metadata addresses reachable from the
// function's own network. This is a literal-hostname check only, not full
// DNS-rebinding protection: a hostname that *resolves* to a private address
// at fetch time (rather than being one in the URL itself) is not caught
// here. Closing that fully would mean resolving the hostname server-side and
// pinning the fetch to the checked IP, which needs Deno.resolveDns/low-level
// connection control whose availability in Supabase's Edge Function runtime
// (not stock Deno Deploy) was not verified in this pass -- flagged in the
// audit report rather than shipped unverified against a working feature.

const PRIVATE_HOSTS = new Set(["localhost", "0.0.0.0"]);

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

/** hostname from URL.hostname keeps its brackets for IPv6 literals (e.g. "[::1]"). */
function stripIPv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

function isPrivateIPv6(hostname: string): boolean {
  const host = stripIPv6Brackets(hostname).toLowerCase();
  if (!host.includes(":")) return false;
  if (host === "::1" || host === "::") return true; // loopback / unspecified
  if (host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb")) {
    return true; // link-local, fe80::/10
  }
  if (host.startsWith("fc") || host.startsWith("fd")) return true; // unique local, fc00::/7
  const mappedDecimal = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedDecimal && isPrivateIPv4(mappedDecimal[1])) return true; // IPv4-mapped IPv6, dotted-decimal form (::ffff:127.0.0.1)
  // IPv4-mapped IPv6 also has a pure-hex form the URL parser does not
  // canonicalize back to dotted-decimal (::ffff:7f00:1 === ::ffff:127.0.0.1) --
  // missing this let a private IPv4 through as a "valid" public-looking host.
  const mappedHex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    const dotted = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    if (isPrivateIPv4(dotted)) return true;
  }
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
  if (PRIVATE_HOSTS.has(stripIPv6Brackets(hostname))) return null;
  if (hostname.endsWith(".local")) return null;
  if (isPrivateIPv4(hostname)) return null;
  if (isPrivateIPv6(hostname)) return null;
  return parsed;
}
